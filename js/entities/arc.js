/* Arco — center, radius, startAngle, endAngle (in radianti, antiorario world) */
class ArcEntity extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.type = 'arc';
    this.center = opts.center || { x: 0, y: 0 };
    this.radius = opts.radius || 1;
    this.startAngle = opts.startAngle ?? 0;
    this.endAngle = opts.endAngle ?? Math.PI;
  }
  render(ctx, camera) {
    const c = camera.worldToScreen(this.center);
    const r = this.radius * camera.zoom;
    /* Canvas Y inverso: angoli moltiplicati per -1 */
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, -this.endAngle, -this.startAngle, false);
    ctx.stroke();
  }
  hitTest(p, tol) {
    return Geom.distPointArc(p, this.center, this.radius, this.startAngle, this.endAngle) <= tol;
  }
  startPoint() {
    return { x: this.center.x + this.radius * Math.cos(this.startAngle), y: this.center.y + this.radius * Math.sin(this.startAngle) };
  }
  endPoint() {
    return { x: this.center.x + this.radius * Math.cos(this.endAngle), y: this.center.y + this.radius * Math.sin(this.endAngle) };
  }
  midPoint() {
    let mid = (this.startAngle + this.endAngle) / 2;
    if (this.endAngle < this.startAngle) mid += Math.PI;
    return { x: this.center.x + this.radius * Math.cos(mid), y: this.center.y + this.radius * Math.sin(mid) };
  }
  bbox() {
    /* approx con bbox cerchio */
    return { x: this.center.x - this.radius, y: this.center.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
  }
  grips() {
    return [this.center, this.startPoint(), this.endPoint(), this.midPoint()];
  }
  move(dx, dy) { this.center = { x: this.center.x + dx, y: this.center.y + dy }; }
  rotate(c, a) {
    this.center = Geom.rot(this.center, c, a);
    this.startAngle += a;
    this.endAngle += a;
  }
  scale(c, k) {
    this.center = { x: c.x + (this.center.x - c.x) * k, y: c.y + (this.center.y - c.y) * k };
    this.radius *= Math.abs(k);
  }
  mirror(a, b) {
    this.center = Geom.mirror(this.center, a, b);
    const sp = Geom.mirror(this.startPoint(), a, b);
    const ep = Geom.mirror(this.endPoint(), a, b);
    /* lo specchio inverte il senso */
    this.startAngle = Math.atan2(ep.y - this.center.y, ep.x - this.center.x);
    this.endAngle = Math.atan2(sp.y - this.center.y, sp.x - this.center.x);
  }
  toJSON() {
    return { ...this.baseProps(), center: this.center, radius: this.radius, startAngle: this.startAngle, endAngle: this.endAngle };
  }
}
