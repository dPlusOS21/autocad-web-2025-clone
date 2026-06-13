/* Utility globali */
const Utils = {
  /* ===== Unità di misura reali =====
     1 unità di disegno = 1 millimetro (coerente con DXF $INSUNITS=4 e LWT in mm).
     PX_PER_MM: pixel CSS per 1 mm fisico (riferimento standard 96 DPI → 96/25.4).
     A questo valore di zoom la vista è in scala 1:1 reale: 1 mm disegnato = 1 mm
     sullo schermo (con la precisione consentita dal browser/monitor). */
  MM_PER_UNIT: 1,
  PX_PER_MM: 96 / 25.4, // ≈ 3.7795275591
  uid() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  clamp(v, min, max) { return Math.min(Math.max(v, min), max); },
  deg2rad(d) { return d * Math.PI / 180; },
  rad2deg(r) { return r * 180 / Math.PI; },
  fmt(n, dec = 4) {
    if (!isFinite(n)) return '0';
    return (Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec)).toFixed(dec);
  },
  fmtCoord(p, dec = 4) {
    return `${this.fmt(p.x, dec)}, ${this.fmt(p.y, dec)}, 0.0000`;
  },
  deepClone(o) { return JSON.parse(JSON.stringify(o)); },
};

/* Color helpers */
const Colors = {
  byLayer: '#bylayer',
  AUTO: '#ffffff', /* stile ACI 7: bianco su sfondo scuro, nero su sfondo chiaro */
  isByLayer(c) { return c === '#bylayer' || c === 'BYLAYER' || c === 'byLayer'; },
  resolve(c, layerColor) { return this.isByLayer(c) ? layerColor : c; },
  /* Adatta il colore "AUTO/bianco" al tema corrente del canvas. */
  adapt(c, isLightTheme) {
    if (!c) return isLightTheme ? '#000000' : '#ffffff';
    const lc = c.toLowerCase();
    if (lc === '#ffffff' || lc === '#fff' || lc === 'white') {
      return isLightTheme ? '#000000' : '#ffffff';
    }
    return c;
  },
};

/* Linetype helpers — restituisce pattern Canvas.setLineDash */
const LineTypes = {
  CONTINUOUS: [],
  DASHED: [10, 6],
  DOTTED: [1, 4],
  DASHDOT: [10, 4, 2, 4],
  CENTER: [20, 4, 6, 4],
  BYLAYER: null,
  resolve(name, layerLineType) {
    if (name === 'BYLAYER' && layerLineType) return this[layerLineType] || [];
    return this[name] || [];
  }
};
