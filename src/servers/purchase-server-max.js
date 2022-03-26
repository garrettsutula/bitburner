/** @param {import("..").NS } ns */
export async function main(ns) {
    const intervalSeconds = 30 * 1000;
    ns.disableLog("sleep");
    ns.disableLog("getServerMoneyAvailable");
    var ram = 1048576; // It's over 9000

    let purchasedServerCount = ns.getPurchasedServers().length - 1;

    while (purchasedServerCount >= ns.getPurchasedServerLimit()) {
        if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) {
            const hostname = ns.purchaseServer(`gserv-${purchasedServerCount}`, ram);
            ns.tprint(`Purchased server: ${hostname}@${ram/1000/1000}PB`);
            purchasedServerCount += 1;
        }
        await ns.sleep(intervalSeconds);
    }
}