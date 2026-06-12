class CircleEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'circle';
    this.center = opts.center || { x: 0, y: 0 };
    this.radius = opts.radius || 1;
  }
  render(ctx, camera) {
    const c = camera.worldToScreen(this.center);
    const r = this.radius * camera.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  hitTest(p, tol) {
    return Geom.distPointCircle(p, this.center, this.radius) <= tol;
  }
  bbox() {
    return { x: this.center.x - this.radius, y: this.center.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
  }
  grips() {
    return [
      this.center,
      { x: this.center.x + this.radius, y: this.center.y },
      { x: this.center.x - this.radius, y: this.center.y },
      { x: this.center.x, y: this.center.y + this.radius },
      { x: this.center.x, y: this.center.y - this.radius },
    ];
  }
  move(dx, dy) { this.center = { x: this.center.x + dx, y: this.center.y + dy }; }
  rotate(c, a) { this.center = Geom.rot(this.center, c, a); }
  scale(c, k) {
    this.center = { x: c.x + (this.center.x - c.x) * k, y: c.y + (this.center.y - c.y) * k };
    this.radius *= Math.abs(k);
  }
  mirror(a, b) { this.center = Geom.mirror(this.center, a, b); }
  toJSON() {
    return { ...this.baseProps(), center: this.center, radius: this.radius };
  }
}
