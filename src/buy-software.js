/** @param {import(".").NS } ns */
async function buy(ns, app) {
  if (ns.fileExists(app) === false) {
    const terminalInput = document.getElementById('terminal-input');
    const handler = Object.keys(terminalInput)[1];
    // eslint-disable-next-line no-undef
    terminalInput.value = output;
    terminalInput[handler].onChange({ target: terminalInput });
    terminalInput[handler].onKeyDown({ keyCode: 13, preventDefault: () => null });
  }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
  buy(ns, 'AutoLink.exe');
  buy(ns, 'BruteSSH.exe');
  buy(ns, 'DeepscanV1.exe');
  buy(ns, 'DeepscanV2.exe');
  buy(ns, 'FTPCrack.exe');
  buy(ns, 'Formulas.exe');
  buy(ns, 'HTTPWorm.exe');
  buy(ns, 'NUKE.exe');
  buy(ns, 'SQLInject.exe');
  buy(ns, 'ServerProfiler.exe');
  buy(ns, 'relaySMTP.exe');

  ns.exit();
}
