/** @param {import("..").NS } ns */
export async function main(ns) {
  const [ target ] = ns.args;
  while (ns.getServerSecurityLevel(target) >= 3 + ns.getServerMinSecurityLevel(target)) {
    await ns.sleep(10000);
  }
}
