/** @param {NS} ns * */
export async function main(ns) {
  let counter = 1;
  while (true) {
    ns.commitCrime('mug someone');
    await ns.sleep(65000);
    counter += 1;
  }
}
