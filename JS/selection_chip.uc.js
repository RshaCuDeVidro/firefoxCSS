// ==UserScript==
// @name           PWND selection chip
// @description    Chip flutuante ao selecionar texto: palavras/tempo + copiar, citar, buscar, traduzir
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] selection_chip carregado");

  const doc = document;
  const gBrowser = window.gBrowser;
  if (!gBrowser || doc.getElementById("p-sel-chip")) {
    return;
  }

  const XHTML = "http://www.w3.org/1999/xhtml";
  const chip = doc.createElementNS(XHTML, "div");
  chip.id = "p-sel-chip";
  const info = doc.createElementNS(XHTML, "span");
  info.className = "p-sel-info";
  chip.appendChild(info);
  doc.documentElement.appendChild(chip);

  const current = { text: "", words: 0, url: "", title: "" };

  function copy(text) {
    try {
      Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper)
        .copyString(text);
    } catch (e) {}
  }

  function openUrl(url, where) {
    try {
      window.openTrustedLinkIn(url, where || "current");
    } catch (e) {
      try {
        gBrowser.addTab(url, {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
      } catch (e2) {}
    }
  }

  async function searchText(text) {
    let url = null;
    try {
      const engine = await Services.search.getDefault();
      const sub = engine.getSubmission(text, null, "searchbar");
      url = sub && sub.uri && sub.uri.spec;
    } catch (e) {}
    if (!url) {
      url = "https://duckduckgo.com/?q=" + encodeURIComponent(text);
    }
    openUrl(url, "current");
  }

  function addButton(label, fn) {
    const b = doc.createElementNS(XHTML, "div");
    b.className = "p-sel-btn";
    b.textContent = label;
    b.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      },
      true
    );
    chip.appendChild(b);
    return b;
  }

  addButton("copiar", () => {
    copy(current.text);
    hide();
  });
  addButton("citar", () => {
    const quoted = current.text
      .split("\n")
      .map((l) => "> " + l)
      .join("\n");
    const src = current.title
      ? `\n\n— [${current.title}](${current.url})`
      : `\n\n— ${current.url}`;
    copy(quoted + src);
    hide();
  });
  addButton("buscar", () => {
    const t = current.text.slice(0, 200);
    hide();
    searchText(t);
  });
  addButton("traduzir", () => {
    const url =
      "https://translate.google.com/?sl=auto&tl=pt&text=" +
      encodeURIComponent(current.text.slice(0, 1500));
    hide();
    openUrl(url, "tab");
  });

  function hide() {
    chip.removeAttribute("data-on");
  }

  function position(rect) {
    const b = gBrowser.selectedBrowser;
    const br = b.getBoundingClientRect();
    let z = 1;
    try {
      z = window.ZoomManager.getZoomForBrowser(b);
    } catch (e) {}
    const left = br.left + rect.x * z;
    const top = br.top + rect.y * z;
    const h = rect.height * z;
    const cw = chip.getBoundingClientRect().width || 260;
    let x = Math.max(4, Math.min(left, window.innerWidth - cw - 8));
    let y = top - 38;
    if (y < 4) {
      y = top + h + 8;
    }
    chip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function onPage(e) {
    const d = e.detail;
    if (!d || d.type !== "page:selection") {
      return;
    }
    const bc = gBrowser.selectedBrowser.browsingContext;
    if (bc && d.bcid !== bc.id) {
      return;
    }
    if (!d.active) {
      hide();
      return;
    }
    current.text = d.text || "";
    current.words = d.words || 0;
    try {
      current.url = gBrowser.currentURI.spec;
      current.title = gBrowser.contentTitle || "";
    } catch (err) {}
    const secs = Math.max(1, Math.round(current.words / 3.5));
    info.textContent = `${current.words} palavras · ~${secs}s`;
    chip.setAttribute("data-on", "true");
    if (d.rect) {
      position(d.rect);
    }
  }

  window.addEventListener("pwnd-page", onPage, false);
  gBrowser.tabContainer.addEventListener("TabSelect", hide, false);
})();
