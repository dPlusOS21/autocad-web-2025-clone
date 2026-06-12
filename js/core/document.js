/* Documento CAD: layer + entità + selezione */
class CadDocument {
  constructor() {
    this.layers = [
      new Layer({ name: '0', color: '#ffffff' }),
      new Layer({ name: 'CONSTR', color: '#aaaaaa', lineType: 'DASHED' }),
      new Layer({ name: 'QUOTE',  color: '#f1c40f' }),
    ];
    this.currentLayerName = '0';
    this.entities = [];
    /* Solidi 3D: array di record { id, kind, sourceEntityId|null, params{}, layer, color, height } */
    this.solids = [];
    this.selection = new Set();
    this.name = 'Disegno1';
    this.id = null;
    this.modified = false;
    this.currentColor = Colors.byLayer;
    this.currentLineType = 'BYLAYER';
    this.currentLineWeight = 0;
  }

  /* ===== Layer ===== */
  getLayer(name) { return this.layers.find(l => l.name === name); }
  currentLayer() { return this.getLayer(this.currentLayerName) || this.layers[0]; }
  addLayer(layer) {
    if (this.getLayer(layer.name)) return false;
    this.layers.push(layer);
    return true;
  }
  removeLayer(name) {
    if (name === '0') return false;
    const idx = this.layers.findIndex(l => l.name === name);
    if (idx < 0) return false;
    /* sposta entità su layer 0 */
    for (const e of this.entities) if (e.layer === name) e.layer = '0';
    this.layers.splice(idx, 1);
    if (this.currentLayerName === name) this.currentLayerName = '0';
    return true;
  }
  renameLayer(oldName, newName) {
    if (oldName === '0' || this.getLayer(newName)) return false;
    const l = this.getLayer(oldName);
    if (!l) return false;
    l.name = newName;
    for (const e of this.entities) if (e.layer === oldName) e.layer = newName;
    if (this.currentLayerName === oldName) this.currentLayerName = newName;
    return true;
  }

  /* ===== Entità ===== */
  addEntity(e) {
    this.entities.push(e);
    this.modified = true;
    this._notifyChange();
    return e;
  }
  removeEntity(id) {
    const idx = this.entities.findIndex(e => e.id === id);
    if (idx >= 0) {
      this.entities.splice(idx, 1);
      this.selection.delete(id);
      this.modified = true;
      this._notifyChange();
      return true;
    }
    return false;
  }
  _notifyChange() {
    if (window.app && typeof window.app.markDirty === 'function') window.app.markDirty();
  }
  getEntity(id) { return this.entities.find(e => e.id === id); }

  /* ===== Selezione ===== */
  select(id) { this.selection.add(id); }
  deselect(id) { this.selection.delete(id); }
  toggle(id) {
    if (this.selection.has(id)) this.selection.delete(id);
    else this.selection.add(id);
  }
  clearSelection() { this.selection.clear(); }
  selectedEntities() {
    return [...this.selection].map(id => this.getEntity(id)).filter(Boolean);
  }

  /* ===== Bounds globali ===== */
  bbox() {
    if (!this.entities.length) return null;
    let res = null;
    for (const e of this.entities) {
      const layer = this.getLayer(e.layer);
      if (!layer || !layer.visible) continue;
      const b = e.bbox();
      if (!res) res = { ...b };
      else res = Geom.bboxUnion(res, b);
    }
    return res;
  }

  /* ===== Solidi 3D ===== */
  addSolid(rec) {
    rec.id = rec.id || Utils.uid();
    this.solids.push(rec);
    this.modified = true;
    this._notifyChange();
    return rec;
  }
  removeSolid(id) {
    const i = this.solids.findIndex(s => s.id === id);
    if (i >= 0) { this.solids.splice(i, 1); this.modified = true; this._notifyChange(); return true; }
    return false;
  }
  getSolid(id) { return this.solids.find(s => s.id === id); }

  /* ===== Serializzazione ===== */
  toJSON() {
    return {
      name: this.name,
      currentLayer: this.currentLayerName,
      layers: this.layers.map(l => l.toJSON()),
      entities: this.entities.map(e => e.toJSON()),
      solids: this.solids,
    };
  }
  static fromJSON(o) {
    const d = new CadDocument();
    if (o.name) d.name = o.name;
    if (o.currentLayer) d.currentLayerName = o.currentLayer;
    if (o.layers && o.layers.length) {
      d.layers = o.layers.map(l => Layer.fromJSON(l));
    }
    if (o.entities) {
      d.entities = o.entities.map(e => Entity.fromJSON(e)).filter(Boolean);
    }
    if (Array.isArray(o.solids)) d.solids = o.solids;
    return d;
  }
}
