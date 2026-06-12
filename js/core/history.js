/* Undo/Redo: snapshot di documento (efficiente per doc piccoli/medi).
   Una snapshot è il JSON completo del CadDocument:
     { name, currentLayer, layers[], entities[], solids[] }
   Caratteristiche:
   - Dedup: se la nuova snapshot è identica all'ultima, NON viene pushata.
   - Limite: scarta le più vecchie oltre `limit` (FIFO).
   - Restore: ripristina entities + solids + layers, sincronizza scene3D e
     notifica autosave.
*/
class History {
  constructor(doc) {
    this.doc = doc;
    this.stack = [];
    this.pointer = -1;
    this.limit = 200;
    this._lastHash = null;
    this.snapshot('init');
  }
  snapshot(label = '') {
    const json = this.doc.toJSON();
    /* dedup: salta se identica all'ultima snapshot */
    const hash = JSON.stringify(json);
    if (hash === this._lastHash) return;
    this._lastHash = hash;
    /* tronca eventuali redo */
    if (this.pointer < this.stack.length - 1) {
      this.stack.length = this.pointer + 1;
    }
    this.stack.push({ label, data: JSON.parse(hash) });
    if (this.stack.length > this.limit) this.stack.shift();
    this.pointer = this.stack.length - 1;
  }
  undo() {
    if (this.pointer <= 0) return false;
    this.pointer--;
    this._restore();
    return true;
  }
  redo() {
    if (this.pointer >= this.stack.length - 1) return false;
    this.pointer++;
    this._restore();
    return true;
  }
  _restore() {
    const snap = this.stack[this.pointer];
    const o = snap.data;
    /* ricarico stato del documento in-place sull'istanza esistente
       (così renderer, snap, scene3d che puntano allo stesso oggetto vedono i nuovi dati) */
    this.doc.name = o.name;
    this.doc.currentLayerName = o.currentLayer;
    this.doc.layers = (o.layers || []).map(l => Layer.fromJSON(l));
    this.doc.entities = (o.entities || []).map(e => Entity.fromJSON(e)).filter(Boolean);
    this.doc.solids = Array.isArray(o.solids) ? JSON.parse(JSON.stringify(o.solids)) : [];
    this.doc.selection.clear();
    this._lastHash = JSON.stringify(this.doc.toJSON());
    /* sincronizza scena 3D se in modalità 3D */
    if (window.app && window.app.mode === '3d' && window.app.scene3d) {
      window.app.scene3d.selectedSolids.clear();
      window.app.scene3d.syncFromDocument(this.doc);
    }
    /* segna dirty per autosave */
    if (window.app) window.app.markDirty && window.app.markDirty();
  }
  canUndo() { return this.pointer > 0; }
  canRedo() { return this.pointer < this.stack.length - 1; }
}
