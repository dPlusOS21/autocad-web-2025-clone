/* ========================================================
   Strumenti di disegno
   ======================================================== */

/* ----- LINEA ----- */
class LineTool extends Tool {
  constructor(app) { super(app); this.points = []; }
  activate() { this.points = []; this.prompt('LINEA: Specificare primo punto:'); }
  onLeftClick(p, snap) {
    this.points.push(snap.point);
    if (this.points.length === 1) {
      this.prompt('Specificare punto successivo o [Annulla]:');
    } else {
      const a = this.points[this.points.length - 2];
      const b = this.points[this.points.length - 1];
      this.doc.addEntity(this._mk(a, b));
      this.app.history.snapshot('line');
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (this.points.length === 0) return;
    const last = this.points[this.points.length - 1];
    this.app.renderer.previewPoints = [last, snap.point];
    this.app.render();
  }
  confirm() { this.cancel(); }
  cancel() {
    this.points = [];
    this.app.renderer.previewPoints = null;
    this.app.setTool('select');
    this.app.render();
  }
  onCommandInput(txt) {
    if (this.points.length === 0) return false;
    const pt = this.app.parsePoint(txt, this.points[this.points.length - 1]);
    if (pt) {
      this.onLeftClick(pt, { point: pt });
      return true;
    }
    return false;
  }
  _mk(a, b) {
    return new LineEntity({
      p1: a, p2: b,
      layer: this.doc.currentLayerName,
      color: this.doc.currentColor,
      lineType: this.doc.currentLineType,
      lineWeight: this.doc.currentLineWeight,
    });
  }
}

/* ----- POLILINEA ----- */
class PolylineTool extends Tool {
  constructor(app) { super(app); this.points = []; }
  activate() { this.points = []; this.prompt('POLILINEA: Specificare punto iniziale:'); }
  onLeftClick(p, snap) {
    this.points.push(snap.point);
    this.prompt('Punto successivo [C=chiudi / Invio=fine]:');
    this.app.render();
  }
  onMove(p, snap) {
    if (!this.points.length) return;
    const last = this.points[this.points.length - 1];
    this.app.renderer.previewPoints = [last, snap.point];
    if (this.points.length >= 2) {
      const e = new PolylineEntity({ points: [...this.points, snap.point], layer: this.doc.currentLayerName });
      this.app.renderer.previewEntity = e;
    }
    this.app.render();
  }
  confirm() { this._finalize(false); }
  cancel() {
    this.points = [];
    this.app.renderer.previewPoints = null;
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
  onCommandInput(txt) {
    const t = txt.trim().toUpperCase();
    if (t === 'C' || t === 'CHIUDI' || t === 'CLOSE') { this._finalize(true); return true; }
    if (this.points.length > 0) {
      const ref = this.points[this.points.length - 1];
      const pt = this.app.parsePoint(txt, ref);
      if (pt) { this.onLeftClick(pt, { point: pt }); return true; }
    }
    return false;
  }
  _finalize(closed) {
    if (this.points.length >= 2) {
      this.doc.addEntity(new PolylineEntity({
        points: this.points, closed,
        layer: this.doc.currentLayerName,
        color: this.doc.currentColor,
        lineType: this.doc.currentLineType,
      }));
      this.app.history.snapshot('polyline');
    }
    this.cancel();
    this.app.refreshAll();
  }
}

/* ----- CERCHIO (centro + raggio) ----- */
class CircleTool extends Tool {
  constructor(app) { super(app); this.center = null; }
  activate() { this.center = null; this.prompt('CERCHIO: Centro:'); }
  onLeftClick(p, snap) {
    if (!this.center) { this.center = snap.point; this.prompt('Raggio:'); }
    else {
      const r = Geom.dist(this.center, snap.point);
      this.doc.addEntity(new CircleEntity({
        center: this.center, radius: r,
        layer: this.doc.currentLayerName,
        color: this.doc.currentColor, lineType: this.doc.currentLineType,
      }));
      this.app.history.snapshot('circle');
      this.cancel();
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (!this.center) return;
    const r = Geom.dist(this.center, snap.point);
    this.app.renderer.previewEntity = new CircleEntity({ center: this.center, radius: r, layer: this.doc.currentLayerName });
    this.app.render();
  }
  onCommandInput(txt) {
    if (this.center) {
      const v = parseFloat(txt);
      if (!isNaN(v) && v > 0) {
        this.doc.addEntity(new CircleEntity({ center: this.center, radius: v, layer: this.doc.currentLayerName }));
        this.app.history.snapshot('circle');
        this.cancel();
        this.app.refreshAll();
        return true;
      }
    } else {
      const pt = this.app.parsePoint(txt);
      if (pt) { this.onLeftClick(pt, { point: pt }); return true; }
    }
    return false;
  }
  cancel() {
    this.center = null;
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- ARCO (3 punti) ----- */
class ArcTool extends Tool {
  constructor(app) { super(app); this.pts = []; }
  activate() { this.pts = []; this.prompt('ARCO: Primo punto:'); }
  onLeftClick(p, snap) {
    this.pts.push(snap.point);
    if (this.pts.length === 1) this.prompt('Secondo punto (sull’arco):');
    else if (this.pts.length === 2) this.prompt('Punto finale:');
    else {
      const arc = this._arc3(this.pts[0], this.pts[1], this.pts[2]);
      if (arc) {
        this.doc.addEntity(new ArcEntity({ ...arc, layer: this.doc.currentLayerName, color: this.doc.currentColor }));
        this.app.history.snapshot('arc');
      }
      this.cancel();
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (this.pts.length === 2) {
      const arc = this._arc3(this.pts[0], this.pts[1], snap.point);
      if (arc) this.app.renderer.previewEntity = new ArcEntity({ ...arc, layer: this.doc.currentLayerName });
    }
    this.app.render();
  }
  cancel() {
    this.pts = [];
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
  _arc3(a, b, c) {
    /* cerchio per 3 punti */
    const ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return null;
    const ux = ((ax*ax + ay*ay)*(by - cy) + (bx*bx + by*by)*(cy - ay) + (cx*cx + cy*cy)*(ay - by)) / d;
    const uy = ((ax*ax + ay*ay)*(cx - bx) + (bx*bx + by*by)*(ax - cx) + (cx*cx + cy*cy)*(bx - ax)) / d;
    const center = { x: ux, y: uy };
    const r = Geom.dist(center, a);
    const a0 = Math.atan2(a.y - uy, a.x - ux);
    const a1 = Math.atan2(c.y - uy, c.x - ux);
    /* Direzione: scelgo verso che passa per b */
    /* per semplicità uso a0 -> a1 antiorario */
    return { center, radius: r, startAngle: a0, endAngle: a1 };
  }
}

/* ----- RETTANGOLO ----- */
class RectangleTool extends Tool {
  constructor(app) { super(app); this.p1 = null; }
  activate() { this.p1 = null; this.prompt('RETTANGOLO: Primo angolo:'); }
  onLeftClick(p, snap) {
    if (!this.p1) { this.p1 = snap.point; this.prompt('Angolo opposto:'); }
    else {
      this.doc.addEntity(new RectangleEntity({
        p1: this.p1, p2: snap.point,
        layer: this.doc.currentLayerName, color: this.doc.currentColor,
      }));
      this.app.history.snapshot('rectangle');
      this.cancel();
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (!this.p1) return;
    this.app.renderer.previewEntity = new RectangleEntity({ p1: this.p1, p2: snap.point, layer: this.doc.currentLayerName });
    this.app.render();
  }
  onCommandInput(txt) {
    const pt = this.app.parsePoint(txt, this.p1);
    if (pt) { this.onLeftClick(pt, { point: pt }); return true; }
    return false;
  }
  cancel() {
    this.p1 = null;
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- ELLISSE (centro + asse 1 + asse 2) ----- */
class EllipseTool extends Tool {
  constructor(app) { super(app); this.center = null; this.rx = null; }
  activate() { this.center = null; this.rx = null; this.prompt('ELLISSE: Centro:'); }
  onLeftClick(p, snap) {
    if (!this.center) { this.center = snap.point; this.prompt('Estremo asse maggiore:'); }
    else if (this.rx == null) {
      this.rx = Math.abs(snap.point.x - this.center.x);
      this.prompt('Estremo asse minore:');
    } else {
      const ry = Math.abs(snap.point.y - this.center.y);
      this.doc.addEntity(new EllipseEntity({
        center: this.center, rx: this.rx, ry,
        layer: this.doc.currentLayerName, color: this.doc.currentColor,
      }));
      this.app.history.snapshot('ellipse');
      this.cancel();
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (this.center && this.rx == null) {
      const rx = Math.abs(snap.point.x - this.center.x);
      this.app.renderer.previewEntity = new EllipseEntity({ center: this.center, rx, ry: rx * 0.5, layer: this.doc.currentLayerName });
    } else if (this.center && this.rx != null) {
      const ry = Math.abs(snap.point.y - this.center.y);
      this.app.renderer.previewEntity = new EllipseEntity({ center: this.center, rx: this.rx, ry, layer: this.doc.currentLayerName });
    }
    this.app.render();
  }
  cancel() {
    this.center = null; this.rx = null;
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- PUNTO ----- */
class PointTool extends Tool {
  activate() { this.prompt('PUNTO: Specificare posizione:'); }
  onLeftClick(p, snap) {
    this.doc.addEntity(new PointEntity({ position: snap.point, layer: this.doc.currentLayerName, color: this.doc.currentColor }));
    this.app.history.snapshot('point');
    this.app.refreshAll();
  }
}

/* ----- TESTO ----- */
class TextTool extends Tool {
  constructor(app) { super(app); this.pos = null; }
  activate() { this.pos = null; this.prompt('TESTO: Posizione:'); }
  async onLeftClick(p, snap) {
    this.pos = snap.point;
    const res = await Modal.form('Inserisci testo', [
      { key: 'text', label: 'Testo', value: '' },
      { key: 'height', label: 'Altezza', value: 2.5, type: 'number', step: 0.1, min: 0.1 },
    ], { okLabel: 'Inserisci' });
    if (res && res.text) {
      this.doc.addEntity(new TextEntity({
        position: this.pos, text: res.text, height: res.height || 2.5,
        layer: this.doc.currentLayerName, color: this.doc.currentColor,
      }));
      this.app.history.snapshot('text');
    }
    this.cancel();
    this.app.refreshAll();
  }
  cancel() {
    this.pos = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- QUOTA LINEARE ----- */
class DimensionTool extends Tool {
  constructor(app) { super(app); this.p1 = null; this.p2 = null; }
  activate() { this.p1 = null; this.p2 = null; this.prompt('QUOTA: Primo punto di origine:'); }
  onLeftClick(p, snap) {
    if (!this.p1) { this.p1 = snap.point; this.prompt('Secondo punto di origine:'); }
    else if (!this.p2) { this.p2 = snap.point; this.prompt('Posizione linea di quota:'); }
    else {
      this.doc.addEntity(new DimensionEntity({
        p1: this.p1, p2: this.p2, offset: snap.point, kind: 'aligned',
        layer: 'QUOTE',
      }));
      this.app.history.snapshot('dimension');
      this.cancel();
    }
    this.app.refreshAll();
  }
  onMove(p, snap) {
    if (this.p1 && this.p2) {
      this.app.renderer.previewEntity = new DimensionEntity({ p1: this.p1, p2: this.p2, offset: snap.point, kind: 'aligned', layer: 'QUOTE' });
      this.app.render();
    }
  }
  cancel() {
    this.p1 = null; this.p2 = null;
    this.app.renderer.previewEntity = null;
    this.app.setTool('select');
    this.app.render();
  }
}
