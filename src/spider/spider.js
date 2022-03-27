import { get, set, clearSpiderStorage } from '/spider/utils.js';
let discoveredHosts = [];
let rootedHosts = [];
let controlledHosts = [];

/** @param {import("..").NS } ns */
function prep(ns, target) {
    const requiredHackingLevel = ns.getServerRequiredHackingLevel(target);
    const currentHackingLevel = ns.getHackingLevel();
    if ( requiredHackingLevel >
        currentHackingLevel) {
        discoveredHosts.push(target);
        ns.tprint(`SPIDER: Can't hack ${target} yet, required level: ${requiredHackingLevel}`);
        return false;
    }
    if (ns.hasRootAccess(target)) {
        rootedHosts.push(target);
        return true;
    }
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
        rootedHosts.push(target);
        return ns.nuke(target);    
    } else {
        discoveredHosts.push(target);
        return false;
    }
}

/** @param {import("..").NS } ns */
async function spider(ns) {
    discoveredHosts = [];
    rootedHosts = [];
    controlledHosts = ["home"].concat(ns.getPurchasedServers());
    let hosts = [];
    const seen = ["darkweb"].concat(ns.getPurchasedServers());
    hosts.push("home");
    while (hosts.length > 0) {
        const host = hosts.shift();

        // We've already seen this host during this scan.
        if (seen.includes(host)) continue;
        seen.push(host);
        
        // We don't have root access & can't scan from this host.
        if (host !== 'home' && !prep(ns, host)) {
            continue;
        }
        hosts = hosts.concat(ns.scan(host));
    }
    const lastDiscoveredHosts = get('discoveredHosts') || [];
    if(discoveredHosts.length > lastDiscoveredHosts.length) ns.tprint(`SPIDER: ${discoveredHosts.length - lastDiscoveredHosts.length} newly discovered hosts`)
    set('discoveredHosts', discoveredHosts);
    set('rootedHosts', rootedHosts);
    // reverse() explanation: Last rooted hosts likely have more RAM so we should start with those.
    set('controlledHosts', controlledHosts.concat(rootedHosts.reverse()));
}

/** @param {import("..").NS } ns */
export async function main(ns) {
    ns.disableLog('sleep');
    ns.disableLog('getHackingLevel');
    ns.disableLog('getServerRequiredHackingLevel');
    ns.disableLog('scan');

    // Clear the LocalStorage that the spider owns.
    clearSpiderStorage();

    while (true) {
        await spider(ns);
        await ns.sleep(60000);
    }
}
