/* Geometria 2D — punti, vettori, intersezioni, hit-test */
const Geom = {

  /* ===== Punti / vettori ===== */
  pt(x, y) { return { x, y }; },
  add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
  sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
  scale(a, k) { return { x: a.x * k, y: a.y * k }; },
  dot(a, b) { return a.x * b.x + a.y * b.y; },
  cross(a, b) { return a.x * b.y - a.y * b.x; },
  len(a) { return Math.hypot(a.x, a.y); },
  dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); },
  norm(a) {
    const L = this.len(a) || 1;
    return { x: a.x / L, y: a.y / L };
  },
  angle(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  },
  rot(p, center, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = p.x - center.x, dy = p.y - center.y;
    return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
  },
  mirror(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    const px = a.x + t * dx, py = a.y + t * dy;
    return { x: 2 * px - p.x, y: 2 * py - p.y };
  },

  /* ===== Distanza punto -> primitive ===== */
  distPointSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) return this.dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return this.dist(p, { x: a.x + t * dx, y: a.y + t * dy });
  },
  closestOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) return { ...a };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy };
  },
  distPointCircle(p, c, r) {
    return Math.abs(this.dist(p, c) - r);
  },
  distPointArc(p, c, r, a0, a1) {
    let ang = Math.atan2(p.y - c.y, p.x - c.x);
    if (this.angleInArc(ang, a0, a1)) {
      return Math.abs(this.dist(p, c) - r);
    }
    const p0 = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
    const p1 = { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) };
    return Math.min(this.dist(p, p0), this.dist(p, p1));
  },
  angleInArc(ang, a0, a1) {
    // normalizza tutti in [0, 2π)
    const TAU = Math.PI * 2;
    ang = ((ang % TAU) + TAU) % TAU;
    a0 = ((a0 % TAU) + TAU) % TAU;
    a1 = ((a1 % TAU) + TAU) % TAU;
    if (a0 <= a1) return ang >= a0 - 1e-9 && ang <= a1 + 1e-9;
    return ang >= a0 - 1e-9 || ang <= a1 + 1e-9;
  },

  /* ===== Intersezioni ===== */
  lineLine(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-12) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t, u };
  },
  segSeg(p1, p2, p3, p4) {
    const r = this.lineLine(p1, p2, p3, p4);
    if (!r) return null;
    if (r.t >= -1e-9 && r.t <= 1 + 1e-9 && r.u >= -1e-9 && r.u <= 1 + 1e-9) return r;
    return null;
  },
  lineCircle(p1, p2, c, r) {
    const d = this.sub(p2, p1);
    const f = this.sub(p1, c);
    const A = this.dot(d, d);
    const B = 2 * this.dot(f, d);
    const C = this.dot(f, f) - r * r;
    let disc = B * B - 4 * A * C;
    if (disc < 0) return [];
    disc = Math.sqrt(disc);
    const t1 = (-B - disc) / (2 * A);
    const t2 = (-B + disc) / (2 * A);
    const res = [];
    res.push({ x: p1.x + t1 * d.x, y: p1.y + t1 * d.y, t: t1 });
    if (Math.abs(t1 - t2) > 1e-9)
      res.push({ x: p1.x + t2 * d.x, y: p1.y + t2 * d.y, t: t2 });
    return res;
  },

  /* ===== Bounds rect (AABB) ===== */
  bboxUnion(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
      h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
    };
  },
  pointInRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  },
  rectIntersect(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  },
  rectContains(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y &&
           inner.x + inner.w <= outer.x + outer.w &&
           inner.y + inner.h <= outer.y + outer.h;
  },

  /* ===== Helpers ===== */
  midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; },
  normalizeAngle(a) {
    const TAU = Math.PI * 2;
    return ((a % TAU) + TAU) % TAU;
  },
};
