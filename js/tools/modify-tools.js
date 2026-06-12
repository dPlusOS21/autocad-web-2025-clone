/* ========================================================
   Strumenti di modifica
   ======================================================== */

/* Base: opera sulla selezione corrente */
class ModifyToolBase extends Tool {
  ensureSelection() {
    if (this.doc.selection.size === 0) {
      this.echo('Selezionare oggetti prima del comando.', 'warn');
      this.cancel();
      return false;
    }
    return true;
  }
}

/* ----- ERASE ----- */
class EraseTool extends ModifyToolBase {
  activate() {
    if (!this.ensureSelection()) return;
    for (const id of [...this.doc.selection]) this.doc.removeEntity(id);
    this.doc.clearSelection();
    this.app.history.snapshot('erase');
    this.echo('Oggetti cancellati.', 'ok');
    this.cancel();
    this.app.refreshAll();
  }
}

/* ----- MOVE ----- */
class MoveTool extends ModifyToolBase {
  constructor(app) { super(app); this.base = null; this.snapshot = null; }
  activate() {
    if (!this.ensureSelection()) return;
    this.snapshot = this.doc.selectedEntities().map(e => Utils.deepClone(e.toJSON()));
    this.prompt('Punto base:');
  }
  onLeftClick(p, snap) {
    if (!this.base) { this.base = snap.point; this.prompt('Secondo punto:'); }
    else {
      const dx = snap.point.x - this.base.x;
      const dy = snap.point.y - this.base.y;
      for (const e of this.doc.selectedEntities()) e.move(dx, dy);
      this.app.history.snapshot('move');
      this.cancel();
      this.app.refreshAll();
    }
  }
  onMove(p, snap) {
    if (this.base) {
      const dx = snap.point.x - this.base.x;
      const dy = snap.point.y - this.base.y;
      /* ripristina e applica preview */
      for (let i = 0; i < this.snapshot.length; i++) {
        const id = this.snapshot[i].id;
        const e = this.doc.getEntity(id);
        if (!e) continue;
        Object.assign(e, Entity.fromJSON(Utils.deepClone(this.snapshot[i])));
        e.move(dx, dy);
      }
      this.app.render();
    }
  }
  onCommandInput(txt) {
    const ref = this.base || { x: 0, y: 0 };
    const pt = this.app.parsePoint(txt, ref);
    if (pt) { this.onLeftClick(pt, { point: pt }); return true; }
    return false;
  }
  cancel() {
    this.base = null; this.snapshot = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- COPY ----- */
class CopyTool extends ModifyToolBase {
  constructor(app) { super(app); this.base = null; }
  activate() {
    if (!this.ensureSelection()) return;
    this.prompt('Punto base:');
  }
  onLeftClick(p, snap) {
    if (!this.base) { this.base = snap.point; this.prompt('Punto di destinazione (Invio per finire):'); }
    else {
      const dx = snap.point.x - this.base.x;
      const dy = snap.point.y - this.base.y;
      for (const e of this.doc.selectedEntities()) {
        const c = Entity.fromJSON(e.toJSON());
        c.id = Utils.uid();
        c.move(dx, dy);
        this.doc.addEntity(c);
      }
      this.app.history.snapshot('copy');
      this.app.refreshAll();
    }
  }
  confirm() { this.cancel(); }
  cancel() {
    this.base = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- ROTATE ----- */
class RotateTool extends ModifyToolBase {
  constructor(app) { super(app); this.center = null; this.snapshot = null; }
  activate() {
    if (!this.ensureSelection()) return;
    this.snapshot = this.doc.selectedEntities().map(e => Utils.deepClone(e.toJSON()));
    this.prompt('Punto base (centro di rotazione):');
  }
  onLeftClick(p, snap) {
    if (!this.center) { this.center = snap.point; this.prompt('Angolo (°) o punto:'); }
    else {
      const ang = Math.atan2(snap.point.y - this.center.y, snap.point.x - this.center.x);
      this._applyRotation(ang);
      this.app.history.snapshot('rotate');
      this.cancel();
      this.app.refreshAll();
    }
  }
  onMove(p, snap) {
    if (this.center) {
      const ang = Math.atan2(snap.point.y - this.center.y, snap.point.x - this.center.x);
      this._applyRotation(ang);
      this.app.render();
    }
  }
  onCommandInput(txt) {
    if (!this.center) return false;
    const a = parseFloat(txt);
    if (!isNaN(a)) {
      this._applyRotation(Utils.deg2rad(a));
      this.app.history.snapshot('rotate');
      this.cancel(); this.app.refreshAll();
      return true;
    }
    return false;
  }
  _applyRotation(ang) {
    for (let i = 0; i < this.snapshot.length; i++) {
      const id = this.snapshot[i].id;
      const e = this.doc.getEntity(id);
      if (!e) continue;
      Object.assign(e, Entity.fromJSON(Utils.deepClone(this.snapshot[i])));
      e.rotate(this.center, ang);
    }
  }
  cancel() {
    this.center = null; this.snapshot = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- SCALE ----- */
class ScaleTool extends ModifyToolBase {
  constructor(app) { super(app); this.base = null; this.snapshot = null; this.ref = null; }
  activate() {
    if (!this.ensureSelection()) return;
    this.snapshot = this.doc.selectedEntities().map(e => Utils.deepClone(e.toJSON()));
    this.prompt('Punto base:');
  }
  onLeftClick(p, snap) {
    if (!this.base) { this.base = snap.point; this.ref = Geom.dist(this.base, snap.point) || 1; this.prompt('Fattore di scala:'); }
    else {
      const k = Geom.dist(this.base, snap.point) / (this.ref || 1);
      this._apply(k);
      this.app.history.snapshot('scale');
      this.cancel(); this.app.refreshAll();
    }
  }
  onMove(p, snap) {
    if (this.base) {
      this.ref = this.ref || 1;
      const k = Geom.dist(this.base, snap.point) || 0.01;
      this._apply(k);
      this.app.render();
    }
  }
  onCommandInput(txt) {
    if (!this.base) return false;
    const k = parseFloat(txt);
    if (!isNaN(k) && k > 0) {
      this._apply(k);
      this.app.history.snapshot('scale');
      this.cancel(); this.app.refreshAll();
      return true;
    }
    return false;
  }
  _apply(k) {
    for (let i = 0; i < this.snapshot.length; i++) {
      const id = this.snapshot[i].id;
      const e = this.doc.getEntity(id);
      if (!e) continue;
      Object.assign(e, Entity.fromJSON(Utils.deepClone(this.snapshot[i])));
      e.scale(this.base, k);
    }
  }
  cancel() {
    this.base = null; this.snapshot = null; this.ref = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- MIRROR ----- */
class MirrorTool extends ModifyToolBase {
  constructor(app) { super(app); this.a = null; this.snapshot = null; this.copy = true; }
  activate() {
    if (!this.ensureSelection()) return;
    this.snapshot = this.doc.selectedEntities().map(e => Utils.deepClone(e.toJSON()));
    this.prompt('Primo punto asse di simmetria:');
  }
  async onLeftClick(p, snap) {
    if (!this.a) { this.a = snap.point; this.prompt('Secondo punto asse:'); return; }
    const b = snap.point;
    const removeSrc = await Modal.confirm('Specchio', 'Cancellare gli oggetti di origine?', { okLabel: 'Sì, cancella', cancelLabel: 'No, mantieni' });
    for (const e of this.doc.selectedEntities()) {
      const c = Entity.fromJSON(e.toJSON());
      c.id = Utils.uid();
      c.mirror(this.a, b);
      this.doc.addEntity(c);
    }
    if (removeSrc) {
      for (const id of [...this.doc.selection]) this.doc.removeEntity(id);
      this.doc.clearSelection();
    }
    this.app.history.snapshot('mirror');
    this.cancel(); this.app.refreshAll();
  }
  cancel() {
    this.a = null; this.snapshot = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- OFFSET ----- */
class OffsetTool extends ModifyToolBase {
  constructor(app) { super(app); this.dist = null; this.target = null; }
  activate() {
    this.dist = null; this.target = null;
    this.prompt('OFFSET: Distanza:');
  }
  onCommandInput(txt) {
    if (this.dist == null) {
      const d = parseFloat(txt);
      if (!isNaN(d) && d > 0) { this.dist = d; this.prompt('Selezionare oggetto da offset:'); return true; }
    }
    return false;
  }
  onLeftClick(p, snap) {
    if (this.dist == null) return;
    if (!this.target) {
      /* trova entità sotto al punto */
      const tol = 6 / this.camera.zoom;
      for (let i = this.doc.entities.length - 1; i >= 0; i--) {
        const e = this.doc.entities[i];
        if (e.hitTest(snap.point, tol)) { this.target = e; break; }
      }
      if (this.target) this.prompt('Lato dell\'offset:');
    } else {
      const off = this._offset(this.target, snap.point);
      if (off) {
        this.doc.addEntity(off);
        this.app.history.snapshot('offset');
        this.app.refreshAll();
      }
      this.target = null;
      this.prompt('Selezionare un altro oggetto o Invio per finire:');
    }
  }
  confirm() { this.cancel(); }
  _offset(ent, side) {
    if (ent.type === 'line') {
      const dir = Geom.norm(Geom.sub(ent.p2, ent.p1));
      const perp = { x: -dir.y, y: dir.x };
      const mid = Geom.midpoint(ent.p1, ent.p2);
      const sign = Math.sign(Geom.dot(Geom.sub(side, mid), perp)) || 1;
      const shift = Geom.scale(perp, sign * this.dist);
      return new LineEntity({
        p1: Geom.add(ent.p1, shift),
        p2: Geom.add(ent.p2, shift),
        layer: ent.layer, color: ent.color, lineType: ent.lineType,
      });
    }
    if (ent.type === 'circle') {
      const sign = Geom.dist(side, ent.center) > ent.radius ? 1 : -1;
      const r = ent.radius + sign * this.dist;
      if (r <= 0) return null;
      return new CircleEntity({ center: ent.center, radius: r, layer: ent.layer, color: ent.color });
    }
    if (ent.type === 'rectangle') {
      const bb = ent.bbox();
      const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
      const sign = (Math.abs(side.x - cx) > bb.w / 2 || Math.abs(side.y - cy) > bb.h / 2) ? 1 : -1;
      const d = sign * this.dist;
      if (bb.w + 2 * d <= 0 || bb.h + 2 * d <= 0) return null;
      return new RectangleEntity({
        p1: { x: bb.x - d, y: bb.y - d },
        p2: { x: bb.x + bb.w + d, y: bb.y + bb.h + d },
        layer: ent.layer, color: ent.color,
      });
    }
    return null;
  }
  cancel() {
    this.dist = null; this.target = null;
    this.app.setTool('select');
    this.app.render();
  }
}

/* ----- TRIM (semplificato: clicca su segmento di linea per tagliarlo a intersezione più vicina al click) ----- */
class TrimTool extends Tool {
  activate() { this.prompt('TRIM: Selezionare segmento da tagliare:'); }
  onLeftClick(p, snap) {
    const tol = 6 / this.camera.zoom;
    let target = null;
    for (let i = this.doc.entities.length - 1; i >= 0; i--) {
      const e = this.doc.entities[i];
      if (e.type === 'line' && e.hitTest(snap.point, tol)) { target = e; break; }
    }
    if (!target) { this.echo('Nessuna linea selezionata.', 'warn'); return; }
    /* trova tutte le intersezioni con altre linee */
    const pts = [];
    for (const o of this.doc.entities) {
      if (o === target) continue;
      if (o.type === 'line') {
        const r = Geom.segSeg(target.p1, target.p2, o.p1, o.p2);
        if (r) pts.push({ point: { x: r.x, y: r.y }, t: r.t });
      } else if (o.type === 'circle') {
        for (const ip of Geom.lineCircle(target.p1, target.p2, o.center, o.radius)) {
          if (ip.t >= 0 && ip.t <= 1) pts.push({ point: { x: ip.x, y: ip.y }, t: ip.t });
        }
      }
    }
    if (!pts.length) { this.echo('Nessuna intersezione trovata.', 'warn'); return; }
    /* dividi a t del click */
    const dx = target.p2.x - target.p1.x, dy = target.p2.y - target.p1.y;
    const L2 = dx * dx + dy * dy || 1;
    const tClick = ((snap.point.x - target.p1.x) * dx + (snap.point.y - target.p1.y) * dy) / L2;
    /* trova la parte da rimuovere: cerca le 2 intersezioni più vicine prima/dopo a tClick */
    pts.sort((a, b) => a.t - b.t);
    let lo = 0, hi = 1;
    let lower = null, upper = null;
    for (const ip of pts) {
      if (ip.t < tClick) lower = ip;
      else if (ip.t > tClick && upper == null) upper = ip;
    }
    /* il pezzo rimosso va da max(lower.t, 0) a min(upper.t, 1) */
    const tA = lower ? lower.t : 0;
    const tB = upper ? upper.t : 1;
    /* sostituisci con 0..tA e tB..1 */
    this.doc.removeEntity(target.id);
    if (tA > 0.0001) {
      this.doc.addEntity(new LineEntity({
        p1: target.p1,
        p2: { x: target.p1.x + tA * dx, y: target.p1.y + tA * dy },
        layer: target.layer, color: target.color, lineType: target.lineType,
      }));
    }
    if (tB < 0.9999) {
      this.doc.addEntity(new LineEntity({
        p1: { x: target.p1.x + tB * dx, y: target.p1.y + tB * dy },
        p2: target.p2,
        layer: target.layer, color: target.color, lineType: target.lineType,
      }));
    }
    this.app.history.snapshot('trim');
    this.app.refreshAll();
  }
}

/* ----- EXTEND (estende la linea selezionata fino alla prima linea boundary) ----- */
class ExtendTool extends Tool {
  activate() { this.prompt('EXTEND: Selezionare estremo da estendere (clicca vicino):'); }
  onLeftClick(p, snap) {
    const tol = 8 / this.camera.zoom;
    let target = null, useP2 = true;
    for (let i = this.doc.entities.length - 1; i >= 0; i--) {
      const e = this.doc.entities[i];
      if (e.type !== 'line') continue;
      if (Geom.dist(snap.point, e.p1) < tol) { target = e; useP2 = false; break; }
      if (Geom.dist(snap.point, e.p2) < tol) { target = e; useP2 = true; break; }
    }
    if (!target) { this.echo('Clicca vicino all\'estremo da estendere.', 'warn'); return; }
    /* trova la prima intersezione lungo la direzione estensiva con un\'altra linea */
    const a = useP2 ? target.p1 : target.p2;
    const b = useP2 ? target.p2 : target.p1;
    let bestT = Infinity, bestPt = null;
    for (const o of this.doc.entities) {
      if (o === target || o.type !== 'line') continue;
      const r = Geom.lineLine(a, b, o.p1, o.p2);
      if (!r) continue;
      if (r.t > 1.0001 && r.u >= -1e-9 && r.u <= 1 + 1e-9) {
        if (r.t < bestT) { bestT = r.t; bestPt = { x: r.x, y: r.y }; }
      }
    }
    if (!bestPt) { this.echo('Nessun boundary trovato.', 'warn'); return; }
    if (useP2) target.p2 = bestPt; else target.p1 = bestPt;
    this.app.history.snapshot('extend');
    this.app.refreshAll();
  }
}

/* ----- FILLET (raccordo tra 2 linee con raggio) ----- */
class FilletTool extends Tool {
  constructor(app) { super(app); this.radius = 0; this.line1 = null; }
  async activate() {
    const v = await Modal.input('Raccordo', 'Raggio del raccordo (0 = solo trim)', this.radius || 0, { type: 'number', step: 0.1, min: 0, okLabel: 'OK' });
    if (v == null) { this.cancel(); return; }
    this.radius = parseFloat(v) || 0;
    this.line1 = null;
    if (isNaN(this.radius) || this.radius < 0) { this.cancel(); return; }
    this.prompt('Selezionare prima linea:');
  }
  onLeftClick(p, snap) {
    const tol = 6 / this.camera.zoom;
    const ent = this.doc.entities.filter(e => e.type === 'line').reverse().find(e => e.hitTest(snap.point, tol));
    if (!ent) { this.echo('Seleziona una linea.', 'warn'); return; }
    if (!this.line1) { this.line1 = ent; this.prompt('Selezionare seconda linea:'); return; }
    if (ent === this.line1) { this.echo('Stessa linea.', 'warn'); return; }
    this._fillet(this.line1, ent);
    this.app.history.snapshot('fillet');
    this.cancel(); this.app.refreshAll();
  }
  _fillet(l1, l2) {
    const ix = Geom.lineLine(l1.p1, l1.p2, l2.p1, l2.p2);
    if (!ix) { this.echo('Linee parallele.', 'warn'); return; }
    const ip = { x: ix.x, y: ix.y };
    if (this.radius === 0) {
      /* trim entrambe fino al punto di intersezione */
      this._trimTo(l1, ip);
      this._trimTo(l2, ip);
      return;
    }
    /* per raggio > 0 calcolo i punti tangenti su ciascuna linea */
    const d1 = Geom.norm(Geom.sub(l1.p2, l1.p1));
    const d2 = Geom.norm(Geom.sub(l2.p2, l2.p1));
    /* il vertice è ip, le bisettrici servono per posizionare il centro */
    /* per semplicità: prendo direzione dei due segmenti uscenti dal vertice verso i punti più lontani */
    const far1 = Geom.dist(l1.p1, ip) > Geom.dist(l1.p2, ip) ? l1.p1 : l1.p2;
    const far2 = Geom.dist(l2.p1, ip) > Geom.dist(l2.p2, ip) ? l2.p1 : l2.p2;
    const u1 = Geom.norm(Geom.sub(far1, ip));
    const u2 = Geom.norm(Geom.sub(far2, ip));
    const cosT = Geom.dot(u1, u2);
    const ang = Math.acos(Utils.clamp(cosT, -1, 1));
    if (ang < 1e-6 || Math.abs(ang - Math.PI) < 1e-6) return;
    const dist = this.radius / Math.tan(ang / 2);
    const t1 = Geom.add(ip, Geom.scale(u1, dist));
    const t2 = Geom.add(ip, Geom.scale(u2, dist));
    /* centro: bisettrice */
    const bis = Geom.norm({ x: u1.x + u2.x, y: u1.y + u2.y });
    const hyp = this.radius / Math.sin(ang / 2);
    const center = Geom.add(ip, Geom.scale(bis, hyp));
    /* trim linee fino a t1 e t2 */
    this._trimTo(l1, t1);
    this._trimTo(l2, t2);
    /* aggiungo arco */
    const a0 = Math.atan2(t1.y - center.y, t1.x - center.x);
    const a1 = Math.atan2(t2.y - center.y, t2.x - center.x);
    this.doc.addEntity(new ArcEntity({
      center, radius: this.radius,
      startAngle: Math.min(a0, a1), endAngle: Math.max(a0, a1),
      layer: l1.layer, color: l1.color,
    }));
  }
  _trimTo(line, p) {
    /* avvicina il vertice della linea più vicino a p */
    if (Geom.dist(line.p1, p) < Geom.dist(line.p2, p)) line.p1 = p;
    else line.p2 = p;
  }
  cancel() {
    this.line1 = null;
    this.app.setTool('select');
    this.app.render();
  }
}
