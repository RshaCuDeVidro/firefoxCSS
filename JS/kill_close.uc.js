// ==UserScript==
// @name           PWND kill close
// @description    Anima o fechamento da aba como "process killed" (flash + colapso)
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] kill_close carregado");

  const gBrowser = window.gBrowser;
  if (!gBrowser || gBrowser.__pwndKillClose) {
    return;
  }
  gBrowser.__pwndKillClose = true;

  let shuttingDown = false;
  try {
    const obs = {
      observe() {
        shuttingDown = true;
      },
    };
    Services.obs.addObserver(obs, "quit-application-granted");
    window.addEventListener(
      "unload",
      () => {
        try {
          Services.obs.removeObserver(obs, "quit-application-granted");
        } catch (e) {}
      },
      { once: true }
    );
  } catch (e) {}

  const origRemoveTab = gBrowser.removeTab;
  const ANIM_MS = 160;

  gBrowser.removeTab = function (tab, opts) {
    try {
      const bulk =
        gBrowser._removingTabs && gBrowser._removingTabs.size > 2;
      if (
        tab &&
        tab.hasAttribute &&
        !tab.hasAttribute("p-killed") &&
        !shuttingDown &&
        !window.closed &&
        !bulk
      ) {
        tab.setAttribute("p-killed", "true");
        window.setTimeout(() => {
          try {
            origRemoveTab.call(gBrowser, tab, opts);
          } catch (e) {}
        }, ANIM_MS);
        return;
      }
    } catch (e) {}
    return origRemoveTab.call(gBrowser, tab, opts);
  };
})();
