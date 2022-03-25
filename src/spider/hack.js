/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target, tag] = ns.args;
  const sm = ns.getServerMaxMoney(target);
  while (true) {
      if (ns.getServerMoneyAvailable(target) < 0.95 * sm) await ns.grow(target);
      else await ns.hack(target);
  }
}
