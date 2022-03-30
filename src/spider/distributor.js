/* eslint-disable max-len */
// import { get, set, clearDistributorStorage } from "/utils/localStorage.js";
import { shortId } from '/spider/utils/uuid.js';
import { execa } from '/spider/exec.js';
// Managed by distributor.js.
const weakeningHosts = new Set();
const growingHosts = new Set();
const hackingHosts = new Set();
// Set by the "watch" scripts, cleared by the distributor.
const notifications = new Set();
const runningProcesses = new Map();

const scriptPaths = {
  touch: '/spider/touch.js',
  hack: '/spider/hack.js',
  grow: '/spider/grow.js',
  weaken: '/spider/weaken.js',
  watchSecurity: '/spider/watch-security.js',
  watchGrowth: '/spider/watch-growth.js',
  watchHack: '/spider/watch-hack.js',
  spider: '/spider/spider.js',
};
let rootedHosts = [];
let controlledHosts = [];
let newHacks = [];
let newGrows = [];
let newWeakens = [];

/**
 * @param {import("..").NS } ns
 * @param {string} host - target hostname
 * */
async function killHacks(ns, host) {
  ns.scriptKill(scriptPaths.hack, host);
  ns.scriptKill(scriptPaths.grow, host);
  ns.scriptKill(scriptPaths.weaken, host);
  ns.scriptKill(scriptPaths.watchSecurity, host);
  ns.scriptKill(scriptPaths.watchGrowth, host);
  if (host !== 'home') {
    ns.killall(host);
    await ns.scp(ns.ls('home', '/spider'), 'home', host);
    await ns.scp(ns.ls('home', '/utils'), 'home', host);
  }
  runningProcesses.set(host, []);
}

/**
 * @param {import("..").NS } ns
 * */
function killProcesses(ns, processes) {
  return processes.map(({ host, script, args }) => ns.kill(script, host, ...args));
}

/**
 * @param {import("..").NS } ns */
async function awaitAndProcessNotifications(ns) {
  let count = 1;
  while (ns.ls('home', '.notification.txt').length === 0 && count < 5) {
    await ns.sleep(5000);
    count += 1;
  }
  ns.ls('home', '.notification.txt').forEach((filePath) => {
    const contents = ns.read(filePath);
    const notification = JSON.parse(contents);
    notifications.add(notification);
    ns.rm(filePath);
  });
}

/**
 * @param {import("..").NS } ns
 * @param {string[]} controlledHostsWithMetadata - {host: string, }
 * @param {string} jobScript - script to run
 * @param {number} jobThreads - number of threads to run
 * @param {string} jobTarget - target hostname
 * @param {number} tag - not really used yet, only used for weaken scripts see weaken.js
 */
async function scheduleOn(ns, controlledHostsWithMetadata, jobScript, jobThreads, jobTarget, tag) {
  const startedProcesses = [];
  const ramPerTask = ns.getScriptRam(jobScript, 'home');

  while (jobThreads > 0 && controlledHostsWithMetadata.length > 0) {
    const numThisHost = Math.min(
      Math.floor(controlledHostsWithMetadata[0].availableRam / ramPerTask),
      jobThreads,
    );

    jobThreads -= numThisHost;
    const args = [jobScript, controlledHostsWithMetadata[0].host, numThisHost, jobTarget, tag];
    if (numThisHost > 0) {
      await execa(ns, args);
      startedProcesses.push({ host: controlledHostsWithMetadata[0].host, script: jobScript, args: [jobTarget, tag] });
    }

    if (jobThreads > 0) {
      controlledHostsWithMetadata.shift();
    } else {
      controlledHostsWithMetadata[0].availableRam -= numThisHost * ramPerTask;
    }
  }
  return startedProcesses;
}

/**
 * @param {import("..").NS } ns */
async function hack(ns, host, controlledHostsWithMetadata) {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);

  if (!weakeningHosts.has(host) && !growingHosts.has(host) && !hackingHosts.has(host) && serverMoneyAvailable > (0.50 * serverMaxMoney)) {
    const newProcesses = [];
    ns.tprint(`
    *************************
    **** NEW HACK TARGET ****
    \tHost: ${host}
    \tAvailable Money: ${serverMoneyAvailable}
    \tExpected Earnings: ${(serverMaxMoney * 0.6) - (serverMaxMoney * 0.5)}
    *************************`);
    for (let i = 0; controlledHostsWithMetadata.length > 0 && i < 5; i += 1) {
      const processTag = shortId();
      await ns.sleep(30);
      newProcesses.push(
        ...(await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.hack, 6, host, processTag)),
        ...(await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, 1, host, processTag)),
      );
    }
    if (newProcesses.length) {
      await scheduleOn(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchHack, 1, host, 'hack-stage');
      hackingHosts.add(host);
      newHacks.push(host);
      runningProcesses.set(host, newProcesses);
    }
  }
}

/**
 * @param {import("..").NS } ns */
