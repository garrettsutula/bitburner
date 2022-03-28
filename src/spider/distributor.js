import { get, set, clearDistributorStorage } from "/utils/localStorage.js";
import { shortId } from '/utils/uuid.js';
import { execa } from "/spider/exec.js";
const scriptPaths = {
    touch: "/spider/touch.js",
    hack: "/spider/hack.js",
    weaken: "/spider/weaken.js",
    watchSecurity: "/spider/watch-security.js",
    spider: "/spider/spider.js",
};
let weakeningHosts = [];
let hackingHosts = [];
let controlledHosts = get('controlledHosts');
let rootedHosts = get('rootedHosts');
let newHacks = [];
let newWeakens = [];

/** 
 * @param {import("..").NS } ns 
 * @param {string} host - target hostname
 * */
async function killHacks(ns, host) {
    ns.scriptKill(scriptPaths.hack, host);
    ns.scriptKill(scriptPaths.weaken, host);
    ns.scriptKill(scriptPaths.watchSecurity, host);
    if (host !== "home") {
        ns.killall(host);
        await ns.scp(ns.ls("home", "/spider"), "home", host);
        await ns.scp(ns.ls("home", "/utils"), "home", host);
    }
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
    const ramPerTask = ns.getScriptRam(jobScript, "home");

    while (jobThreads > 0 && controlledHostsWithMetadata.length > 0) {
        const numThisHost = Math.min(Math.floor(controlledHostsWithMetadata[0].availableRam / ramPerTask), jobThreads);

        jobThreads -= numThisHost;
        const args = [jobScript, controlledHostsWithMetadata[0].host, numThisHost, jobTarget, tag];
        if (numThisHost > 0) await execa(ns, args);

        if (jobThreads > 0) {
            controlledHostsWithMetadata.shift();
        } else {
            controlledHostsWithMetadata[0].availableRam = controlledHostsWithMetadata[0].availableRam - numThisHost * ramPerTask;
        }
    }
}

async function hack(ns, host, controlledHostsWithMetadata, extraHackRounds = false) {
    if (!hackingHosts.includes(host) || extraHackRounds) {
        for (let i = 0; controlledHostsWithMetadata.length > 0 && i < 5; i += 1) {
            const processTag = shortId();
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, 512, host, processTag);
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.hack, 3072, host, processTag);
        }
        hackingHosts.push(host);
        newHacks.push(host);
    }
}

async function weakenIfNeeded(ns, host, controlledHostsWithMetadata, newWeakenLogs) {
    const currentSecurityLevel = ns.getServerSecurityLevel(host);
    const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
    const notAlreadyWeakened = currentSecurityLevel > (hackingHosts.includes(host) ? 9 : 3) + minimumSecurityLevel;
    if (notAlreadyWeakened && !weakeningHosts.includes(host)) {
        const tag = -1;
        // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
        const weakenThreadCount = Math.floor(
            (ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host)) / 0.05
        );
        if (!hackingHosts.includes(host)) {
            newWeakenLogs.push(`\tWEAKENING: ${host} with ${weakenThreadCount} threads.`);
            newWeakens.push(host);
        }
        weakeningHosts.push(host);
        set('weakeningHosts', weakeningHosts);
        await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadCount, host, 'initial');
    }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    controlledHosts = get('controlledHosts');
    ns.disableLog('getServerSecurityLevel');
    ns.disableLog('getServerMinSecurityLevel');
    ns.disableLog('getServerUsedRam');
    ns.disableLog('getServerMaxRam');
    ns.disableLog('scp');
    const minHomeRamAvailable = 256;
    let count = 1;

    // Iterate over rooted hosts and kill all scripts
    for (const host of controlledHosts) {
        await killHacks(ns, host);
    }
    clearDistributorStorage();
    set('weakeningHosts', []);
    set ('hackingHosts', []);

    // for each rooted host, hack or weaken and add to array
    // save to local storage other scripts each loop

    while (true) {
        controlledHosts = get('controlledHosts');
        rootedHosts = get('rootedHosts');
        weakeningHosts = get('weakeningHosts');

        const controlledHostsWithMetadata = controlledHosts.map((host) => {
            let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
            if (host == "home") {
                availableRam = Math.max(0, availableRam - minHomeRamAvailable);
            }
            return {
                host,
                availableRam
            }
        });
        const newWeakenLogs = [];
        for (const host of rootedHosts) {
            await weakenIfNeeded(ns, host, controlledHostsWithMetadata, newWeakenLogs);
        }
        if (newWeakenLogs.length) ns.tprint(`\n${newWeakenLogs.join('\n')}`);

        if(controlledHostsWithMetadata.length) {
            for (const host of rootedHosts.reverse()) {
                await hack(ns, host, controlledHostsWithMetadata);
            } 
        }
        /*
        if(controlledHostsWithMetadata.length) {
            while (controlledHostsWithMetadata.length) {
                for (const host of rootedHosts) {
                    await hack(ns, host, controlledHostsWithMetadata, true);
                }
            }
        }
        */

        if (newHacks.length || newWeakens.length) {
            ns.tprint(`DISTRIBUTOR:
            \tLoop #${count}
            \tRooted Hosts Count: ${rootedHosts.length}
            \tWeakening Hosts Count: ${weakeningHosts.length}
            \tHacking Host Count: ${hackingHosts.length}
            \tNew Weaken Targets: ${newWeakens.join(', ')}
            \tNew Hacks Targets: ${newHacks.join(', ')}
            `);
            newHacks = [];
            newWeakens = [];
        }
        count += 1;
        set('weakeningHosts', weakeningHosts);
        set('hackingHosts', hackingHosts);
        await ns.sleep(10000);
    }
}