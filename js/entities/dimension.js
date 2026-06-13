/* Quota lineare orizzontale/verticale/allineata */
class DimensionEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'dimension';
    this.p1 = opts.p1 || { x: 0, y: 0 };
    this.p2 = opts.p2 || { x: 0, y: 0 };
    this.offset = opts.offset || { x: 0, y: 1 }; // posizione linea di quota
    this.kind = opts.kind || 'aligned'; // aligned | horizontal | vertical
    this.textHeight = opts.textHeight || 2.5;
    this.color = opts.color || '#f1c40f';
  }
  _measure() {
    if (this.kind === 'horizontal') return Math.abs(this.p2.x - this.p1.x);
    if (this.kind === 'vertical')   return Math.abs(this.p2.y - this.p1.y);
    return Geom.dist(this.p1, this.p2);
  }
  _dimLineEndpoints() {
    /* la linea di quota passa per "offset" parallela al segmento p1-p2 */
    let dir, perp;
    if (this.kind === 'horizontal') { dir = { x: 1, y: 0 }; perp = { x: 0, y: 1 }; }
    else if (this.kind === 'vertical') { dir = { x: 0, y: 1 }; perp = { x: 1, y: 0 }; }
    else {
      const v = Geom.sub(this.p2, this.p1);
      dir = Geom.norm(v);
      perp = { x: -dir.y, y: dir.x };
    }
    /* proiezione di p1 sulla retta passante per offset parallela a dir */
    const projT = (p) => Geom.dot(Geom.sub(p, this.offset), dir);
    const t1 = projT(this.p1);
    const t2 = projT(this.p2);
    const a = Geom.add(this.offset, Geom.scale(dir, t1));
    const b = Geom.add(this.offset, Geom.scale(dir, t2));
    return { a, b, dir, perp };
  }
  render(ctx, camera) {
    const { a, b, perp } = this._dimLineEndpoints();
    const sA = camera.worldToScreen(a), sB = camera.worldToScreen(b);
    const sP1 = camera.worldToScreen(this.p1), sP2 = camera.worldToScreen(this.p2);
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    /* linee di estensione */
    ctx.beginPath();
    ctx.moveTo(sP1.x, sP1.y); ctx.lineTo(sA.x, sA.y);
    ctx.moveTo(sP2.x, sP2.y); ctx.lineTo(sB.x, sB.y);
    ctx.stroke();
    /* linea di quota */
    ctx.beginPath();
    ctx.moveTo(sA.x, sA.y); ctx.lineTo(sB.x, sB.y);
    ctx.stroke();
    /* frecce */
    const arrowSize = 8;
    const ang = Math.atan2(sB.y - sA.y, sB.x - sA.x);
    const drawArrow = (s, dir) => {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - arrowSize * Math.cos(ang + dir * 0.3), s.y - arrowSize * Math.sin(ang + dir * 0.3));
      ctx.lineTo(s.x - arrowSize * Math.cos(ang - dir * 0.3), s.y - arrowSize * Math.sin(ang - dir * 0.3));
      ctx.closePath();
      ctx.fill();
    };
    drawArrow(sA, -1);
    drawArrow(sB, 1);
    /* testo */
    const dist = this._measure();
    const label = `${Utils.fmt(dist, 2)} mm`;
    const mid = { x: (sA.x + sB.x) / 2, y: (sA.y + sB.y) / 2 };
    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(ang);
    ctx.font = `${this.textHeight * camera.zoom}px "Segoe UI"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -2);
    ctx.restore();

    ctx.restore();
  }
  hitTest(p, tol) {
    const { a, b } = this._dimLineEndpoints();
    return Geom.distPointSegment(p, a, b) <= tol;
  }
  bbox() {
    const { a, b } = this._dimLineEndpoints();
    const xs = [this.p1.x, this.p2.x, a.x, b.x];
    const ys = [this.p1.y, this.p2.y, a.y, b.y];
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }
  grips() { return [this.p1, this.p2, this.offset]; }
  move(dx, dy) {
    this.p1 = { x: this.p1.x + dx, y: this.p1.y + dy };
    this.p2 = { x: this.p2.x + dx, y: this.p2.y + dy };
    this.offset = { x: this.offset.x + dx, y: this.offset.y + dy };
  }
  rotate(c, a) {
    this.p1 = Geom.rot(this.p1, c, a);
    this.p2 = Geom.rot(this.p2, c, a);
    this.offset = Geom.rot(this.offset, c, a);
  }
  scale(c, k) {
    this.p1 = { x: c.x + (this.p1.x - c.x) * k, y: c.y + (this.p1.y - c.y) * k };
    this.p2 = { x: c.x + (this.p2.x - c.x) * k, y: c.y + (this.p2.y - c.y) * k };
    this.offset = { x: c.x + (this.offset.x - c.x) * k, y: c.y + (this.offset.y - c.y) * k };
  }
  mirror(a, b) {
    this.p1 = Geom.mirror(this.p1, a, b);
    this.p2 = Geom.mirror(this.p2, a, b);
    this.offset = Geom.mirror(this.offset, a, b);
  }
  toJSON() {
    return { ...this.baseProps(), p1: this.p1, p2: this.p2, offset: this.offset, kind: this.kind, textHeight: this.textHeight };
  }
}