async function grow(ns, host, controlledHostsWithMetadata) {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);
  if (
    !weakeningHosts.has(host)
    && !growingHosts.has(host)
    && serverMoneyAvailable < 0.50 * serverMaxMoney
  ) {
    const growthAmountNeeded = (serverMaxMoney * 0.6) / serverMoneyAvailable;
    const growThreadsNeeded = ns.growthAnalyze(host, growthAmountNeeded);
    const weakenThreadsNeeded = Math.ceil(growThreadsNeeded / 6);
    const newProcesses = [];

    const processTag = shortId();
    newProcesses.push(
      ...await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.grow, growThreadsNeeded, host, processTag),
      ...await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadsNeeded, host, processTag),
    );
    if (newProcesses.length) {
      ns.tprint(`
      *************************
      **** NEW GROW TARGET ****
      \tHost: ${host}
      \tAvailable Money: ${serverMoneyAvailable}
      \tMax Money: ${serverMaxMoney}
      \tNeed to Grow by (60% of Max): ${(serverMaxMoney * 0.6) / serverMoneyAvailable}
      \tGrow threads needed: ${growThreadsNeeded}
      *************************`);
      await scheduleOn(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchGrowth, 1, host, processTag);
      growingHosts.add(host);
      newGrows.push(host);
      runningProcesses.set(host, newProcesses);
    }
  }
}

async function weaken(ns, host, controlledHostsWithMetadata) {
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const notAlreadyWeakened = currentSecurityLevel > 3 + minimumSecurityLevel;
  if (notAlreadyWeakened && !weakeningHosts.has(host)) {
    const newProcesses = [];
    // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
    const weakenThreadCount = Math.floor(
      (currentSecurityLevel - minimumSecurityLevel) / 0.05,
    );
    const processTag = shortId();
    newProcesses.push(
      ...await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadCount, host, processTag),
    );
    if (newProcesses.length) {
      ns.tprint(`
      ***************************
      **** NEW WEAKEN TARGET ****
      \tHost: ${host}
      \tCurrent Security Level: ${currentSecurityLevel}
      \tMin Security Level: ${minimumSecurityLevel}
      \tWeaken threads needed: ${weakenThreadCount}
      ***************************`);
      await scheduleOn(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchSecurity, 1, host, processTag);
      weakeningHosts.add(host);
      newWeakens.push(host);
      runningProcesses.set(host, newProcesses);
    }
  }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
  ns.disableLog('getServerSecurityLevel');
  ns.disableLog('getServerMinSecurityLevel');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  ns.disableLog('scp');
  weakeningHosts.clear();
  growingHosts.clear();
  hackingHosts.clear();
  const minHomeRamAvailable = 16;
  let count = 1;

  rootedHosts = JSON.parse(ns.read('/data/rootedHosts.txt'));
  controlledHosts = JSON.parse(ns.read('/data/controlledHosts.txt'));

  for (const host of controlledHosts) {
    await killHacks(ns, host);
  }

  while (true) {
    rootedHosts = JSON.parse(ns.read('/data/rootedHosts.txt'));
    controlledHosts = JSON.parse(ns.read('/data/controlledHosts.txt'));

    const controlledHostsWithMetadata = controlledHosts.map((host) => {
      let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      if (host === 'home') {
        availableRam = Math.max(0, availableRam - minHomeRamAvailable);
      }
      return {
        host,
        availableRam,
      };
    });

    if (notifications.size) {
      notifications.forEach(({ host, status }) => {
        switch (status) {
          case 'weakened':
            weakeningHosts.delete(host);
            break;
          case 'grown':
            growingHosts.delete(host);
            break;
          case 'hacked':
            hackingHosts.delete(host);
            break;
          default:
            ns.tprint(`Unknown notification status from ${host}: ${status}`);
        }

        killProcesses(ns, runningProcesses.get(host));
      });
      notifications.clear();
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        await weaken(ns, host, controlledHostsWithMetadata);
      }
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        await hack(ns, host, controlledHostsWithMetadata);
      }
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        await grow(ns, host, controlledHostsWithMetadata);
      }
    }
    if (newHacks.length || newWeakens.length || newGrows.length) {
      ns.tprint(`DISTRIBUTOR:
      \tLoop #${count}
      \tRooted Hosts Count: ${rootedHosts.length}
      \t*******************************************
      \t*************  NEW TARGETS  ***************
      \t*******************************************
      \tNew Weaken Targets: ${newWeakens.join(', ')}
      \tNew Grow Targets: ${newGrows.join(', ')}
      \tNew Hacks Targets: ${newHacks.join(', ')}
      \t*******************************************
      \t***********  CURRENT TARGETS  *************
      \t*******************************************
      \tCurrent Weaken Targets: ${Array.from(weakeningHosts.values()).join(', ')}
      \tCurrent Grow Targets: ${Array.from(growingHosts.values()).join(', ')}
      \tCurrent Hacks Targets: ${Array.from(hackingHosts.values()).join(', ')}
    `);
      newHacks = [];
      newGrows = [];
      newWeakens = [];
    }
    count += 1;
    await awaitAndProcessNotifications(ns);
  }
}
