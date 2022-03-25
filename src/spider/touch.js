/** @param {import("..").NS } ns */
export async function main(ns) {
  const [ fileName, host, status ] = ns.args;
  await ns.write(fileName, JSON.stringify({host, status}), "w");
}
