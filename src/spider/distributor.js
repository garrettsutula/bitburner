import { execa } from "/spider/exec.js";

/** @param {import("..").NS } ns */
function getSpiderData(ns) {
    return ns.read("spider_data.txt").split("\n");
}

/** @param {import("..").NS } ns */
export function signal(ns, host, status) {
  ns.tprint(`Notification: ${host} new status "${status.toUpperCase()}"`);
  ns.exec("/spider/touch.js", "home", 1, `/notifications/${host}.notification.txt`, host, status);
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
    ns.scriptKill("hack.js", host);
    ns.scriptKill("weaken.js", host);
    if (host !== "home") {
        ns.killall(host); // temporary:
        await ns.scp(ns.ls("home", "spider"), "home", host);
    } else {
        ns.scriptKill('weaken.js', 'home');
        ns.scriptKill('hack.js', 'home');
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
async function doHacks(ns, targets, hostnames, hostmaxram) {
    // Weaken targets in rough order weakest -> hardest.
    const weakenTargets = [...targets];
    while (weakenTargets.length > 0 && hostnames.length > 0) {
        const currentTarget = weakenTargets.shift();
        // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
        const weakenCount = Math.floor(
            (ns.getServerSecurityLevel(currentTarget) - ns.getServerMinSecurityLevel(currentTarget)) / 0.05
            );
        ns.tprint(`${currentTarget} needs ${weakenCount} threads.`);
        const tag = -1;
        if (weakenCount > 0) {
            await scheduleOn(ns, hostnames, hostmaxram, "/spider/weaken.js", weakenCount, currentTarget, tag);
            // Watch for the security level on this host to get low then notify this script to set hacking up.
            ns.run("/spider/watch-security.js", 1, currentTarget);
        }
    }

    // If we have resources left, hack targets in rough order hardest -> weakest
    // 6:1 hack:weaken ratio should keep the server weakened long-term.
    let currentTarget;
    while (targets.length > 0 && hostnames.length > 0) {
        currentTarget = targets.pop();
        ns.tprint(`Hacking ${currentTarget}`);
        for (let i = 0; hostnames.length > 0 && i < 15; i += 1) {
            await scheduleOn(ns, hostnames, hostmaxram, "/spider/weaken.js", 1, currentTarget, i);
            await scheduleOn(ns, hostnames, hostmaxram, "/spider/hack.js", 6, currentTarget, i);
        }
    }
    // Return remaining targets to caller, if any.
    if (targets.length > 0) {
        targets.push(currentTarget);
        ns.tprint(`Remaining targets to hack: ${targets.length}`);
        return targets;
    } else {
        ns.tprint('All targets hacked.')
    }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    const minHomeRamAvailable = 256;
    let hostNotifications = [];
    let firstRun = true;
    let targets = [];

    // Clear notification folder on startup to prepare for first iteration.
    await consumeSignal(ns);

    while (true) {
        // Get target list from spider on the first iteration, remaining targets subsequent iterations.
        if (firstRun) {
            targets = getSpiderData(ns);
            ns.tprint(`# of Targets: ${targets.length}`);
        }
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
        hostNotifications.forEach(({server, status}) => {
            if(!targets.includes(server)) {
                targets.push(server);
                console.log(`Added ${server} to target list.`);
            }
        });
    }
}












