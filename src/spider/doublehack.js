import { get, uuidv4 } from "/spider/utils.js"
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
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.weaken, 512, host, uuidv4());
            await scheduleOn(ns, controlledHostsWithMetadata, scriptPaths.hack, 2880, host, uuidv4());
        }
        hackingHosts.push(host);
        newHacks.push(host);
    }
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    ns.disableLog('getServerSecurityLevel');
    ns.disableLog('getServerMinSecurityLevel');
    ns.disableLog('getServerUsedRam');
    const minHomeRamAvailable = 256;


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

        if(controlledHostsWithMetadata.length) {
            for (const host of rootedHosts) {
                await hack(ns, host, controlledHostsWithMetadata, true);
            } 
        }
}