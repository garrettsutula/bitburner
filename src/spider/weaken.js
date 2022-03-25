/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target, tag] = ns.args;
  var securityThresh = ns.getServerMinSecurityLevel(target) + 3;
  while ((ns.getServerSecurityLevel(target) > securityThresh) || tag !== -1) {
    await ns.weaken(target);
  }
}