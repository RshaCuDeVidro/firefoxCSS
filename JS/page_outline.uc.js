// ==UserScript==
// @name           PWND page outline
// @description    Indice flutuante dos headings da pagina (Shift+Alt+T) com posicao atual
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] page_outline carregado");

  const doc = document;
  const gBrowser = window.gBrowser;
  if (!gBrowser || doc.getElementById("p-outline")) {
    return;
  }

  const XHTML = "http://www.w3.org/1999/xhtml";
  const panel = doc.createElementNS(XHTML, "div");
  panel.id = "p-outline";
  const head = doc.createElementNS(XHTML, "div");
  head.className = "p-ol-head";
  head.textContent = "outline";
  panel.appendChild(head);
  const list = doc.createElementNS(XHTML, "div");
  list.className = "p-ol-list";
  panel.appendChild(list);
  doc.documentElement.appendChild(panel);

  let items = [];
  let open = false;
  let lastScroll = 0;

  function actor() {
    try {
      const A = window.UC_API && UC_API.Experimental.WindowActors;
      return A ? A.get("ElementProbe") : null;
    } catch (e) {
      return null;
    }
  }

  function close() {
    open = false;
    panel.removeAttribute("data-on");
  }

  async function toggle() {
    if (open) {
      close();
      return;
    }
    const a = actor();
    if (!a) {
      console.warn("[pwnd] outline: actor ElementProbe indisponivel");
      return;
    }
    let hs = [];
    try {
      hs = await a.sendQuery("outline");
    } catch (e) {
      return;
    }
    list.textContent = "";
    items = [];
    hs.forEach((h) => {
      const it = doc.createElementNS(XHTML, "div");
      it.className = "p-ol-item p-ol-l" + h.level;
      it.textContent = h.text;
      it.dataset.y = String(h.y);
      it.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          const a2 = actor();
          if (a2) {
            a2.sendQuery("scrollToY", { y: Number(it.dataset.y) }).catch(
              () => {}
            );
          }
        },
        true
      );
      list.appendChild(it);
      items.push({ el: it, y: h.y });
    });
    open = true;
    panel.setAttribute("data-on", "true");
    update();
  }

  function update() {
    if (!open || !items.length) {
      return;
    }
    let cur = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].y <= lastScroll + 120) {
        cur = i;
      } else {
        break;
      }
    }
    for (let i = 0; i < items.length; i++) {
      if (i === cur) {
        items[i].el.setAttribute("data-cur", "true");
      } else {
        items[i].el.removeAttribute("data-cur");
      }
    }
  }

  function onPage(e) {
    const d = e.detail;
    if (!d || d.type !== "page:scroll") {
      return;
    }
    const bc = gBrowser.selectedBrowser.browsingContext;
    if (bc && d.bcid !== bc.id) {
      return;
    }
    lastScroll = d.y;
    update();
  }

  window.addEventListener("pwnd-page", onPage, false);

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && open) {
        close();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey) {
        return;
      }
      if (e.code === "KeyT" && e.altKey && e.shiftKey) {
        toggle();
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  gBrowser.tabContainer.addEventListener("TabSelect", close, false);
})();
