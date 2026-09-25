// ==UserScript==
// @name           PWND time theme
// @description    Drift do hue ambiente conforme a hora do dia
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] time_theme carregado");

  const root = document.documentElement;

  // [hora, hue, saturacao] - interpolado linearmente ao longo do dia
  const ANCHORS = [
    [0, 252, 0.35], // madrugada: azul profundo, dessaturado
    [5, 252, 0.35],
    [7, 190, 0.72], // manha: ciano
    [10, 200, 0.8],
    [13, 292, 0.85], // tarde: fuchsia (padrao do tema)
    [16, 300, 0.85],
    [19, 275, 0.78], // noite: violeta
    [22, 235, 0.55], // noite: azul
    [24, 252, 0.35],
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function phase(hour) {
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      const [h0, hue0, s0] = ANCHORS[i];
      const [h1, hue1, s1] = ANCHORS[i + 1];
      if (hour >= h0 && hour <= h1) {
        const t = (hour - h0) / (h1 - h0 || 1);
        return { hue: lerp(hue0, hue1, t), sat: lerp(s0, s1, t) };
      }
    }
    return { hue: 292, sat: 0.85 };
  }

  function apply() {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const { hue, sat } = phase(hour);
    const h = Math.round(hue);
    const s = Math.round(sat * 100);
    const soft = Math.round(sat * 45);

    root.style.setProperty("--p-accent2", `hsl(${h} 78% 55%)`, "important");
    root.style.setProperty("--p-line", `hsl(${h} ${soft}% 15%)`, "important");
    root.style.setProperty("--p-bg3", `hsl(${h} ${soft}% 9%)`, "important");
    root.style.setProperty("--p-bg2", `hsl(${h} ${soft}% 6%)`, "important");
    root.setAttribute("data-ph", String(h));
  }

  apply();
  window.setInterval(apply, 5 * 60 * 1000);
})();
