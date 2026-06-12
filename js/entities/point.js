class PointEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'point';
    this.position = opts.position || { x: 0, y: 0 };
  }
  render(ctx, camera) {
    const s = camera.worldToScreen(this.position);
    const r = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y);
    ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6);
    ctx.stroke();
  }
  hitTest(p, tol) { return Geom.dist(p, this.position) <= tol; }
  bbox() { return { x: this.position.x, y: this.position.y, w: 0, h: 0 }; }
  grips() { return [this.position]; }
  move(dx, dy) { this.position = { x: this.position.x + dx, y: this.position.y + dy }; }
  rotate(c, a) { this.position = Geom.rot(this.position, c, a); }
  scale(c, k) {
    this.position = { x: c.x + (this.position.x - c.x) * k, y: c.y + (this.position.y - c.y) * k };
  }
  mirror(a, b) { this.position = Geom.mirror(this.position, a, b); }
  toJSON() { return { ...this.baseProps(), position: this.position }; }
}
