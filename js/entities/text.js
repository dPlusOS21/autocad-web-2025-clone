class TextEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'text';
    this.position = opts.position || { x: 0, y: 0 };
    this.text = opts.text || '';
    this.height = opts.height || 2.5;
    this.rotation = opts.rotation || 0;
    this.align = opts.align || 'left';
  }
  render(ctx, camera) {
    const s = camera.worldToScreen(this.position);
    const fs = this.height * camera.zoom;
    if (fs < 4) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-this.rotation);
    ctx.font = `${fs}px "Segoe UI", sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = this.align;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
  hitTest(p, tol) {
    /* bounding box approssimato */
    const w = this.text.length * this.height * 0.6;
    const r = { x: this.position.x, y: this.position.y, w: w, h: this.height };
    return Geom.pointInRect(p, r) || Geom.distPointSegment(p, this.position, { x: this.position.x + w, y: this.position.y }) <= tol;
  }
  bbox() {
    const w = this.text.length * this.height * 0.6;
    return { x: this.position.x, y: this.position.y, w: w, h: this.height };
  }
  grips() { return [this.position]; }
  move(dx, dy) { this.position = { x: this.position.x + dx, y: this.position.y + dy }; }
  rotate(c, a) {
    this.position = Geom.rot(this.position, c, a);
    this.rotation += a;
  }
  scale(c, k) {
    this.position = { x: c.x + (this.position.x - c.x) * k, y: c.y + (this.position.y - c.y) * k };
    this.height *= Math.abs(k);
  }
  mirror(a, b) { this.position = Geom.mirror(this.position, a, b); }
  toJSON() {
    return { ...this.baseProps(), position: this.position, text: this.text, height: this.height, rotation: this.rotation, align: this.align };
  }
}
