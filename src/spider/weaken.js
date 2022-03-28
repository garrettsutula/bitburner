import { get, set } from "/utils/localStorage.js";

/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target, tag] = ns.args;
  var securityThresh = ns.getServerMinSecurityLevel(target) + 3;
  while ((ns.getServerSecurityLevel(target) > securityThresh) || tag !== 'initial') {
    await ns.weaken(target);
  }
  set('weakeningHosts', get('weakeningHosts').filter((host) => host !== target));
}
