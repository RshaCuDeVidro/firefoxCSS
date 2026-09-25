export class ElementProbeChild extends JSWindowActorChild {
  constructor() {
    super();
    this._rafScroll = 0;
    this._rafSel = 0;
    this._lastScrollAt = 0;
    this._lastScrollY = -1;
    this._lastSelText = "";
    this._gesture = null;
    this._justGestured = false;
    this._top = false;
  }

  actorCreated() {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    this._top = this.browsingContext === this.browsingContext.top;

    // gestos valem em qualquer frame; scroll/selecao so no frame de topo
    this._onMouseDown = (e) => this.gestureDown(e);
    this._onMouseMove = (e) => this.gestureMove(e);
    this._onMouseUp = (e) => this.gestureUp(e);
    this._onContextMenu = (e) => {
      if (this._justGestured) {
        this._justGestured = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    win.addEventListener("mousedown", this._onMouseDown, true);
    win.addEventListener("mousemove", this._onMouseMove, true);
    win.addEventListener("mouseup", this._onMouseUp, true);
    win.addEventListener("contextmenu", this._onContextMenu, true);

    if (!this._top) {
      return;
    }

    this._onScroll = () => {
      if (this._rafScroll) {
        return;
      }
      this._rafScroll = win.requestAnimationFrame(() => {
        this._rafScroll = 0;
        const now = Date.now();
        if (now - this._lastScrollAt < 50) {
          return;
        }
        const y = Math.round(win.scrollY);
        if (y === this._lastScrollY) {
          return;
        }
        this._lastScrollAt = now;
        this.sendScroll(y);
      });
    };
    this._onSelection = () => {
      if (this._rafSel) {
        return;
      }
      this._rafSel = win.requestAnimationFrame(() => {
        this._rafSel = 0;
        this.sendSelection();
      });
    };
    win.addEventListener("scroll", this._onScroll, true);
    win.document.addEventListener("selectionchange", this._onSelection, true);
  }

  didDestroy() {
    try {
      const win = this.contentWindow;
      if (win) {
        win.removeEventListener("mousedown", this._onMouseDown, true);
        win.removeEventListener("mousemove", this._onMouseMove, true);
        win.removeEventListener("mouseup", this._onMouseUp, true);
        win.removeEventListener("contextmenu", this._onContextMenu, true);
        if (this._top) {
          win.removeEventListener("scroll", this._onScroll, true);
          win.document.removeEventListener(
            "selectionchange",
            this._onSelection,
            true
          );
        }
      }
    } catch (e) {}
    this.teardownTrail();
  }

  receiveMessage(message) {
    switch (message.name) {
      case "elementAt":
        return this.elementInfo(message.data.x, message.data.y);
      case "outline":
        return this.outline();
      case "scrollToY":
        return this.scrollToY(message.data.y);
      default:
        throw new Error("ElementProbe: mensagem desconhecida " + message.name);
    }
  }

  sendScroll(y) {
    try {
      const win = this.contentWindow;
      const doc = this.document;
      this._lastScrollY = y;
      this.sendAsyncMessage("page:scroll", {
        y,
        max: Math.max(
          0,
          Math.round((doc.documentElement.scrollHeight || 0) - win.innerHeight)
        ),
        viewport: Math.round(win.innerHeight),
      });
    } catch (e) {}
  }

  sendSelection() {
    try {
      const win = this.contentWindow;
      const sel = win.getSelection();
      const text = sel ? sel.toString() : "";
      if (!text || !text.trim()) {
        if (this._lastSelText !== "") {
          this._lastSelText = "";
          this.sendAsyncMessage("page:selection", { active: false });
        }
        return;
      }
      if (text === this._lastSelText) {
        return;
      }
      this._lastSelText = text;
      let rect = null;
      try {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } catch (e) {}
      const words = (
        text.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []
      ).length;
      this.sendAsyncMessage("page:selection", {
        active: true,
        words,
        chars: text.length,
        text: text.slice(0, 20000),
        rect: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : null,
      });
    } catch (e) {}
  }

  outline() {
    const win = this.contentWindow;
    return Array.from(
      this.document.querySelectorAll("h1,h2,h3,h4,h5,h6")
    )
      .map((h) => {
        const r = h.getBoundingClientRect();
        return {
          level: Number(h.tagName[1]),
          text: (h.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140),
          y: Math.round(r.top + win.scrollY),
        };
      })
      .filter((x) => x.text);
  }

  scrollToY(y) {
    try {
      this.contentWindow.scrollTo({ top: y, behavior: "smooth" });
      return true;
    } catch (e) {
      return false;
    }
  }

  gestureDown(e) {
    if (e.button !== 2) {
      return;
    }
    this._justGestured = false;
    this._gesture = {
      points: [],
      dirs: [],
      last: { x: e.clientX, y: e.clientY },
      moved: false,
    };
  }

  gestureMove(e) {
    const g = this._gesture;
    if (!g || !(e.buttons & 2)) {
      if (g) {
        this._gesture = null;
        this.teardownTrail();
      }
      return;
    }
    const dx = e.clientX - g.last.x;
    const dy = e.clientY - g.last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      return;
    }
    g.last = { x: e.clientX, y: e.clientY };
    g.points.push([e.clientX, e.clientY]);
    g.moved = true;
    this.drawTrail(g.points);
    if (dist > 16) {
      const dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U";
      if (g.dirs[g.dirs.length - 1] !== dir) {
        g.dirs.push(dir);
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }

  gestureUp(e) {
    const g = this._gesture;
    if (!g || e.button !== 2) {
      return;
    }
    this._gesture = null;
    this.teardownTrail();
    if (g.moved && g.dirs.length) {
      this._justGestured = true;
      this.sendAsyncMessage("page:gesture", { pattern: g.dirs.join("") });
      e.preventDefault();
      e.stopPropagation();
      try {
        this.contentWindow.setTimeout(() => {
          this._justGestured = false;
        }, 400);
      } catch (err) {}
    }
  }

  drawTrail(points) {
    let path = this.document.getElementById("p-gesture-path");
    if (!path) {
      const svg = this.document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      svg.id = "p-gesture-trail";
      svg.setAttribute(
        "style",
        "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;"
      );
      path = this.document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline"
      );
      path.id = "p-gesture-path";
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#d946ef");
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("filter", "drop-shadow(0 0 6px #d946ef)");
      svg.appendChild(path);
      this.document.documentElement.appendChild(svg);
    }
    path.setAttribute("points", points.map((p) => p[0] + "," + p[1]).join(" "));
  }

  teardownTrail() {
    try {
      const svg =
        this.document && this.document.getElementById("p-gesture-trail");
      if (svg) {
        svg.remove();
      }
    } catch (e) {}
  }

  elementInfo(x, y) {
    const el = this.document.elementFromPoint(x, y);
    if (!el) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      classes: typeof el.className === "string" ? el.className.trim() : "",
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      selector: this.selectorFor(el),
    };
  }

  escapeName(name) {
    if (this.contentWindow.CSS && this.contentWindow.CSS.escape) {
      return this.contentWindow.CSS.escape(name);
    }
    return String(name).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  selectorFor(el) {
    if (el.id) {
      const sel = "#" + this.escapeName(el.id);
      try {
        if (this.document.querySelectorAll(sel).length === 1) {
          return sel;
        }
      } catch (e) {}
    }

    const parts = [];
    let node = el;
    let depth = 0;
    while (
      node &&
      node.nodeType === 1 &&
      node !== this.document.documentElement &&
      depth < 6
    ) {
      let part = node.tagName.toLowerCase();

      if (node.id) {
        part = "#" + this.escapeName(node.id);
        parts.unshift(part);
        break;
      }

      if (typeof node.className === "string" && node.className.trim()) {
        const cls = node.className
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((c) => this.escapeName(c))
          .join(".");
        if (cls) {
          part += "." + cls;
        }
      }

      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName
        );
        if (sameTag.length > 1) {
          part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        }
      }

      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }

    return parts.join(" > ");
  }
}
