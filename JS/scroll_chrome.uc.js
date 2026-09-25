// ==UserScript==
// @name           PWND scroll chrome
// @description    Esconde a toolbar/abas ao descer a pagina; volta ao subir ou encostar no topo
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] scroll_chrome carregado");

  const doc = document;
  const root = doc.documentElement;
  const gBrowser = window.gBrowser;
  if (!gBrowser) {
    return;
  }

  const XHTML = "http://www.w3.org/1999/xhtml";
  let zone = doc.getElementById("p-topzone");
  if (!zone) {
    zone = doc.createElementNS(XHTML, "div");
    zone.id = "p-topzone";
    doc.documentElement.appendChild(zone);
  }

  let lastY = 0;
  let state = null;

  function setState(s) {
    if (state === s) {
      return;
    }
    state = s;
    if (s) {
      root.setAttribute("p-scroll", s);
    } else {
      root.removeAttribute("p-scroll");
    }
  }

  function measure() {
    const tb = doc.getElementById("navigator-toolbox");
    if (tb) {
      root.style.setProperty("--p-tb-h", tb.getBoundingClientRect().height + "px");
    }
  }

  function selectedBC() {
    try {
      return gBrowser.selectedBrowser.browsingContext;
    } catch (e) {
      return null;
    }
  }

  function onPage(e) {
    const d = e.detail;
    if (!d || d.type !== "page:scroll") {
      return;
    }
    const bc = selectedBC();
    if (!bc || d.bcid !== bc.id) {
      return;
    }
    measure();
    const y = d.y;
    if (y <= 8) {
      lastY = y;
      setState(null);
      return;
    }
    if (y > lastY + 2) {
      setState("down");
    } else if (y < lastY - 2) {
      setState("up");
    }
    lastY = y;
  }

  window.addEventListener("pwnd-page", onPage, false);
  window.addEventListener("resize", measure, false);
  zone.addEventListener(
    "mouseenter",
    () => {
      measure();
      setState("up");
    },
    false
  );
  gBrowser.tabContainer.addEventListener(
    "TabSelect",
    () => {
      lastY = 0;
      setState(null);
      measure();
    },
    false
  );
  window.addEventListener("load", measure, { once: true });
  measure();
})();
