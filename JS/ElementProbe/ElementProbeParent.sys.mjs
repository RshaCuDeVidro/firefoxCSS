export class ElementProbeParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name && message.name.startsWith("page:")) {
      const top = this.browsingContext && this.browsingContext.top;
      const win = top && top.topChromeWindow;
      if (win) {
        try {
          win.dispatchEvent(
            new win.CustomEvent("pwnd-page", {
              detail: {
                type: message.name,
                bcid: top.id,
                ...message.data,
              },
            })
          );
        } catch (e) {}
      }
    }
    return undefined;
  }
}
