/* Rettangolo allineato agli assi: p1 (basso-sx world), p2 (alto-dx) */
class RectangleEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'rectangle';
    this.p1 = opts.p1 || { x: 0, y: 0 };
    this.p2 = opts.p2 || { x: 1, y: 1 };
  }
  corners() {
    return [
      { x: this.p1.x, y: this.p1.y },
      { x: this.p2.x, y: this.p1.y },
      { x: this.p2.x, y: this.p2.y },
      { x: this.p1.x, y: this.p2.y },
    ];
  }
  render(ctx, camera) {
    const c = this.corners().map(p => camera.worldToScreen(p));
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  hitTest(p, tol) {
    const c = this.corners();
    for (let i = 0; i < 4; i++) {
      if (Geom.distPointSegment(p, c[i], c[(i + 1) % 4]) <= tol) return true;
    }
    return false;
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
    const c = this.corners();
    return [
      ...c,
      Geom.midpoint(c[0], c[1]),
      Geom.midpoint(c[1], c[2]),
      Geom.midpoint(c[2], c[3]),
      Geom.midpoint(c[3], c[0]),
    ];
  }
  move(dx, dy) {
    this.p1 = { x: this.p1.x + dx, y: this.p1.y + dy };
    this.p2 = { x: this.p2.x + dx, y: this.p2.y + dy };
  }
  rotate(c, a) {
    /* il rettangolo allineato non può ruotare senza diventare polilinea — converto */
    const corners = this.corners().map(p => Geom.rot(p, c, a));
    this.type = 'polyline';
    Object.setPrototypeOf(this, PolylineEntity.prototype);
    this.points = corners; this.closed = true;
    delete this.p1; delete this.p2;
  }
  scale(c, k) {
    this.p1 = { x: c.x + (this.p1.x - c.x) * k, y: c.y + (this.p1.y - c.y) * k };
    this.p2 = { x: c.x + (this.p2.x - c.x) * k, y: c.y + (this.p2.y - c.y) * k };
  }
  mirror(a, b) {
    this.p1 = Geom.mirror(this.p1, a, b);
    this.p2 = Geom.mirror(this.p2, a, b);
  }
  toJSON() {
    return { ...this.baseProps(), p1: this.p1, p2: this.p2 };
  }
}
