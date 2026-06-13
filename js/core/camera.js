/* Camera 2D — gestione zoom/pan, conversione world<->screen.
   In CAD: Y world cresce verso l'alto, Y screen cresce verso il basso.
*/
class Camera {
  constructor() {
    this.x = 0;          // centro vista world
    this.y = 0;
    /* Scala 1:1 reale: 1 unità (= 1 mm) occupa PX_PER_MM pixel sullo schermo.
       A questo zoom il disegno è a grandezza naturale (100%). */
    this.scale1to1 = Utils.PX_PER_MM; // pixel per unità world a scala 1:1
    this.zoom = this.scale1to1;       // pixel per unità world (default = 100% reale)
    this.minZoom = 0.001;
    this.maxZoom = 100000;
    this.viewW = 1;
    this.viewH = 1;
  }
  setView(w, h) { this.viewW = w; this.viewH = h; }

  worldToScreen(p) {
    return {
      x: this.viewW / 2 + (p.x - this.x) * this.zoom,
      y: this.viewH / 2 - (p.y - this.y) * this.zoom,
    };
  }
  screenToWorld(s) {
    return {
      x: this.x + (s.x - this.viewW / 2) / this.zoom,
      y: this.y - (s.y - this.viewH / 2) / this.zoom,
    };
  }

  pan(dxScreen, dyScreen) {
    this.x -= dxScreen / this.zoom;
    this.y += dyScreen / this.zoom;
  }

  zoomAt(screen, factor) {
    const before = this.screenToWorld(screen);
    this.zoom = Utils.clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(screen);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  zoomExtents(bbox, padding = 0.1) {
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) {
      this.x = 0; this.y = 0; this.zoom = this.scale1to1;
      return;
    }
    const pad = 1 + padding * 2;
    const zx = this.viewW / (bbox.w * pad);
    const zy = this.viewH / (bbox.h * pad);
    this.zoom = Utils.clamp(Math.min(zx, zy), this.minZoom, this.maxZoom);
    this.x = bbox.x + bbox.w / 2;
    this.y = bbox.y + bbox.h / 2;
  }

  /* Misurato in unità world: quanti pixel? */
  worldLen(u) { return u * this.zoom; }
  screenLen(p) { return p / this.zoom; }

  /* Stato per UI: 100% = scala 1:1 reale (1 mm disegnato = 1 mm sullo schermo) */
  zoomPct() { return Math.round(this.zoom * 100 / this.scale1to1); }
}
