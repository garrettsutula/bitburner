/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target] = ns.args;
  const serverMaxMoney = ns.getServerMaxMoney(target);
  while (ns.getServerMoneyAvailable(target) < 0.50 * serverMaxMoney) {
    await ns.sleep(10000);
  }
  ns.tprint(`${target} is now GROWN, ready to hack.`);
  await ns.write(`/notifications/${target}.notification.txt`, `{"host": "${target}", "status": "grown"}`, 'w');
}
