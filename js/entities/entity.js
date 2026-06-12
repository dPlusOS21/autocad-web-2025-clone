/* Classe base entità */
class Entity {
  constructor(opts = {}) {
    this.id = opts.id || Utils.uid();
    this.type = 'entity';
    this.layer = opts.layer || '0';
    this.color = opts.color || Colors.byLayer;
    this.lineType = opts.lineType || 'BYLAYER';
    this.lineWeight = opts.lineWeight || 0;
  }
  baseProps() {
    return {
      id: this.id, type: this.type, layer: this.layer,
      color: this.color, lineType: this.lineType, lineWeight: this.lineWeight,
    };
  }
  /* da implementare */
  render(ctx, camera) {}
  hitTest(p, tol) { return false; }
  bbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
  grips() { return []; }
  move(dx, dy) {}
  rotate(center, ang) {}
  scale(center, k) {}
  mirror(a, b) {}
  clone() { return Entity.fromJSON({ ...this.toJSON(), id: Utils.uid() }); }
  toJSON() { return this.baseProps(); }

  static fromJSON(o) {
    switch (o.type) {
      case 'line': return new LineEntity(o);
      case 'polyline': return new PolylineEntity(o);
      case 'circle': return new CircleEntity(o);
      case 'arc': return new ArcEntity(o);
      case 'rectangle': return new RectangleEntity(o);
      case 'ellipse': return new EllipseEntity(o);
      case 'point': return new PointEntity(o);
      case 'text': return new TextEntity(o);
      case 'dimension': return new DimensionEntity(o);
      default: return null;
    }
  }
}
