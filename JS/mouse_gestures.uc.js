// ==UserScript==
// @name           PWND mouse gestures
// @description    Gestos com o botao direito (L/R/U/D) com trilha neon; ex: DR fecha aba, UD recarrega
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] mouse_gestures carregado");

  const gBrowser = window.gBrowser;
  if (!gBrowser) {
    return;
  }

  function actor() {
    try {
      const A = window.UC_API && UC_API.Experimental.WindowActors;
      return A ? A.get("ElementProbe") : null;
    } catch (e) {
      return null;
    }
  }

  function scrollTo(y) {
    const a = actor();
    if (a) {
      a.sendQuery("scrollToY", { y }).catch(() => {});
    }
  }

  const ACTIONS = {
    L: () => gBrowser.goBack(),
    R: () => gBrowser.goForward(),
    U: () => scrollTo(0),
    D: () => scrollTo(1e9),
    DR: () => gBrowser.removeCurrentTab(),
    UD: () => gBrowser.reloadTab(gBrowser.selectedTab),
    DU: () => gBrowser.duplicateTab(gBrowser.selectedTab),
    LR: () => window.openTrustedLinkIn("about:newtab", "tab"),
    RL: () => gBrowser.undoCloseTab(),
  };

  window.addEventListener(
    "pwnd-page",
    (e) => {
      const d = e.detail;
      if (!d || d.type !== "page:gesture") {
        return;
      }
      const bc = gBrowser.selectedBrowser.browsingContext;
      if (bc && d.bcid !== bc.id) {
        return;
      }
      const act = ACTIONS[d.pattern];
      if (act) {
        try {
          act();
        } catch (err) {}
      }
    },
    false
  );
})();
