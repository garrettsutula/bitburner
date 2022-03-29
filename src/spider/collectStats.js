/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target] = ns.args;
  const stats = {};
  stats.minLevel = ns.getServerMinSecurityLevel(target);
  stats.currentLevel = ns.getServerSecurityLevel(target);
  stats.maxCash = ns.getServerMaxMoney(target);
  stats.currentCash = ns.getServerMoneyAvailable(target);
  ns.print(`
  Current Security Level: ${stats.minLevel}
  Minimum Security Level: ${stats.minLevel}`);
  ns.write(`/stats/${target}.txt`, JSON.stringify(stats), 'w');
}
