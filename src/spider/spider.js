import { signal } from "/spider/distributor.js";

const spiderDataFile = "spider_data.txt";

/** @param {import("..").NS } ns */
function prep(ns, target) {
    const requiredHackingLevel = ns.getServerRequiredHackingLevel(target);
    const currentHackingLevel = ns.getHackingLevel();
    if ( requiredHackingLevel >
        currentHackingLevel) {
        ns.print(`Can't hack ${target} yet, required level: ${requiredHackingLevel}`);
        return false;
    }
    if (ns.hasRootAccess(target)) return true;
    
    function can(action) {
        return ns.fileExists(action + ".exe", "home");
    }
    
    let ports = 0;
    if (can("brutessh")) { ns.brutessh(target); ports += 1; }
    if (can("ftpcrack")) { ns.ftpcrack(target); ports += 1; }
    if (can("relaysmtp")) { ns.relaysmtp(target); ports += 1; }
    if (can("httpworm")) { ns.httpworm(target); ports += 1; }
    if (can("sqlinject")) { ns.sqlinject(target); ports += 1; }
    
    if (ports >= ns.getServerNumPortsRequired(target)) {
        return ns.nuke(target);    
    } else {
        return false;
    }
}

/** @param {import("..").NS } ns */
async function spider(ns) {
    let firstRun = true;
    let hosts = ["home"];
    let hacked = ns.read(spiderDataFile).split("\n");
    const seen = ["darkweb"].concat(ns.getPurchasedServers());
    if (hacked.length == 1 && hacked[0] === "") hacked = [];

    while (hosts.length > 0) {
        const host = hosts.shift();

        // We've already seen this host during this scan.
        if (seen.includes(host)) continue;
        seen.push(host);
        
        if (!prep(ns, host)) {
            continue;
        }
        
        if (host != "home" && !hacked.includes(host)) {
            hacked.push(host);
            if (!firstRun) signal(ns, host, "hacked");
        }
        
        hosts = hosts.concat(ns.scan(host));
    }
    
    await ns.write(spiderDataFile, hacked.join("\n"), "w");
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    ns.disableLog('getHackingLevel');
    ns.disableLog('getServerRequiredHackingLevel');
    ns.disableLog('scan');

    await ns.sleep(1000);
    ns.rm(spiderDataFile);

    while (true) {
        await spider(ns);
        await ns.sleep(60000);
    }
}
