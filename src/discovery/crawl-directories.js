/** @param {import("..").NS } ns */
export async function main(ns) {
	let i = ns.args[0] || 0;
	var connectedServers = await ns.scan();
	if (i > 0) connectedServers.shift();
	const allFiles = [];
	for (const server of connectedServers) {
		const files = ns.ls(server);
		const specialFiles = files.filter((file) => !file.includes('.js'));
		allFiles.push(`*****Server: ${server}`, specialFiles.join("\n"));

	}
	ns.write('file-list.txt', allFiles.join("\r\n"), 'w');
}