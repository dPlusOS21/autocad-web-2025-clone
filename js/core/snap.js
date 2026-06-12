/* SnapEngine: object snap + grid snap + ortho + polar */
class SnapEngine {
  constructor(doc, camera) {
    this.doc = doc;
    this.camera = camera;
    this.enabled = true;
    this.gridSnap = true;
    this.ortho = false;
    this.polar = false;
    this.polarAngle = 15; // gradi
    this.activeTypes = new Set(['endpoint', 'midpoint', 'center', 'intersection', 'perpendicular', 'quadrant']);
    this.tolerancePx = 12;
  }

  /* Restituisce il miglior snap entro tolleranza, oppure null.
     refPoint: punto di riferimento opzionale (es. ultimo click) per ortho/polar/perpendicular */
  query(worldPoint, refPoint = null) {
    const tol = this.tolerancePx / this.camera.zoom;
    let best = null;

    if (this.enabled) {
      for (const ent of this.doc.entities) {
        const layer = this.doc.getLayer(ent.layer);
        if (!layer || !layer.visible) continue;
        const cands = this._candidatesFor(ent, worldPoint, refPoint, tol);
        for (const c of cands) {
          const d = Geom.dist(c.point, worldPoint);
          if (d <= tol && (!best || d < best.d)) best = { ...c, d };
        }
      }
      /* intersezioni: coppie di entità */
      if (this.activeTypes.has('intersection')) {
        for (let i = 0; i < this.doc.entities.length; i++) {
          const ei = this.doc.entities[i];
          const li = this.doc.getLayer(ei.layer);
          if (!li || !li.visible) continue;
          for (let j = i + 1; j < this.doc.entities.length; j++) {
            const ej = this.doc.entities[j];
            const lj = this.doc.getLayer(ej.layer);
            if (!lj || !lj.visible) continue;
            const inters = this._entityIntersections(ei, ej);
            for (const p of inters) {
              const d = Geom.dist(p, worldPoint);
              if (d <= tol && (!best || d < best.d)) best = { point: p, type: 'intersection', label: 'Intersezione', d };
            }
          }
        }
      }
    }

    if (best) return best;

    /* applica ortho/polar a refPoint */
    let snapped = worldPoint;
    if (refPoint && this.ortho) {
      const dx = worldPoint.x - refPoint.x;
      const dy = worldPoint.y - refPoint.y;
      snapped = Math.abs(dx) > Math.abs(dy)
        ? { x: worldPoint.x, y: refPoint.y }
        : { x: refPoint.x, y: worldPoint.y };
      return { point: snapped, type: 'ortho', label: 'Orto' };
    }
    if (refPoint && this.polar) {
      const ang = Math.atan2(worldPoint.y - refPoint.y, worldPoint.x - refPoint.x);
      const step = Utils.deg2rad(this.polarAngle);
      const snAng = Math.round(ang / step) * step;
      const d = Geom.dist(refPoint, worldPoint);
      snapped = { x: refPoint.x + d * Math.cos(snAng), y: refPoint.y + d * Math.sin(snAng) };
      return { point: snapped, type: 'polar', label: `Polar ${Utils.fmt(Utils.rad2deg(snAng), 1)}°` };
    }

    /* grid snap */
    if (this.gridSnap) {
      const step = window.renderer ? window.renderer.gridStep || 1 : 1;
      const gx = Math.round(worldPoint.x / step) * step;
      const gy = Math.round(worldPoint.y / step) * step;
      if (Math.hypot(gx - worldPoint.x, gy - worldPoint.y) <= tol * 0.7) {
        return { point: { x: gx, y: gy }, type: 'grid', label: 'Griglia' };
      }
    }

    return { point: worldPoint, type: 'free', label: '' };
  }

