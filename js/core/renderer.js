/* Renderer Canvas2D — disegna grid, assi, entità, selezione, anteprima */
class Renderer {
  constructor(canvas, doc, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.doc = doc;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;
    this.showGrid = true;
    this.showAxes = true;
    this.showLwt = false;
    this.gridSpacing = 10;
    /* I colori vengono letti dalle CSS custom properties — Theme.apply() li aggiorna */
    this.bgColor = '#2b2b2b';
    this.gridMinor = '#3a3a3a';
    this.gridMajor = '#4a4a4a';
    this.axisX = '#aa3333';
    this.axisY = '#33aa33';
    this.crosshairColor = '#cfcfcf';
    this.previewPoints = null;
    this.previewEntity = null;
    this.snapMarker = null;
    this.selectionBox = null;
    this.cursorScreen = null;
    this.cursorVisible = false;
    this.crosshair = true;
    this.orthoOn = false;
    this.polarOn = false;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(r.width * this.dpr);
    this.canvas.height = Math.floor(r.height * this.dpr);
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.camera.setView(r.width, r.height);
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.camera.viewW, this.camera.viewH);

    if (this.showGrid) this._drawGrid();
    if (this.showAxes) this._drawAxes();

    /* Entità ordinate per layer */
    for (const ent of this.doc.entities) {
      const layer = this.doc.getLayer(ent.layer);
      if (!layer || !layer.visible) continue;
      this._drawEntity(ent, layer, false);
    }

    /* Selezione: bordo evidenziato + grip */
    for (const id of this.doc.selection) {
      const ent = this.doc.getEntity(id);
      if (!ent) continue;
      const layer = this.doc.getLayer(ent.layer);
      this._drawEntity(ent, layer, true);
      this._drawGrips(ent);
    }

