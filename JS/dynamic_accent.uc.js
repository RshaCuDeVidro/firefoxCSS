// ==UserScript==
// @name           PWND dynamic accent
// @description    Deriva --p-accent da cor dominante do favicon da aba ativa
// @include        main
// ==/UserScript==

(function () {
  "use strict";
  console.log("[pwnd] dynamic_accent carregado");

  const gBrowser = window.gBrowser;
  const root = document.documentElement;
  if (!gBrowser) {
    return;
  }

  // paleta curada (neon legivel sobre #050505) para fallback por hostname
  const PALETTE = [
    [217, 70, 239], // fuchsia
    [34, 211, 238], // cyan
    [147, 51, 234], // violet
    [56, 189, 248], // sky
    [244, 114, 182], // pink
    [168, 85, 247], // purple
    [20, 184, 166], // teal
    [251, 146, 60], // orange
  ];

  const cache = new Map();
  const MAX_CACHE = 120;
  let token = 0;

  function cacheSet(key, value) {
    if (cache.size >= MAX_CACHE) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, value);
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    const d = max - min;
    let s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) {
        h = (g - b) / d + (g < b ? 6 : 0);
      } else if (max === g) {
        h = (b - r) / d + 2;
      } else {
        h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    let r, g, b;
    if (!s) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(h + 1 / 3);
      g = hue(h);
      b = hue(h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // normaliza para um neon consistente: saturacao alta + luz media
  function neonify(rgb) {
    const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    if (s < 0.2) {
      return null;
    }
    return hslToRgb(h, clamp(s, 0.82, 0.95), 0.6);
  }

  function hashPick(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return PALETTE[Math.abs(h) % PALETTE.length];
  }

  function dominantColor(data) {
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        continue;
      }
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 510;
      if (l < 0.08 || l > 0.95) {
        continue;
      }
      const s = max === 0 ? 0 : (max - min) / max;
      if (s < 0.25) {
        continue;
      }
      const key = (r >> 4) + ":" + (g >> 4) + ":" + (b >> 4);
      const b0 = buckets.get(key) || [0, 0, 0, 0];
      b0[0]++;
      b0[1] += r;
      b0[2] += g;
      b0[3] += b;
      buckets.set(key, b0);
    }
    let best = null;
    let bestCount = -1;
    for (const b0 of buckets.values()) {
      if (b0[0] > bestCount) {
        bestCount = b0[0];
        best = [b0[1] / b0[0], b0[2] / b0[0], b0[3] / b0[0]];
      }
    }
    return best;
  }

  async function colorFromIcon(url) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      const size = 32;
      let ctx;
      let canvas;
      if (typeof OffscreenCanvas !== "undefined") {
        canvas = new OffscreenCanvas(size, size);
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      } else {
        canvas = document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "canvas"
        );
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bmp, 0, 0, size, size);
      if (bmp.close) {
        bmp.close();
      }
      const px = ctx.getImageData(0, 0, size, size).data;
      const dom = dominantColor(px);
      return dom ? neonify(dom) : null;
    } catch (e) {
      return null;
    }
  }

  function apply(rgb) {
    if (!rgb) {
      root.style.removeProperty("--p-accent");
      root.style.removeProperty("--p-glow");
      return;
    }
    const [r, g, b] = rgb.map((v) => Math.round(v));
    root.style.setProperty("--p-accent", `rgb(${r}, ${g}, ${b})`, "important");
    root.style.setProperty(
      "--p-glow",
      `0 0 6px rgba(${r}, ${g}, ${b}, .55)`,
      "important"
    );
  }

  async function update() {
    const tab = gBrowser.selectedTab;
    if (!tab) {
      return;
    }
    const my = ++token;
    let host = "";
    try {
      host = gBrowser.currentURI.host;
    } catch (e) {
      host = "";
    }
    let icon = "";
    try {
      icon = (tab.iconImage && tab.iconImage.src) || gBrowser.getIcon(tab) || "";
    } catch (e) {
      icon = "";
    }

    let rgb = null;
    if (icon) {
      // favicons vem como page-icon:<url>; tenta buscar a url real (fetch
      // privilegiado no chrome costuma driblar CORS).
      const fetchUrl = icon.replace(/^page-icon:/i, "");
      if (cache.has(fetchUrl)) {
        rgb = cache.get(fetchUrl);
      } else {
        rgb = await colorFromIcon(fetchUrl);
        cacheSet(fetchUrl, rgb);
      }
    }
    if (my !== token) {
      return;
    }
    if (!rgb) {
      rgb = host ? hashPick(host) : null;
    }
    apply(rgb);
  }

  gBrowser.tabContainer.addEventListener("TabSelect", update, false);
  let attrTimer = 0;
  gBrowser.tabContainer.addEventListener(
    "TabAttrModified",
    (e) => {
      if (
        !e.detail ||
        !e.detail.changed ||
        !e.detail.changed.includes("image") ||
        attrTimer
      ) {
        return;
      }
      attrTimer = window.setTimeout(() => {
        attrTimer = 0;
        update();
      }, 150);
    },
    false
  );
  window.addEventListener("load", update, { once: true });
  update();
})();
