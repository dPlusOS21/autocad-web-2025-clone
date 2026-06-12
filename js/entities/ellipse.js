/* Ellisse allineata agli assi */
class EllipseEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'ellipse';
    this.center = opts.center || { x: 0, y: 0 };
    this.rx = opts.rx || 1;
    this.ry = opts.ry || 0.5;
  }
  render(ctx, camera) {
    const c = camera.worldToScreen(this.center);
    const rx = this.rx * camera.zoom;
    const ry = this.ry * camera.zoom;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  hitTest(p, tol) {
    /* approssimazione: campiona 64 punti e prendi min distanza */
    let min = Infinity;
    const N = 64;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const pt = { x: this.center.x + this.rx * Math.cos(a), y: this.center.y + this.ry * Math.sin(a) };
      const d = Geom.dist(p, pt);
      if (d < min) min = d;
    }
    return min <= tol;
  }
  bbox() {
    return { x: this.center.x - this.rx, y: this.center.y - this.ry, w: this.rx * 2, h: this.ry * 2 };
  }
  grips() {
    return [
      this.center,
      { x: this.center.x + this.rx, y: this.center.y },
      { x: this.center.x - this.rx, y: this.center.y },
      { x: this.center.x, y: this.center.y + this.ry },
      { x: this.center.x, y: this.center.y - this.ry },
    ];
  }
  move(dx, dy) { this.center = { x: this.center.x + dx, y: this.center.y + dy }; }
  rotate(c, a) { this.center = Geom.rot(this.center, c, a); }
  scale(c, k) {
    this.center = { x: c.x + (this.center.x - c.x) * k, y: c.y + (this.center.y - c.y) * k };
    this.rx *= Math.abs(k); this.ry *= Math.abs(k);
  }
  mirror(a, b) { this.center = Geom.mirror(this.center, a, b); }
  toJSON() {
    return { ...this.baseProps(), center: this.center, rx: this.rx, ry: this.ry };
  }
}