    /* Anteprima durante il disegno */
    if (this.previewEntity) {
      this._drawEntity(this.previewEntity, this.doc.getLayer(this.previewEntity.layer) || this.doc.currentLayer(), false, true);
    }
    if (this.previewPoints && this.previewPoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const p0 = this.camera.worldToScreen(this.previewPoints[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < this.previewPoints.length; i++) {
        const p = this.camera.worldToScreen(this.previewPoints[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (this.selectionBox) this._drawSelectionBox();
    if (this.snapMarker) this._drawSnapMarker();
    if (this.crosshair && this.cursorScreen && this.cursorVisible) this._drawCrosshair();

    ctx.restore();
  }

  /* ===== Grid ===== */
  _drawGrid() {
    const ctx = this.ctx;
    const cam = this.camera;
    /* spacing adattivo: 1, 2, 5, 10, 20, 50, 100... */
    const pxPerUnit = cam.zoom;
    let step = 1;
    while (step * pxPerUnit > 80) step /= 10;
    while (step * pxPerUnit < 8) step *= 10;
    const majorEvery = 10;

    const topLeft = cam.screenToWorld({ x: 0, y: 0 });
    const botRight = cam.screenToWorld({ x: cam.viewW, y: cam.viewH });
    const xMin = Math.floor(topLeft.x / step) * step;
    const xMax = Math.ceil(botRight.x / step) * step;
    const yMin = Math.floor(botRight.y / step) * step;
    const yMax = Math.ceil(topLeft.y / step) * step;

    ctx.lineWidth = 1;
    ctx.strokeStyle = this.gridMinor;
    ctx.beginPath();
    for (let x = xMin; x <= xMax + 1e-9; x += step) {
      if (Math.abs(Math.round(x / step) % majorEvery) === 0) continue;
      const sx = cam.worldToScreen({ x, y: 0 }).x;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, cam.viewH);
    }
    for (let y = yMin; y <= yMax + 1e-9; y += step) {
      if (Math.abs(Math.round(y / step) % majorEvery) === 0) continue;
      const sy = cam.worldToScreen({ x: 0, y }).y;
      ctx.moveTo(0, sy); ctx.lineTo(cam.viewW, sy);
    }
    ctx.stroke();

    ctx.strokeStyle = this.gridMajor;
    ctx.beginPath();
    for (let x = xMin; x <= xMax + 1e-9; x += step) {
      if (Math.abs(Math.round(x / step) % majorEvery) !== 0) continue;
      const sx = cam.worldToScreen({ x, y: 0 }).x;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, cam.viewH);
    }
    for (let y = yMin; y <= yMax + 1e-9; y += step) {
      if (Math.abs(Math.round(y / step) % majorEvery) !== 0) continue;
      const sy = cam.worldToScreen({ x: 0, y }).y;
      ctx.moveTo(0, sy); ctx.lineTo(cam.viewW, sy);
    }
    ctx.stroke();
    this.gridStep = step;
  }

  _drawAxes() {
    const ctx = this.ctx, cam = this.camera;
    const o = cam.worldToScreen({ x: 0, y: 0 });
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = this.axisX;
    ctx.beginPath(); ctx.moveTo(0, o.y); ctx.lineTo(cam.viewW, o.y); ctx.stroke();
    ctx.strokeStyle = this.axisY;
    ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, cam.viewH); ctx.stroke();
  }

  /* ===== Entità ===== */
  _drawEntity(ent, layer, selected, isPreview = false) {
    const ctx = this.ctx;
    const rawColor = Colors.resolve(ent.color, layer ? layer.color : '#ffffff');
    const isLight = document.body.classList.contains('theme-light');
    const color = Colors.adapt(rawColor, isLight);
    const dash = LineTypes.resolve(ent.lineType || 'BYLAYER', layer ? layer.lineType : 'CONTINUOUS');
    ctx.save();
    ctx.strokeStyle = selected ? '#3399ff' : color;
    ctx.fillStyle = color;
    let lw = 1;
    if (this.showLwt) lw = Math.max(1, (ent.lineWeight || (layer ? layer.lineWeight : 0.5)) * this.camera.zoom / 25);
    ctx.lineWidth = selected ? lw + 1 : lw;
    if (isPreview) {
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([6, 4]);
    } else if (dash.length) {
      ctx.setLineDash(dash);
    }
    ent.render(ctx, this.camera);
    ctx.restore();
  }

  _drawGrips(ent) {
    const ctx = this.ctx;
    const grips = ent.grips();
    ctx.save();
    ctx.fillStyle = '#3399ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (const g of grips) {
      const s = this.camera.worldToScreen(g);
      ctx.beginPath();
      ctx.rect(s.x - 4, s.y - 4, 8, 8);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  _drawSelectionBox() {
    const { p1, p2, mode } = this.selectionBox;
    const s1 = this.camera.worldToScreen(p1);
    const s2 = this.camera.worldToScreen(p2);
    const x = Math.min(s1.x, s2.x), y = Math.min(s1.y, s2.y);
    const w = Math.abs(s1.x - s2.x), h = Math.abs(s1.y - s2.y);
    const ctx = this.ctx;
    ctx.save();
    if (mode === 'window') {
      ctx.fillStyle = 'rgba(80,160,255,0.12)';
      ctx.strokeStyle = '#3399ff';
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(100,255,100,0.10)';
      ctx.strokeStyle = '#33dd66';
      ctx.setLineDash([6, 4]);
    }
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  _drawSnapMarker() {
    const ctx = this.ctx;
    const m = this.snapMarker;
    const s = this.camera.worldToScreen(m.point);
    ctx.save();
    ctx.strokeStyle = '#f1c40f';
    ctx.fillStyle = 'rgba(241,196,15,0.2)';
    ctx.lineWidth = 2;
    const r = 7;
    ctx.beginPath();
    switch (m.type) {
      case 'endpoint': // quadrato
        ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
        break;
      case 'midpoint': // triangolo
        ctx.moveTo(s.x, s.y - r);
        ctx.lineTo(s.x + r, s.y + r);
        ctx.lineTo(s.x - r, s.y + r);
        ctx.closePath();
        break;
      case 'center': // cerchio
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        break;
      case 'intersection': // X
        ctx.moveTo(s.x - r, s.y - r); ctx.lineTo(s.x + r, s.y + r);
        ctx.moveTo(s.x + r, s.y - r); ctx.lineTo(s.x - r, s.y + r);
        break;
      case 'perpendicular':
        ctx.moveTo(s.x - r, s.y - r); ctx.lineTo(s.x - r, s.y + r);
        ctx.lineTo(s.x + r, s.y + r);
        ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + r);
        break;
      case 'quadrant': // diamante
        ctx.moveTo(s.x, s.y - r);
        ctx.lineTo(s.x + r, s.y);
        ctx.lineTo(s.x, s.y + r);
        ctx.lineTo(s.x - r, s.y);
        ctx.closePath();
        break;
      case 'grid':
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        break;
      default:
        ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.fill(); ctx.stroke();

    if (m.type !== 'grid') {
      ctx.fillStyle = '#f1c40f';
      ctx.font = '10px Segoe UI';
      ctx.fillText(m.label || m.type, s.x + 10, s.y - 10);
    }
    ctx.restore();
  }

  _drawCrosshair() {
    const ctx = this.ctx;
    const s = this.cursorScreen;
    const len = 16;
    ctx.save();
    ctx.strokeStyle = this.crosshairColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
    ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
    ctx.rect(s.x - 5, s.y - 5, 10, 10);
    ctx.stroke();
    ctx.restore();
  }
}
