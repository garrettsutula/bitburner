/** @param {NS} ns **/
export async function main(ns) {
	const purchasedServers = await ns.getPurchasedServers();
	ns.print(JSON.stringify(purchasedServers));
	for (const server of purchasedServers) {
        await ns.scp("payload.js", server);
        await ns.exec("payload.js", server, 3);
	}
}