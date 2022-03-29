let discoveredHosts = [];
let rootedHosts = [];
let controlledHosts = [];

/** @param {import("..").NS } ns */
function prep(ns, target) {
  const requiredHackingLevel = ns.getServerRequiredHackingLevel(target);
  const currentHackingLevel = ns.getHackingLevel();
  if (requiredHackingLevel
        > currentHackingLevel) {
    discoveredHosts.push(target);
    ns.tprint(`SPIDER: Can't hack ${target} yet, required level: ${requiredHackingLevel}`);
    return false;
  }
  if (ns.hasRootAccess(target)) {
    rootedHosts.push(target);
    return true;
  }
  function can(action) {
    return ns.fileExists(`${action}.exe`, 'home');
  }

  let ports = 0;
  if (can('brutessh')) { ns.brutessh(target); ports += 1; }
  if (can('ftpcrack')) { ns.ftpcrack(target); ports += 1; }
  if (can('relaysmtp')) { ns.relaysmtp(target); ports += 1; }
  if (can('httpworm')) { ns.httpworm(target); ports += 1; }
  if (can('sqlinject')) { ns.sqlinject(target); ports += 1; }

  if (ports >= ns.getServerNumPortsRequired(target)) {
    rootedHosts.push(target);
    return ns.nuke(target);
  }
  discoveredHosts.push(target);
  return false;
}

/** @param {import("..").NS } ns */
async function spider(ns) {
  const purchasedServers = ns.getPurchasedServers();
  discoveredHosts = [];
  rootedHosts = [];
  let hosts = [];
  const seen = ['darkweb'].concat(purchasedServers);
  hosts.push('home');
  while (hosts.length > 0) {
    controlledHosts = ['home'].concat(purchasedServers);
    const host = hosts.shift();

    if (!seen.includes(host)) {
      seen.push(host);
      // If we can root the host, scan and add the hosts we find to the hosts crawl list.
      if (host !== 'home' && prep(ns, host)) {
        hosts = hosts.concat(ns.scan(host));
      }
    }
  }

  await ns.write('/data/discoveredHosts.txt', JSON.stringify(discoveredHosts), 'w');
  await ns.write('/data/rootedHosts.txt', JSON.stringify(rootedHosts), 'w');
  await ns.write('/data/controlledHosts.txt', JSON.stringify(controlledHosts.concat(rootedHosts.reverse())), 'w');
}

/** @param {import("..").NS } ns */
export async function main(ns) {
  ns.disableLog('sleep');
  ns.disableLog('getHackingLevel');
  ns.disableLog('getServerRequiredHackingLevel');
  ns.disableLog('scan');

  // Clear the LocalStorage that the spider owns.
  // clearSpiderStorage();

  while (true) {
    await spider(ns);
    await ns.sleep(60000);
  }
}
