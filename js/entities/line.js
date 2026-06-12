class LineEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'line';
    this.p1 = opts.p1 || { x: 0, y: 0 };
    this.p2 = opts.p2 || { x: 0, y: 0 };
  }
  render(ctx, camera) {
    const s1 = camera.worldToScreen(this.p1);
    const s2 = camera.worldToScreen(this.p2);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }
  hitTest(p, tol) {
    return Geom.distPointSegment(p, this.p1, this.p2) <= tol;
  }
  bbox() {
    return {
      x: Math.min(this.p1.x, this.p2.x),
      y: Math.min(this.p1.y, this.p2.y),
      w: Math.abs(this.p2.x - this.p1.x),
      h: Math.abs(this.p2.y - this.p1.y),
    };
  }
  grips() {
    return [this.p1, Geom.midpoint(this.p1, this.p2), this.p2];
  }
  move(dx, dy) {
    this.p1 = { x: this.p1.x + dx, y: this.p1.y + dy };
    this.p2 = { x: this.p2.x + dx, y: this.p2.y + dy };
  }
  rotate(c, a) {
    this.p1 = Geom.rot(this.p1, c, a);
    this.p2 = Geom.rot(this.p2, c, a);
  }
  scale(c, k) {
    this.p1 = { x: c.x + (this.p1.x - c.x) * k, y: c.y + (this.p1.y - c.y) * k };
    this.p2 = { x: c.x + (this.p2.x - c.x) * k, y: c.y + (this.p2.y - c.y) * k };
  }
  mirror(a, b) {
    this.p1 = Geom.mirror(this.p1, a, b);
    this.p2 = Geom.mirror(this.p2, a, b);
  }
  length() { return Geom.dist(this.p1, this.p2); }
  angle() { return Geom.angle(this.p1, this.p2); }
  toJSON() {
    return { ...this.baseProps(), p1: this.p1, p2: this.p2 };
  }
}
