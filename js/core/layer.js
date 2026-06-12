class Layer {
  constructor(opts = {}) {
    this.name = opts.name || '0';
    this.color = opts.color || '#ffffff';
    this.visible = opts.visible !== false;
    this.locked = !!opts.locked;
    this.lineType = opts.lineType || 'CONTINUOUS';
    this.lineWeight = opts.lineWeight || 0.5;
  }
  toJSON() {
    return {
      name: this.name, color: this.color, visible: this.visible,
      locked: this.locked, lineType: this.lineType, lineWeight: this.lineWeight,
    };
  }
  static fromJSON(o) { return new Layer(o); }
}
