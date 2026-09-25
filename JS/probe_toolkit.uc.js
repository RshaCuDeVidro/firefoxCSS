// ==UserScript==
// @name           PWND probe toolkit
// @description    Shift+Alt: regua/medir (arrastar)/cor (clique)/seletor (Ctrl+clique). Shift+Alt+E: spotlight de elemento.
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] probe_toolkit carregado");

  const doc = document;
  const gBrowser = window.gBrowser;
  if (!gBrowser || doc.getElementById("p-probe-capture")) {
    return;
  }

  const XHTML = "http://www.w3.org/1999/xhtml";
  function mk(id, cls) {
    const el = doc.createElementNS(XHTML, "div");
    el.id = id;
    if (cls) {
      el.className = cls;
    }
    doc.documentElement.appendChild(el);
    return el;
  }

  const capture = mk("p-probe-capture");
  const band = mk("p-ruler-band");
  const bandLine = doc.createElementNS(XHTML, "div");
  bandLine.className = "p-ruler-line";
  band.appendChild(bandLine);
  const measure = mk("p-measure-box");
  const measureLabel = mk("p-measure-label");
  const spotBox = mk("p-probe-box");
  const spotBadge = mk("p-probe-badge");
  const toastEl = mk("p-probe-toast");

  let rulerOn = false;
  let spotOn = false;
  let measuring = false;
  let measureStart = null;
  let last = { x: 0, y: 0 };
  let raf = 0;
  let probeTimer = 0;
  let toastTimer = 0;

  function isAlt(e) {
    return e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight";
  }
  function isShift(e) {
    return (
      e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight"
    );
  }
  function browserEl() {
    return gBrowser.selectedBrowser;
  }
  function browserRect() {
    const b = browserEl();
    return b ? b.getBoundingClientRect() : null;
  }
  function zoomOf(b) {
    try {
      return window.ZoomManager.getZoomForBrowser(b);
    } catch (e) {
      return b.fullZoom || 1;
    }
  }
  function toContent(clientX, clientY) {
    const b = browserEl();
    const r = b.getBoundingClientRect();
    const z = zoomOf(b);
    return { x: (clientX - r.left) / z, y: (clientY - r.top) / z };
  }
  function inContent(clientY) {
    const r = browserRect();
    return r && clientY >= r.top && clientY <= r.bottom;
  }

  function copy(text) {
    try {
      Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper)
        .copyString(text);
    } catch (e) {}
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.setAttribute("data-on", "true");
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(
      () => toastEl.setAttribute("data-on", "false"),
      1500
    );
  }

  let actorWarned = false;

  function actorQuery(x, y) {
    try {
      const actors = window.UC_API && UC_API.Experimental.WindowActors;
      if (!actors) {
        if (!actorWarned) {
          actorWarned = true;
          console.warn(
            "[pwnd] Experimental.WindowActors indisponivel - confira userChromeJS.experimental.enabled"
          );
          toast("actor off: ligue experimental");
        }
        return Promise.resolve(null);
      }
      let actor = null;
      try {
        actor = actors.get("ElementProbe");
      } catch (e) {
        if (!actorWarned) {
          actorWarned = true;
          console.warn("[pwnd] actor ElementProbe nao registrado:", e.message);
          toast("actor ElementProbe nao registrado");
        }
        return Promise.resolve(null);
      }
      if (!actor) {
        if (!actorWarned) {
          actorWarned = true;
          console.warn("[pwnd] actor ElementProbe retornou null");
          toast("actor ElementProbe nulo");
        }
        return Promise.resolve(null);
      }
      return actor.sendQuery("elementAt", { x, y }).catch((e) => {
        console.warn("[pwnd] sendQuery falhou:", e.message);
        return null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function updateCapture() {
    capture.style.pointerEvents = rulerOn || spotOn ? "auto" : "none";
  }

  function hideMeasure() {
    measuring = false;
    measure.removeAttribute("data-on");
    measureLabel.style.display = "none";
  }

  function paintBand() {
    raf = 0;
    if (!rulerOn || measuring) {
      return;
    }
    if (!inContent(last.y)) {
      band.setAttribute("data-away", "true");
      return;
    }
    band.removeAttribute("data-away");
    band.style.transform = `translateY(${last.y}px)`;
  }

  function paintMeasure() {
    if (!measuring || !measureStart) {
      return;
    }
    const x0 = Math.min(measureStart.x, last.x);
    const y0 = Math.min(measureStart.y, last.y);
    const w = Math.abs(last.x - measureStart.x);
    const h = Math.abs(last.y - measureStart.y);
    measure.setAttribute("data-on", "true");
    measure.style.transform = `translate(${x0}px, ${y0}px)`;
    measure.style.width = `${w}px`;
    measure.style.height = `${h}px`;
    measureLabel.style.display = "block";
    measureLabel.style.transform = `translate(${x0}px, ${Math.max(0, y0 - 22)}px)`;
    measureLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  }

  function setRuler(on) {
    if (rulerOn === on) {
      return;
    }
    rulerOn = on;
    if (on) {
      setSpot(false);
    }
    band.setAttribute("data-on", on ? "true" : "false");
    if (!on) {
      band.removeAttribute("data-away");
      hideMeasure();
    }
    updateCapture();
    if (on) {
      paintBand();
    }
  }

  function setSpot(on) {
    if (spotOn === on) {
      return;
    }
    spotOn = on;
    if (on) {
      setRuler(false);
    }
    doc.documentElement.toggleAttribute("p-spot-on", on);
    spotBox.setAttribute("data-on", on ? "true" : "false");
    spotBadge.setAttribute("data-on", on ? "true" : "false");
    if (!on) {
      spotBadge.textContent = "";
    }
    updateCapture();
  }

  async function probeElement() {
    if (!spotOn || !inContent(last.y)) {
      return;
    }
    const { x, y } = toContent(last.x, last.y);
    const info = await actorQuery(x, y);
    if (!info || !spotOn) {
      return;
    }
    const b = browserEl();
    const r = b.getBoundingClientRect();
    const z = zoomOf(b);
    const left = r.left + info.x * z;
    const top = r.top + info.y * z;
    const w = info.width * z;
    const h = info.height * z;
    spotBox.style.transform = `translate(${left}px, ${top}px)`;
    spotBox.style.width = `${w}px`;
    spotBox.style.height = `${h}px`;
    spotBadge.style.transform = `translate(${left}px, ${Math.max(0, top - 22)}px)`;
    const cls = info.classes
      ? "." + info.classes.split(/\s+/).slice(0, 2).join(".")
      : "";
    spotBadge.textContent = `${info.tag}${info.id ? "#" + info.id : ""}${cls}  ${Math.round(
      info.width
    )}×${Math.round(info.height)}`;
  }

  function scheduleProbe() {
    if (probeTimer) {
      return;
    }
    probeTimer = window.setTimeout(() => {
      probeTimer = 0;
      probeElement();
    }, 50);
  }

  async function pickSelector(clientX, clientY) {
    if (!inContent(clientY)) {
      return;
    }
    const { x, y } = toContent(clientX, clientY);
    const info = await actorQuery(x, y);
    if (!info || !info.selector) {
      toast("nada sob o cursor");
      return;
    }
    copy(info.selector);
    toast(info.selector);
  }

  async function pickColor(clientX, clientY) {
    if (!inContent(clientY)) {
      return;
    }
    const b = browserEl();
    const wg = b.browsingContext && b.browsingContext.currentWindowGlobal;
    if (!wg) {
      toast("sem janela de conteudo");
      return;
    }
    const { x, y } = toContent(clientX, clientY);
    try {
      const rect = new DOMRect(
        Math.max(0, Math.round(x)),
        Math.max(0, Math.round(y)),
        1,
        1
      );
      const bmp = await wg.drawSnapshot(rect, 1, "rgb(255,255,255)", false);
      const canvas = doc.createElementNS(XHTML, "canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, 1, 1);
      if (bmp.close) {
        bmp.close();
      }
      const d = ctx.getImageData(0, 0, 1, 1).data;
      const hex =
        "#" +
        [d[0], d[1], d[2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      copy(hex);
      toast(`${hex}   rgb(${d[0]}, ${d[1]}, ${d[2]})`);
    } catch (e) {
      toast("falha ao amostrar cor");
    }
  }

  capture.addEventListener("mousemove", (e) => {
    last.x = e.clientX;
    last.y = e.clientY;
    if (measuring) {
      paintMeasure();
      return;
    }
    if (rulerOn && !raf) {
      raf = window.requestAnimationFrame(paintBand);
    }
    if (spotOn) {
      scheduleProbe();
    }
  });

  capture.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || spotOn || !rulerOn) {
      return;
    }
    measureStart = { x: e.clientX, y: e.clientY };
    measuring = true;
    band.setAttribute("data-on", "false");
    e.preventDefault();
    e.stopPropagation();
  });

  capture.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || spotOn || !rulerOn || !measuring) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const dx = Math.abs(e.clientX - measureStart.x);
    const dy = Math.abs(e.clientY - measureStart.y);
    measuring = false;
    if (dx < 4 && dy < 4) {
      hideMeasure();
      band.setAttribute("data-on", "true");
      if (e.ctrlKey) {
        pickSelector(e.clientX, e.clientY);
      } else {
        pickColor(e.clientX, e.clientY);
      }
    } else if (e.ctrlKey) {
      pickSelector(e.clientX, e.clientY);
    }
  });

  capture.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (spotOn) {
        pickSelector(e.clientX, e.clientY);
      }
    },
    true
  );

  capture.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  capture.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true, passive: false }
  );

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        setSpot(false);
        setRuler(false);
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey) {
        return;
      }
      const combo = (isAlt(e) && e.shiftKey) || (isShift(e) && e.altKey);
      if (!combo) {
        return;
      }
      if (e.code === "KeyE") {
        setSpot(!spotOn);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // so ativa a regua quando a propria tecla modificadora e pressionada;
      // assim Shift+Alt+<tecla> fica livre para outros atalhos
      if (!isAlt(e) && !isShift(e)) {
        return;
      }
      if (!spotOn) {
        setRuler(true);
      }
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (!isAlt(e) && !isShift(e)) {
        return;
      }
      if (e.altKey && e.shiftKey) {
        return;
      }
      if (rulerOn) {
        setRuler(false);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  window.addEventListener(
    "blur",
    () => {
      setRuler(false);
    },
    true
  );
})();
