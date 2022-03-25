/** @param {NS} ns **/
export async function main(ns) {
  function myMoney() {
      return ns.getServerMoneyAvailable("home");
  }
  
  ns.disableLog("getServerMoneyAvailable");
  ns.disableLog("sleep");
  
  var cnt = 16;
  
  while(ns.hacknet.numNodes() < cnt) {
      const res = ns.hacknet.purchaseNode();
      ns.print("Purchased ns.hacknet Node with index " + res);
  };
  
  for (var i = 0; i < cnt; i++) {
      while (ns.hacknet.getNodeStats(i).level <= 80) {
          var cost = ns.hacknet.getLevelUpgradeCost(i, 10);
          while (myMoney() < cost) {
              ns.print("Need $" + cost + " . Have $" + myMoney());
              ns.sleep(3000);
          }
          const res = ns.hacknet.upgradeLevel(i, 10);
      };
  };
  
  ns.print("All nodes upgraded to level 80");
  
  for (var i = 0; i < cnt; i++) {
      while (ns.hacknet.getNodeStats(i).ram < 16) {
          var cost = ns.hacknet.getRamUpgradeCost(i, 2);
          while (myMoney() < cost) {
              ns.print("Need $" + cost + " . Have $" + myMoney());
              ns.sleep(3000);
          }
          const res = ns.hacknet.upgradeRam(i, 2);
      };
  };
  
  ns.print("All nodes upgraded to 16GB RAM");
  
  for (var i = 0; i < cnt; i++) {
      while (ns.hacknet.getNodeStats(i).cores < 8) {
          var cost = ns.hacknet.getCoreUpgradeCost(i, 1);
          while (myMoney() < cost) {
              ns.print("Need $" + cost + " . Have $" + myMoney());
              ns.sleep(3000);
          }
          const res = ns.hacknet.upgradeCore(i, 1);
      };
  };
  
  ns.print("All nodes upgraded to 8 cores");
  }