import { execa } from "/spider/exec.js";
const scriptPaths = {
    touch: "/spider/touch.js",
    hack: "/spider/hack.js",
    weaken: "/spider/weaken.js",
    watchSecurity: "/spider/watch-security.js",
    spider: "/spider/spider.js",
}
const spiderHostsFile = "/spider/spider_hacked_hosts.txt";
const currentWeakenTargets = new Set();
const currentHackTargets = new Set();

/** @param {import("..").NS } ns */
function getSpiderData(ns) {
    return ns.read(spiderHostsFile).split("\n");
}

/** @param {import("..").NS } ns */
export function signal(ns, host, status) {
  ns.tprint(`Notification: ${host} new status "${status.toUpperCase()}"`);
  ns.exec(scriptPaths.touch, "home", 1, `/notifications/${host}.notification.txt`, host, status);
}

/** @param {import("..").NS } ns */
function consumeSignal(ns) {
    const notificationsPaths = ns.ls('home', '.notification.txt');
    const hostNotifications = [];
    if (notificationsPaths.length) {
        notificationsPaths.forEach((path) => {
            const hostNotification = JSON.parse(ns.read(path).split("\n")[0]);
            hostNotifications.push(hostNotification);
            ns.rm(path);
        });
    }
    return hostNotifications;
}

/** @param {import("..").NS } ns */
async function awaitSignal(ns) {
    let hostNotifications = [];
    while (hostNotifications.length === 0) {
        await ns.sleep(10000);
        hostNotifications = consumeSignal(ns);
    } 
    return hostNotifications;
}

/** 
 * @param {import("..").NS } ns 
 * @param {string} host - target hostname
 * */
async function killHacks(ns, host) {
    ns.scriptKill(scriptPaths.hack, host);
    ns.scriptKill(scriptPaths.weaken, host);
    ns.scriptKill(scriptPaths.watchSecurity, host);
    if (host !== "home") {
        ns.killall(host); // temporary:
        await ns.scp(ns.ls("home", "spider"), "home", host);
    }
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

/** 
 * @param {import("..").NS } ns - netburner module
 * @param {string[]} targets - list of hostnames to target 
 * @param {string[]} hostnames - list of hostnames that can run weaken & hack processes
 * @param {string[]} hostmaxram - matching list of available ram to run weaken & hack processes.
 */
async function doHacks(ns, targets = [], hostnames, hostmaxram) {
    const newHackTargets = [];
    const newWeakenTargets = [];
    // Weaken targets in rough order weakest -> hardest.
    const weakenTargets = [...targets];
    while (weakenTargets.length > 0 && hostnames.length > 0) {
        const currentTarget = weakenTargets.shift();
        const alreadyWeakened = ns.getServerSecurityLevel(currentTarget) <= 3 + ns.getServerMinSecurityLevel(currentTarget);
        // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
        const weakenCount = Math.floor(
            (ns.getServerSecurityLevel(currentTarget) - ns.getServerMinSecurityLevel(currentTarget)) / 0.05
            );
        const tag = -1;
        if (!alreadyWeakened && !currentWeakenTargets.has(currentTarget)) {
            await scheduleOn(ns, hostnames, hostmaxram, scriptPaths.weaken, weakenCount, currentTarget, tag);
            // Watch for the security level on this host to get low then notify this script to set hacking up.
            currentWeakenTargets.add(currentTarget);
            newWeakenTargets.push(currentTarget);
            ns.run(scriptPaths.watchSecurity, 1, currentTarget);
        }
    }
    if (newWeakenTargets.length > 0) ns.tprint(`Now Weakening: ${newWeakenTargets.join(", ")}`);
    if (weakenTargets.length > 0) {
        ns.tprint(`${weakenTargets.length} remaining targets to weaken.`);
    }

    // If we have resources left, hack targets in rough order hardest -> weakest
    // 6:1 hack:weaken ratio should keep the server weakened long-term.
    let currentTarget;
    while (targets.length > 0 && hostnames.length > 0) {
        currentTarget = targets.pop();
        for (let i = 0; hostnames.length > 0 && i < 20; i += 1) {
            await scheduleOn(ns, hostnames, hostmaxram, scriptPaths.weaken, 8, currentTarget, i);
            await scheduleOn(ns, hostnames, hostmaxram, scriptPaths.hack, 45, currentTarget, i);
        }
        newHackTargets.push(currentTarget);
    }
    if(newHackTargets.length) ns.tprint(`Now Hacking: ${newHackTargets.join(", ")}`);
    // Return remaining targets to caller, if any.
    if (targets.length > 0 && currentTarget) {
        targets.push(currentTarget);
        ns.tprint(`${targets.length} remaining targets to hack.`);
    } else {
        ns.tprint('All targets hacked.')
    }
    const remainingRam = hostmaxram.reduce((acc, ram) => acc + ram, 0);
    if (remainingRam < 512) ns.tprint(`WARNING: Low RAM, ${remainingRam}GB available across all hosts.`);
    return targets;
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    const minHomeRamAvailable = 256;
    let hostNotifications = [];
    let firstRun = true;
    let targets = [];

    // Clear notification folder on startup to prepare for first iteration.
    consumeSignal(ns);

    while (true) {
        // Get target list from spider on the first iteration, remaining targets subsequent iterations.
        if (firstRun) {
            ns.exec(scriptPaths.spider, "home", 1);
            while(!ns.fileExists(spiderHostsFile)) await ns.sleep(250);
            ns.tprint('First iteration, getting targets from spider hacked hosts file.');
            targets = getSpiderData(ns);
            
        }
        ns.tprint(`# of Targets: ${targets.length}`);
        // Set host list, process scheduling starts at the beginning of the array.
        const hosts = ["home"].concat(ns.getPurchasedServers(), getSpiderData(ns));
        ns.tprint(`# of Hosts: ${hosts.length}`);
        
        // If this is the first iteration of the loop, kill all running scripts.
        if (firstRun) {
            for (const host of hosts) {
                await killHacks(ns, host);
            }
            await ns.sleep(1000);
        }
        
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
        targets = await doHacks(ns, targets, hosts, ram);
        // Await notifications of newly weakened or hacked servers to continue.
        hostNotifications = await awaitSignal(ns);
        // If the server isn't in our list of remaining targets, add it.
        hostNotifications.forEach((notification) => {
            const {host, status} = notification;
            if(!targets.includes(host)) {
                targets.push(host);
                console.log(`Added ${host} to target list.`);
            }
            switch (status) {
                case 'weakened':
                default:
                    if(currentWeakenTargets.has(host)) currentWeakenTargets.delete(host);
            }
        });
        firstRun = false;
    }
}












