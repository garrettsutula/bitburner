/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target] = ns.args;
  const securityThresh = ns.getServerMinSecurityLevel(target) + 3;
  while ((ns.getServerSecurityLevel(target) > securityThresh)) {
    await ns.sleep(5000);
  }
  ns.tprint(`${target} is now WEAK, ending dedicated weaken process.`);
  await ns.write(`/notifications/${target}.notification.txt`, `{"host": "${target}", "status": "weakened"}`, 'w');
}
