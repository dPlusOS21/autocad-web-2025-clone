/* ========================================================
   Strumenti 3D — Estrusione, primitive, ecc.
   ======================================================== */

/* EXTRUDE: opera sulle entità 2D selezionate (chiuse), crea un solido per ognuna */
class ExtrudeTool extends Tool {
  async activate() {
    const sel = this.doc.selectedEntities();
    if (sel.length === 0) {
      this.echo('Selezionare prima le entità 2D chiuse da estrudere (cerchio, rettangolo, polilinea chiusa, ellisse).', 'warn');
      this.cancel();
      return;
    }
    const valid = sel.filter(e => ExtrudeTool.isExtrudable(e));
    if (valid.length === 0) {
      this.echo('Nessuna entità estrudibile nella selezione. Servono cerchi, rettangoli, polilinee chiuse o ellissi.', 'warn');
      this.cancel();
      return;
    }
    const h = await Modal.input(
      'Estrudi 2D → 3D',
      `Altezza di estrusione per ${valid.length} ${valid.length === 1 ? 'entità' : 'entità'}`,
      10, { type: 'number', step: 0.1, okLabel: 'Estrudi' },
    );
    if (!isFinite(h) || h === 0 || h === null) {
      this.echo('Altezza non valida. Operazione annullata.', 'warn');
      this.cancel();
      return;
    }
    let created = 0;
    for (const e of valid) {
      const rec = ExtrudeTool.buildSolidRecord(e, h);
      if (rec) { this.doc.addSolid(rec); created++; }
    }
    this.app.history.snapshot('extrude');
    this.echo(`Estruse ${created} entità (altezza ${h}). Apri il workspace 3D per vederle.`, 'ok');
    /* se siamo già in 3D, sync immediato; altrimenti passa a 3D */
    if (this.app.mode === '3d') this.app.scene3d.syncFromDocument(this.doc);
    else this.app.toggleMode3D().then(() => this.app.setView3D('iso'));
    this.cancel();
  }

  static isExtrudable(e) {
    if (e.type === 'circle' || e.type === 'rectangle' || e.type === 'ellipse') return true;
    if (e.type === 'polyline' && e.closed && e.points && e.points.length >= 3) return true;
    return false;
  }

  static buildSolidRecord(e, h) {
    const base = {
      id: Utils.uid(),
      sourceEntityId: e.id,
      layer: e.layer,
      color: e.color,
      height: h,
    };
    if (e.type === 'circle') {
      return { ...base, kind: 'extrude-circle', params: { cx: e.center.x, cy: e.center.y, radius: e.radius } };
    }
    if (e.type === 'rectangle') {
      return { ...base, kind: 'extrude-rect', params: { x1: e.p1.x, y1: e.p1.y, x2: e.p2.x, y2: e.p2.y } };
    }
    if (e.type === 'ellipse') {
      return { ...base, kind: 'extrude-ellipse', params: { cx: e.center.x, cy: e.center.y, rx: e.rx, ry: e.ry } };
    }
    if (e.type === 'polyline') {
      return { ...base, kind: 'extrude-polyline', params: { points: e.points.map(p => ({ x: p.x, y: p.y })) } };
    }
    return null;
  }
}

/* ========================================================
   Primitive 3D — prompt per i parametri, aggiunge al doc.solids
   ======================================================== */
class PrimitiveTool extends Tool {
  constructor(app, kind, label, paramSpec) {
    super(app);
    this.kind = kind;       // 'prim-box' | 'prim-sphere' | ...
    this.label = label;     // 'Box' | ...
    this.paramSpec = paramSpec; // [['w','Larghezza X',10], ...]
  }
  async activate() {
    const fields = this.paramSpec.map(([key, label, def]) => ({
      key, label, value: def, type: 'number', step: 0.1, min: 0,
    }));
    const res = await Modal.form(`Crea ${this.label}`, fields, { okLabel: 'Crea' });
    if (!res) { this.cancel(); return; }
    const p = {};
    for (const [key] of this.paramSpec) {
      const v = parseFloat(res[key]);
      if (!isFinite(v) || v <= 0) { this.echo('Valore non valido.', 'warn'); this.cancel(); return; }
      p[key] = v;
    }
    p.cx = p.cx || 0; p.cy = p.cy || 0; p.z = p.z || 0;
    const rec = {
      id: Utils.uid(),
      kind: this.kind,
      layer: this.doc.currentLayerName,
      color: this.doc.currentColor || this.doc.currentLayer().color,
      params: p,
      height: p.h || p.r || 0,
    };
    this.doc.addSolid(rec);
    this.app.history.snapshot(this.kind);
    this.echo(`${this.label} creato.`, 'ok');
    if (this.app.mode === '3d') this.app.scene3d.syncFromDocument(this.doc);
    else this.app.toggleMode3D().then(() => this.app.setView3D('iso'));
    this.cancel();
  }
}

class BoxTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-box', 'Box', [
    ['w', 'Larghezza (X)', 10], ['d', 'Profondità (Y)', 10], ['h', 'Altezza (Z)', 10],
  ]); }
}
class SphereTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-sphere', 'Sfera', [
    ['r', 'Raggio', 5],
  ]); }
}
class CylinderTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-cylinder', 'Cilindro', [
    ['r', 'Raggio', 5], ['h', 'Altezza', 10],
  ]); }
}
class ConeTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-cone', 'Cono', [
    ['r', 'Raggio base', 5], ['h', 'Altezza', 10],
  ]); }
}
class TorusTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-torus', 'Toro', [
    ['R', 'Raggio principale', 8], ['r', 'Raggio sezione tubolare', 2],
  ]); }
}
class PyramidTool extends PrimitiveTool {
  constructor(app) { super(app, 'prim-pyramid', 'Piramide', [
    ['base', 'Lato base', 10], ['h', 'Altezza', 10],
  ]); }
}

/* ========================================================
   Rivoluzione: profilo 2D ruotato attorno a un asse
   ======================================================== */
class RevolveTool extends Tool {
  async activate() {
    const sel = this.doc.selectedEntities();
    const profile = sel.find(e => e.type === 'polyline' && e.points && e.points.length >= 2);
    if (!profile) {
      this.echo('Selezionare una polilinea (anche aperta) come profilo, poi REVOLVE.', 'warn');
      this.cancel(); return;
    }
    const res = await Modal.form('Rivoluzione 2D → 3D', [
      { key: 'axis', label: 'Asse di rotazione', value: 'Y', type: 'text' },
      { key: 'angle', label: 'Angolo (°)', value: 360, type: 'number', step: 1, min: 1, max: 360 },
    ], { okLabel: 'Genera' });
    if (!res) { this.cancel(); return; }
    const axis = (res.axis || 'Y').toUpperCase().startsWith('X') ? 'X' : 'Y';
    const angleDeg = Math.max(1, Math.min(360, parseFloat(res.angle) || 360));
    const layer = this.doc.getLayer(profile.layer);
    const rec = {
      id: Utils.uid(),
      kind: 'revolve',
      layer: profile.layer,
      color: profile.color || (layer ? layer.color : '#ffffff'),
      params: { points: profile.points.map(p => ({ x: p.x, y: p.y })), axis, angleDeg },
      height: 0,
    };
    this.doc.addSolid(rec);
    this.app.history.snapshot('revolve');
    this.echo(`Rivoluzione creata (asse ${axis}, ${angleDeg}°).`, 'ok');
    if (this.app.mode === '3d') this.app.scene3d.syncFromDocument(this.doc);
    else this.app.toggleMode3D().then(() => this.app.setView3D('iso'));
    this.cancel();
  }
}

