/** @param {NS} ns **/
export async function main(ns) {
  // How much RAM each purchased server will have. In this case, it'll
  // be 8GB.
  var ram = 512;
  
  let purchasedServerCount = await ns.getPurchasedServers().length - 1;
  
  // Continuously try to purchase servers until we've reached the maximum
  // amount of servers
  while (purchasedServerCount < ns.getPurchasedServerLimit()) {
      await ns.sleep(100);
      if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) {
          const hostname = await ns.purchaseServer("pserv-" + purchasedServerCount, ram);
          ns.print(`Hostname: ${hostname}`);
          await ns.scp("payload.js", hostname);
          await ns.exec("payload.js", hostname, 3);
          ++purchasedServerCount;
      }
  }
  }