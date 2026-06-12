/* Strumento selezione: click singolo + finestra (window/crossing) + grip move */
class SelectTool extends Tool {
  constructor(app) {
    super(app);
    this.boxStart = null;
    this.dragGrip = null;
    this.grippedEntId = null;
    this.gripIndex = -1;
    this.gripStartPos = null;
  }
  activate() {
    this.prompt('Seleziona oggetti:');
    this.app.canvas.style.cursor = 'default';
  }

  onLeftClick(p, snap) {
    /* se sto trascinando un grip e clicco la seconda volta -> sposta */
    if (this.dragGrip) {
      const dx = snap.point.x - this.gripStartPos.x;
      const dy = snap.point.y - this.gripStartPos.y;
      const ent = this.doc.getEntity(this.grippedEntId);
      if (ent) ent.move(dx, dy);
      this.dragGrip = null;
      this.app.history.snapshot('grip move');
      this.app.refreshAll();
      return;
    }

    /* prima: prova a colpire un grip di un oggetto selezionato */
    const grip = this._gripUnder(snap.point);
    if (grip) {
      this.dragGrip = true;
      this.grippedEntId = grip.entId;
      this.gripIndex = grip.idx;
      this.gripStartPos = { ...grip.point };
      this.prompt('Specificare punto di destinazione:');
      return;
    }

    /* hit-test singola entità */
    const ent = this._entityAt(snap.point);
    if (ent) {
      if (!this.app.shiftDown) this.doc.clearSelection();
      this.doc.toggle(ent.id);
      this.app.refreshAll();
      return;
    }

    /* se si clicca a vuoto, inizia box di selezione */
    if (!this.boxStart) {
      if (!this.app.shiftDown) this.doc.clearSelection();
      this.boxStart = snap.point;
      this.app.render();
      return;
    }
    /* secondo click: chiudi box */
    this._applyBoxSelection(this.boxStart, snap.point);
    this.boxStart = null;
    this.app.renderer.selectionBox = null;
    this.app.refreshAll();
  }

  onMove(p, snap) {
    if (this.dragGrip) {
      /* mostra anteprima trascinando il grip */
      const ent = this.doc.getEntity(this.grippedEntId);
      if (ent) {
        const preview = Entity.fromJSON(ent.toJSON());
        preview.move(snap.point.x - this.gripStartPos.x, snap.point.y - this.gripStartPos.y);
        this.app.renderer.previewEntity = preview;
      }
      this.app.render();
      return;
    }
    if (this.boxStart) {
      const mode = (snap.point.x >= this.boxStart.x) ? 'window' : 'crossing';
      this.app.renderer.selectionBox = { p1: this.boxStart, p2: snap.point, mode };
      this.app.render();
    }
  }

  cancel() {
    this.boxStart = null;
    this.dragGrip = null;
    this.app.renderer.selectionBox = null;
    this.app.renderer.previewEntity = null;
    this.doc.clearSelection();
    this.app.refreshAll();
    this.prompt('Comando:');
  }

  _entityAt(p) {
    const tol = 6 / this.camera.zoom;
    for (let i = this.doc.entities.length - 1; i >= 0; i--) {
      const e = this.doc.entities[i];
      const l = this.doc.getLayer(e.layer);
      if (!l || !l.visible || l.locked) continue;
      if (e.hitTest(p, tol)) return e;
    }
    return null;
  }

  _gripUnder(p) {
    const tol = 6 / this.camera.zoom;
    for (const id of this.doc.selection) {
      const e = this.doc.getEntity(id);
      if (!e) continue;
      const grips = e.grips();
      for (let i = 0; i < grips.length; i++) {
        if (Geom.dist(p, grips[i]) <= tol) {
          return { entId: id, idx: i, point: grips[i] };
        }
      }
    }
    return null;
  }

  _applyBoxSelection(a, b) {
    const mode = (b.x >= a.x) ? 'window' : 'crossing';
    const rect = {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
    };
    for (const e of this.doc.entities) {
      const l = this.doc.getLayer(e.layer);
      if (!l || !l.visible || l.locked) continue;
      const b2 = e.bbox();
      const ok = mode === 'window'
        ? Geom.rectContains(rect, b2)
        : Geom.rectIntersect(rect, b2);
      if (ok) this.doc.select(e.id);
    }
  }
}
