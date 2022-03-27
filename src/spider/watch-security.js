import { get, set } from "/spider/utils.js"

/** @param {import("..").NS } ns */
export async function main(ns) {
  const [ target ] = ns.args;
  while (ns.getServerSecurityLevel(target) >= 3 + ns.getServerMinSecurityLevel(target)) {
    await ns.sleep(10000);
  }
  set('weakeningHosts', get('weakeningHosts').filter((host) => host !== target));
}
