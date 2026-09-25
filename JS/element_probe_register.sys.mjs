// ==UserScript==
// @name           PWND ElementProbe registrar
// @description    Registra o actor ElementProbe para paginas web (o actor do loader nao cobre web)
// ==/UserScript==

try {
  ChromeUtils.registerWindowActor("ElementProbe", {
    parent: {
      esModuleURI:
        "chrome://userscripts/content/ElementProbe/ElementProbeParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "chrome://userscripts/content/ElementProbe/ElementProbeChild.sys.mjs",
    },
    matches: ["*://*/*", "file:///*"],
    allFrames: true,
    includeChrome: false,
  });
  console.log("[pwnd] ElementProbe actor registrado (web)");
} catch (e) {
  console.error("[pwnd] falha ao registrar ElementProbe:", e);
}
