import { get, set } from "/spider/utils.js"
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
        await ns.scp(ns.ls("home", "spider"), "home", host);
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
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, 512, host, i);
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.hack, 2880, host, i);
        }
        hackingHosts.push(host);
        newHacks.push(host);
    }
}

async function weakenIfNeeded(ns, host, controlledHostsWithMetadata, newWeakenLogs) {
    const notAlreadyWeakened = ns.getServerSecurityLevel(host) > 5 + ns.getServerMinSecurityLevel(host);
    if (notAlreadyWeakened && !weakeningHosts.includes(host)) {
        const tag = -1;
        // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
        const weakenThreadCount = Math.floor(
            (ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host)) / 0.05
        );
        newWeakenLogs.push(`\tWEAKENING: ${host} with ${weakenThreadCount} threads.`);
        weakeningHosts.push(host);
        newWeakens.push(host);
        await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadCount, host, tag);
        // Watch for the security level on this host to get low then notify this script to set hacking up.
        ns.run(scriptPaths.watchSecurity, 1, host);
    }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    ns.disableLog('getServerSecurityLevel');
    ns.disableLog('getServerMinSecurityLevel');
    const minHomeRamAvailable = 256;
    let count = 1;

    // Iterate over rooted hosts and kill all scripts
    for (const host of controlledHosts) {
        await killHacks(ns, host);
    }
    set('weakeningHosts', weakeningHosts);
    set ('hackingHosts', hackingHosts);

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
            for (const host of rootedHosts) {
                await hack(ns, host, controlledHostsWithMetadata);
            } 
        }
        /*
        if(controlledHostsWithMetadata.length) {
            while (controlledHostsWithMetadata.length) {
                for (const host of rootedHosts) {
                    await hack(ns, host, controlledHostsWithMetadata);
                }
            }
        }
        */
        set('weakeningHosts', weakeningHosts);
        set('hackingHosts', hackingHosts);
        count += 1;
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
        await ns.sleep(10000);
    }
}