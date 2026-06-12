/* DXF I/O — formato testuale R12/2000 minimale, compatibile AutoCAD/QCAD */

const DXF = {

  /* ==================== EXPORT ==================== */
  exportDXF(app) {
    const lines = [];
    const w = (code, val) => { lines.push(String(code)); lines.push(String(val)); };

    /* HEADER */
    w(0, 'SECTION'); w(2, 'HEADER');
    w(9, '$ACADVER'); w(1, 'AC1015');
    w(9, '$INSUNITS'); w(70, 4);
    w(0, 'ENDSEC');

    /* TABLES — layer */
    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, app.doc.layers.length);
    for (const l of app.doc.layers) {
      w(0, 'LAYER'); w(2, l.name); w(70, 0);
      w(62, DXF._aciFromColor(l.color));
      w(6, l.lineType || 'CONTINUOUS');
    }
    w(0, 'ENDTAB');
    w(0, 'ENDSEC');

    /* ENTITIES */
    w(0, 'SECTION'); w(2, 'ENTITIES');
    for (const e of app.doc.entities) {
      DXF._writeEntity(e, w, app.doc);
    }
    w(0, 'ENDSEC');
    w(0, 'EOF');

    const blob = new Blob([lines.join('\n')], { type: 'application/dxf' });
    Exporters._download(URL.createObjectURL(blob), `${app.doc.name || 'disegno'}.dxf`);
  },

  _writeEntity(e, w, doc) {
    const layer = doc.getLayer(e.layer);
    const acolor = DXF._aciFromColor(Colors.resolve(e.color, layer ? layer.color : '#ffffff'));
    switch (e.type) {
      case 'line':
        w(0, 'LINE'); w(8, e.layer); w(62, acolor);
        w(10, e.p1.x); w(20, e.p1.y); w(30, 0);
        w(11, e.p2.x); w(21, e.p2.y); w(31, 0);
        break;
      case 'polyline':
        w(0, 'LWPOLYLINE'); w(8, e.layer); w(62, acolor);
        w(90, e.points.length); w(70, e.closed ? 1 : 0);
        for (const p of e.points) { w(10, p.x); w(20, p.y); }
        break;
      case 'circle':
        w(0, 'CIRCLE'); w(8, e.layer); w(62, acolor);
        w(10, e.center.x); w(20, e.center.y); w(30, 0);
        w(40, e.radius);
        break;
      case 'arc':
        w(0, 'ARC'); w(8, e.layer); w(62, acolor);
        w(10, e.center.x); w(20, e.center.y); w(30, 0);
        w(40, e.radius);
        w(50, Utils.rad2deg(e.startAngle));
        w(51, Utils.rad2deg(e.endAngle));
        break;
      case 'rectangle': {
        const c = e.corners ? e.corners() : [
          { x: e.p1.x, y: e.p1.y }, { x: e.p2.x, y: e.p1.y },
          { x: e.p2.x, y: e.p2.y }, { x: e.p1.x, y: e.p2.y },
        ];
        w(0, 'LWPOLYLINE'); w(8, e.layer); w(62, acolor);
        w(90, 4); w(70, 1);
        for (const p of c) { w(10, p.x); w(20, p.y); }
        break;
      }
      case 'ellipse':
        w(0, 'ELLIPSE'); w(8, e.layer); w(62, acolor);
        w(10, e.center.x); w(20, e.center.y); w(30, 0);
        w(11, e.rx); w(21, 0); w(31, 0);
        w(40, e.ry / e.rx);
        w(41, 0); w(42, Math.PI * 2);
        break;
      case 'point':
        w(0, 'POINT'); w(8, e.layer); w(62, acolor);
        w(10, e.position.x); w(20, e.position.y); w(30, 0);
        break;
      case 'text':
        w(0, 'TEXT'); w(8, e.layer); w(62, acolor);
        w(10, e.position.x); w(20, e.position.y); w(30, 0);
        w(40, e.height); w(1, e.text || '');
        w(50, Utils.rad2deg(e.rotation || 0));
        break;
      case 'dimension':
        /* esportato come segmento + testo per compatibilità */
        w(0, 'LINE'); w(8, e.layer); w(62, acolor);
        w(10, e.p1.x); w(20, e.p1.y); w(30, 0);
        w(11, e.p2.x); w(21, e.p2.y); w(31, 0);
        break;
    }
  },

  /* ==================== IMPORT ==================== */
  importDXF(text, doc) {
    const tokens = DXF._tokenize(text);
    let i = 0;
    let inEntities = false;
    const added = [];

    while (i < tokens.length) {
      const code = tokens[i].code;
      const val = tokens[i].val;
      if (code === 0 && val === 'SECTION') {
        const next = tokens[i + 1];
        if (next && next.code === 2 && next.val === 'ENTITIES') inEntities = true;
        i += 2; continue;
      }
      if (code === 0 && val === 'ENDSEC') { inEntities = false; i++; continue; }
      if (!inEntities) { i++; continue; }
      if (code === 0) {
        const result = DXF._readEntity(tokens, i);
        if (result && result.entity) {
          doc.addEntity(result.entity);
          added.push(result.entity);
        }
        i = result ? result.next : i + 1;
        continue;
      }
      i++;
    }
    return added.length;
  },

  _tokenize(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      const val  = lines[i + 1].trim();
      if (!isNaN(code)) out.push({ code, val });
    }
    return out;
  },

  _readEntity(tokens, start) {
    const type = tokens[start].val;
    const props = { layer: '0' };
    let i = start + 1;
    const polyPoints = [];
    while (i < tokens.length && tokens[i].code !== 0) {
      const { code, val } = tokens[i];
      const num = parseFloat(val);
      switch (code) {
        case 8: props.layer = val; break;
        case 1: props.text = val; break;
        case 10: props.x1 = num; break;
        case 20: props.y1 = num; break;
        case 11: props.x2 = num; break;
        case 21: props.y2 = num; break;
        case 40: props.r = num; break;
        case 41: props.ratio = num; break;
        case 50: props.a0 = num; break;
        case 51: props.a1 = num; break;
        case 70: props.flags = num; break;
        case 62: props.colorIdx = num; break;
      }
      /* LWPOLYLINE accumula 10/20 */
      if (type === 'LWPOLYLINE' && code === 10) polyPoints.push({ x: num, y: 0 });
      if (type === 'LWPOLYLINE' && code === 20 && polyPoints.length)
        polyPoints[polyPoints.length - 1].y = num;
      i++;
    }
    let entity = null;
    switch (type) {
      case 'LINE':
        entity = new LineEntity({ p1: { x: props.x1 || 0, y: props.y1 || 0 }, p2: { x: props.x2 || 0, y: props.y2 || 0 }, layer: props.layer });
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        entity = new PolylineEntity({ points: polyPoints, closed: (props.flags & 1) === 1, layer: props.layer });
        break;
      case 'CIRCLE':
        entity = new CircleEntity({ center: { x: props.x1 || 0, y: props.y1 || 0 }, radius: props.r || 1, layer: props.layer });
        break;
      case 'ARC':
        entity = new ArcEntity({
          center: { x: props.x1 || 0, y: props.y1 || 0 },
          radius: props.r || 1,
          startAngle: Utils.deg2rad(props.a0 || 0),
          endAngle: Utils.deg2rad(props.a1 || 0),
          layer: props.layer,
        });
        break;
      case 'POINT':
        entity = new PointEntity({ position: { x: props.x1 || 0, y: props.y1 || 0 }, layer: props.layer });
        break;
      case 'TEXT':
        entity = new TextEntity({ position: { x: props.x1 || 0, y: props.y1 || 0 }, text: props.text || '', height: props.r || 2.5, layer: props.layer });
        break;
      case 'ELLIPSE':
        entity = new EllipseEntity({
          center: { x: props.x1 || 0, y: props.y1 || 0 },
          rx: Math.hypot(props.x2 || 1, props.y2 || 0),
          ry: Math.hypot(props.x2 || 1, props.y2 || 0) * (props.ratio || 1),
          layer: props.layer,
        });
        break;
    }
    return { entity, next: i };
  },

  /* Mappa AutoCAD Color Index <-> hex */
  _aciFromColor(hex) {
    if (typeof hex !== 'string') return 7;
    const c = hex.toLowerCase();
    const tbl = {
      '#ff0000': 1, '#ffff00': 2, '#00ff00': 3,
      '#00ffff': 4, '#0000ff': 5, '#ff00ff': 6,
      '#ffffff': 7, '#414141': 8, '#808080': 9,
    };
    return tbl[c] || 7;
  },
};
