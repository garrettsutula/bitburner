import { execa } from "/spider/exec.js";
import { uuidv4 } from '/utils/uuid.js';
const scriptPaths = {
    touch: "/spider/touch.js",
    hack: "/spider/hack.js",
    weaken: "/spider/weaken.js",
    watchSecurity: "/spider/watch-security.js",
    spider: "/spider/spider.js",
}
const spiderHostsFile = "/spider/spider_hacked_hosts.txt";

/** @param {import("..").NS } ns */
function getSpiderData(ns) {
  return ns.read(spiderHostsFile).split("\n");
}

/** 
 * @param {import("..").NS } ns 
 * @param {string[]} hostnames - list of hostnames that can run weaken & hack processes
 * @param {string[]} hostmaxram - matching list of available ram to run weaken & hack processes.
 * @param {string} jobScript - script to run
 * @param {number} jobThreads - number of threads to run
 * @param {string} jobTarget - target hostname
 * @param {number} tag - not really used yet, only used for weaken scripts see weaken.js
*/
async function scheduleOn(ns, hostNames, hostMaxRam, jobScript, jobThreads, jobTarget, tag) {
  const ramPerTask = ns.getScriptRam(jobScript, "home");

  while (jobThreads > 0 && hostNames.length > 0) {
      const numThisHost = Math.min(Math.floor(hostMaxRam[0] / ramPerTask), jobThreads);
      
      jobThreads -= numThisHost;
      const args = [jobScript, hostNames[0], numThisHost, jobTarget, tag];
      if (numThisHost > 0) await execa(ns, args);

      if (jobThreads > 0) {
          hostNames.shift();
          hostMaxRam.shift();
      } else {
          hostMaxRam[0] = hostMaxRam[0] - numThisHost * ramPerTask;
      }
  }
}

async function doHacks(ns, targets = [], hostnames, hostmaxram) {
  const newHackTargets = [];

  let currentTarget;
  while (targets.length > 0 && hostnames.length > 0) {
      currentTarget = targets.pop();
      for (let i = 0; hostnames.length > 0 && i < 5; i += 1) {
          const threadId = uuidv4();
          await scheduleOn(ns, hostnames, hostmaxram, scriptPaths.weaken, 64, currentTarget, threadId);
          await scheduleOn(ns, hostnames, hostmaxram, scriptPaths.hack, 360, currentTarget, threadId);
      }
      newHackTargets.push(currentTarget);
  }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
  const minHomeRamAvailable = 256;
  ns.exec(scriptPaths.spider, "home", 1);
  while(!ns.fileExists(spiderHostsFile)) await ns.sleep(250);
  ns.tprint('First iteration, getting targets from spider hacked hosts file.');
  const targets = getSpiderData(ns);
  // Set host list, process scheduling starts at the beginning of the array.
  const hosts = ["home"].concat(ns.getPurchasedServers(), getSpiderData(ns));
  ns.tprint(`# of Hosts: ${hosts.length}`);
  
  // Compute available RAM on hosts, reserve extra for other scrips running on home.
  const ram = [];
  for (const host of hosts) {
      let hostAvailableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
      if (host == "home") {
          hostAvailableRam = Math.max(0, hostAvailableRam - minHomeRamAvailable);
      }
      ram.push(hostAvailableRam);
  }
  // Targets we couldn't schedule due to resource limitations saved back for next iteration.
  await doHacks(ns, targets, hosts, ram);

}


