/* Esportazione PNG e SVG */
const Exporters = {

  /* PNG dal canvas correntemente renderizzato */
  exportPNG(app) {
    const c = app.canvas;
    const dataUrl = c.toDataURL('image/png');
    Exporters._download(dataUrl, `${app.doc.name || 'disegno'}.png`);
  },

  exportSVG(app) {
    const bb = app.doc.bbox() || { x: -50, y: -50, w: 100, h: 100 };
    const pad = Math.max(bb.w, bb.h) * 0.05 + 1;
    const minX = bb.x - pad, minY = bb.y - pad;
    const w = bb.w + 2 * pad, h = bb.h + 2 * pad;
    const parts = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-minY - h} ${w} ${h}" width="${w * 4}" height="${h * 4}">`);
    parts.push(`<g transform="scale(1,-1)">`);
    for (const e of app.doc.entities) {
      const layer = app.doc.getLayer(e.layer);
      if (!layer || !layer.visible) continue;
      const color = Colors.resolve(e.color, layer.color);
      const lw = (e.lineWeight || layer.lineWeight || 0.5) * 0.2;
      const dash = LineTypes.resolve(e.lineType || layer.lineType);
      const dashAttr = dash.length ? ` stroke-dasharray="${dash.join(',')}"` : '';
      const baseAttr = `stroke="${color}" stroke-width="${lw}" fill="none"${dashAttr}`;
      parts.push(Exporters._entitySVG(e, baseAttr));
    }
    parts.push(`</g></svg>`);
    const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
    Exporters._download(URL.createObjectURL(blob), `${app.doc.name || 'disegno'}.svg`);
  },

  _entitySVG(e, attr) {
    switch (e.type) {
      case 'line':
        return `<line x1="${e.p1.x}" y1="${e.p1.y}" x2="${e.p2.x}" y2="${e.p2.y}" ${attr}/>`;
      case 'polyline': {
        const pts = e.points.map(p => `${p.x},${p.y}`).join(' ');
        return e.closed
          ? `<polygon points="${pts}" ${attr}/>`
          : `<polyline points="${pts}" ${attr}/>`;
      }
      case 'circle':
        return `<circle cx="${e.center.x}" cy="${e.center.y}" r="${e.radius}" ${attr}/>`;
      case 'arc': {
        const sp = { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) };
        const ep = { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) };
        const large = (e.endAngle - e.startAngle) % (Math.PI * 2) > Math.PI ? 1 : 0;
        return `<path d="M ${sp.x} ${sp.y} A ${e.radius} ${e.radius} 0 ${large} 0 ${ep.x} ${ep.y}" ${attr}/>`;
      }
      case 'rectangle': {
        const x = Math.min(e.p1.x, e.p2.x), y = Math.min(e.p1.y, e.p2.y);
        const w = Math.abs(e.p2.x - e.p1.x), h = Math.abs(e.p2.y - e.p1.y);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attr}/>`;
      }
      case 'ellipse':
        return `<ellipse cx="${e.center.x}" cy="${e.center.y}" rx="${e.rx}" ry="${e.ry}" ${attr}/>`;
      case 'point':
        return `<circle cx="${e.position.x}" cy="${e.position.y}" r="0.3" ${attr}/>`;
      case 'text':
        return `<text x="${e.position.x}" y="${e.position.y}" font-size="${e.height}" transform="scale(1,-1) translate(0,${-2 * e.position.y})" fill="${attr.match(/stroke="([^"]+)"/)[1]}">${(e.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`;
      case 'dimension':
        return `<line x1="${e.p1.x}" y1="${e.p1.y}" x2="${e.p2.x}" y2="${e.p2.y}" stroke="${attr.match(/stroke="([^"]+)"/)[1]}" stroke-width="0.1" stroke-dasharray="1,1"/>`;
      default:
        return '';
    }
  },

  _download(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
