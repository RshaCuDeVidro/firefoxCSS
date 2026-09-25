// ==UserScript==
// @name           PWND CRT screensaver
// @description    Desbota a chrome apos ocioso e injeta overlay CRT com scanlines
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] crt_idle carregado");

  const doc = document;
  if (doc.getElementById("p-crt-overlay")) {
    return;
  }

  const overlay = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div"
  );
  overlay.id = "p-crt-overlay";
  doc.documentElement.appendChild(overlay);

  const Cc = Components.classes;
  const Ci = Components.interfaces;
  let idleService = null;
  try {
    idleService = Cc["@mozilla.org/widget/idleservice;1"].getService(
      Ci.nsIIdleService
    );
  } catch (e) {
    idleService = null;
  }
  if (!idleService) {
    return;
  }

  const THRESHOLD = 120; // segundos ate entrar em modo idle
  let wakeTimer = null;

  const observer = {
    observe(subject, topic) {
      if (topic === "idle") {
        doc.documentElement.setAttribute("p-idle", "true");
      } else if (topic === "back") {
        doc.documentElement.removeAttribute("p-idle");
        doc.documentElement.setAttribute("p-wake", "true");
        if (wakeTimer) {
          clearTimeout(wakeTimer);
        }
        wakeTimer = window.setTimeout(
          () => doc.documentElement.removeAttribute("p-wake"),
          260
        );
      }
    },
  };

  try {
    idleService.addIdleObserver(observer, THRESHOLD);
  } catch (e) {
    return;
  }

  window.addEventListener(
    "unload",
    () => {
      try {
        idleService.removeIdleObserver(observer, THRESHOLD);
      } catch (e) {}
    },
    { once: true }
  );
})();
