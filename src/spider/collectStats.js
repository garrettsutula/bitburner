import { get, set } from "/utils/localStorage.js";

/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target] = ns.args;
  const stats = {};
  stats.minLevel = ns.getServerMinSecurityLevel();
  stats.currentLevel = ns.getServerSecurityLevel();
  ns.print(`
  Current Security Level: ${stats.minLevel}
  Minimum Security Level: ${stats.minLevel}`);
  set(target, stats);
}