  _candidatesFor(ent, p, refPoint, tol) {
    const out = [];
    const A = this.activeTypes;
    if (ent.type === 'line') {
      if (A.has('endpoint')) {
        out.push({ point: ent.p1, type: 'endpoint', label: 'Estremo' });
        out.push({ point: ent.p2, type: 'endpoint', label: 'Estremo' });
      }
      if (A.has('midpoint')) out.push({ point: Geom.midpoint(ent.p1, ent.p2), type: 'midpoint', label: 'Mediano' });
      if (A.has('perpendicular') && refPoint) {
        const perp = Geom.closestOnSegment(refPoint, ent.p1, ent.p2);
        out.push({ point: perp, type: 'perpendicular', label: 'Perpendicolare' });
      }
    }
    else if (ent.type === 'polyline') {
      if (A.has('endpoint')) {
        for (const pt of ent.points) out.push({ point: pt, type: 'endpoint', label: 'Estremo' });
      }
      if (A.has('midpoint')) {
        for (let i = 0; i < ent.points.length - 1; i++) {
          out.push({ point: Geom.midpoint(ent.points[i], ent.points[i + 1]), type: 'midpoint', label: 'Mediano' });
        }
      }
    }
    else if (ent.type === 'circle') {
      if (A.has('center')) out.push({ point: ent.center, type: 'center', label: 'Centro' });
      if (A.has('quadrant')) {
        out.push({ point: { x: ent.center.x + ent.radius, y: ent.center.y }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x - ent.radius, y: ent.center.y }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x, y: ent.center.y + ent.radius }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x, y: ent.center.y - ent.radius }, type: 'quadrant', label: 'Quadrante' });
      }
    }
    else if (ent.type === 'arc') {
      if (A.has('center')) out.push({ point: ent.center, type: 'center', label: 'Centro' });
      if (A.has('endpoint')) {
        out.push({ point: ent.startPoint(), type: 'endpoint', label: 'Estremo' });
        out.push({ point: ent.endPoint(), type: 'endpoint', label: 'Estremo' });
      }
      if (A.has('midpoint')) out.push({ point: ent.midPoint(), type: 'midpoint', label: 'Mediano arco' });
    }
    else if (ent.type === 'rectangle') {
      const c = ent.corners();
      if (A.has('endpoint')) for (const p of c) out.push({ point: p, type: 'endpoint', label: 'Estremo' });
      if (A.has('midpoint')) {
        for (let i = 0; i < 4; i++) out.push({ point: Geom.midpoint(c[i], c[(i + 1) % 4]), type: 'midpoint', label: 'Mediano' });
      }
    }
    else if (ent.type === 'ellipse') {
      if (A.has('center')) out.push({ point: ent.center, type: 'center', label: 'Centro' });
      if (A.has('quadrant')) {
        out.push({ point: { x: ent.center.x + ent.rx, y: ent.center.y }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x - ent.rx, y: ent.center.y }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x, y: ent.center.y + ent.ry }, type: 'quadrant', label: 'Quadrante' });
        out.push({ point: { x: ent.center.x, y: ent.center.y - ent.ry }, type: 'quadrant', label: 'Quadrante' });
      }
    }
    else if (ent.type === 'point') {
      if (A.has('endpoint')) out.push({ point: ent.position, type: 'endpoint', label: 'Punto' });
    }
    return out;
  }

  _entityIntersections(a, b) {
    const segs = (e) => {
      if (e.type === 'line') return [[e.p1, e.p2]];
      if (e.type === 'polyline') {
        const s = [];
        for (let i = 0; i < e.points.length - 1; i++) s.push([e.points[i], e.points[i + 1]]);
        if (e.closed && e.points.length > 2) s.push([e.points[e.points.length - 1], e.points[0]]);
        return s;
      }
      if (e.type === 'rectangle') {
        const c = e.corners();
        return [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]];
      }
      return null;
    };
    const sa = segs(a), sb = segs(b);
    const out = [];
    if (sa && sb) {
      for (const s1 of sa) for (const s2 of sb) {
        const r = Geom.segSeg(s1[0], s1[1], s2[0], s2[1]);
        if (r) out.push({ x: r.x, y: r.y });
      }
    } else if (sa && b.type === 'circle') {
      for (const s of sa) {
        for (const p of Geom.lineCircle(s[0], s[1], b.center, b.radius)) {
          if (p.t >= -1e-9 && p.t <= 1 + 1e-9) out.push({ x: p.x, y: p.y });
        }
      }
    } else if (sb && a.type === 'circle') {
      for (const s of sb) {
        for (const p of Geom.lineCircle(s[0], s[1], a.center, a.radius)) {
          if (p.t >= -1e-9 && p.t <= 1 + 1e-9) out.push({ x: p.x, y: p.y });
        }
      }
    }
    return out;
  }
}
