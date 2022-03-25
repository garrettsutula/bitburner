async function buy(app) {
  if (ns.fileExists(app) == false) {
      const terminalInput = document.getElementById("terminal-input")
      const handler = Object.keys(terminalInput)[1]
      terminalInput.value = output
      terminalInput[handler].onChange({ target: terminalInput })
      terminalInput[handler].onKeyDown({ keyCode: 13, preventDefault: () => null })
  }
}

/** @param {import(".").NS } ns */
export async function main(ns) {
  buy("AutoLink.exe");
  buy("BruteSSH.exe");
  buy("DeepscanV1.exe");
  buy("DeepscanV2.exe");
  buy("FTPCrack.exe");
  buy("Formulas.exe");
  buy("HTTPWorm.exe");
  buy("NUKE.exe");
  buy("SQLInject.exe");
  buy("ServerProfiler.exe");
  buy("relaySMTP.exe");

  ns.exit()
}