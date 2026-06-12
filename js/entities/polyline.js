class PolylineEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'polyline';
    this.points = opts.points ? opts.points.map(p => ({ x: p.x, y: p.y })) : [];
    this.closed = !!opts.closed;
  }
  render(ctx, camera) {
    if (this.points.length < 2) return;
    ctx.beginPath();
    const s0 = camera.worldToScreen(this.points[0]);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < this.points.length; i++) {
      const s = camera.worldToScreen(this.points[i]);
      ctx.lineTo(s.x, s.y);
    }
    if (this.closed) ctx.closePath();
    ctx.stroke();
  }
  hitTest(p, tol) {
    for (let i = 0; i < this.points.length - 1; i++) {
      if (Geom.distPointSegment(p, this.points[i], this.points[i + 1]) <= tol) return true;
    }
    if (this.closed && this.points.length > 2) {
      if (Geom.distPointSegment(p, this.points[this.points.length - 1], this.points[0]) <= tol) return true;
    }
    return false;
  }
  bbox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  grips() { return this.points.slice(); }
  move(dx, dy) {
    this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  }
  rotate(c, a) { this.points = this.points.map(p => Geom.rot(p, c, a)); }
  scale(c, k) {
    this.points = this.points.map(p => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
  }
  mirror(a, b) { this.points = this.points.map(p => Geom.mirror(p, a, b)); }
  toJSON() {
    return { ...this.baseProps(), points: this.points, closed: this.closed };
  }
}
