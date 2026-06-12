/* App principale — orchestrazione */
class CadApp {
  constructor() {
    this.canvas = document.getElementById('cad');
    this.doc = new CadDocument();
    this.camera = new Camera();
    this.renderer = new Renderer(this.canvas, this.doc, this.camera);
    window.renderer = this.renderer;
    this.snap = new SnapEngine(this.doc, this.camera);
    this.history = new History(this.doc);
    this.cli = new CommandLine(this);
    this.ui = new UI(this);
    this.cmd = new CommandActions(this);

    this.tool = null;
    this.tools = {
      select: new SelectTool(this),
      line: new LineTool(this),
      polyline: new PolylineTool(this),
      circle: new CircleTool(this),
      arc: new ArcTool(this),
      rectangle: new RectangleTool(this),
      ellipse: new EllipseTool(this),
      point: new PointTool(this),
      text: new TextTool(this),
      dimension: new DimensionTool(this),
      move: new MoveTool(this),
      copy: new CopyTool(this),
      rotate: new RotateTool(this),
      scale: new ScaleTool(this),
      mirror: new MirrorTool(this),
      offset: new OffsetTool(this),
      trim: new TrimTool(this),
      extend: new ExtendTool(this),
      fillet: new FilletTool(this),
      erase: new EraseTool(this),
      extrude: new ExtrudeTool(this),
      box: new BoxTool(this),
      sphere: new SphereTool(this),
      cylinder: new CylinderTool(this),
      cone: new ConeTool(this),
      torus: new TorusTool(this),
      pyramid: new PyramidTool(this),
      union: new UnionTool(this),
      subtract: new SubtractTool(this),
      intersect: new IntersectTool(this),
      revolve: new RevolveTool(this),
    };

    this.shiftDown = false;
    this.lastPoint = null;
    this.mode = '2d';
    this.scene3d = null;
    this._bindEvents();
    this.renderer.resize();
    this.setTool('select');
    Theme.init(this);
    /* DocTitle cliccabile per rinominare */
    document.getElementById('docTitle').addEventListener('click', () => this.cmd._rename());
    this.updateDocTitle();
    this.ui.refreshLayers();
    this.ui.refreshProperties();
    this.ui.refreshProjects();
    /* Persistenza: ripristina bozza locale, se c'è */
    Autosave.init(this);
    /* Salva ad ogni 'beforeunload' come ultima salvezza */
    window.addEventListener('beforeunload', () => Autosave.saveNow(this));
    this.render();
  }

  async toggleMode3D() {
    if (this.mode === '2d') {
      await this._enter3D();
    } else {
      this._exit3D();
    }
  }

  async _enter3D() {
    const host = document.getElementById('canvas3d-host');
    document.getElementById('modeBadge').textContent = 'Caricamento 3D...';
    try {
      await window.ensureThreeJsLoaded();
    } catch (err) {
      this.cli.echo(`Errore caricamento Three.js: ${err.message}`, 'err');
      document.getElementById('modeBadge').textContent = '2D';
      return;
    }
    if (!this.scene3d) {
      this.scene3d = new window.Scene3D(host);
      Theme._syncScene3D(this);
    }
    this.scene3d.syncFromDocument(this.doc);
    host.hidden = false;
    this.canvas.style.display = 'none';
    document.getElementById('ucsIcon').style.display = 'none';
    this.scene3d.resize();
    this.scene3d.start();
    this.mode = '3d';
    document.getElementById('modeBadge').textContent = '3D';
    document.getElementById('btnToggle3D').classList.add('active');
    this.cli.echo('Workspace 3D attivato. Orbit: tasto sinistro / Pan: tasto medio / Zoom: rotella.', 'info');
  }

  _exit3D() {
    if (this.scene3d) this.scene3d.stop();
    document.getElementById('canvas3d-host').hidden = true;
    this.canvas.style.display = 'block';
    if (document.getElementById('chkUcs').checked) {
      document.getElementById('ucsIcon').style.display = 'block';
    }
    this.mode = '2d';
    document.getElementById('modeBadge').textContent = '2D';
    document.getElementById('btnToggle3D').classList.remove('active');
    this.render();
    this.cli.echo('Workspace 2D attivato.', 'info');
  }

  setView3D(name) {
    if (this.mode !== '3d' || !this.scene3d) return;
    this.scene3d.setView(name);
  }

  updateDocTitle() {
    const el = document.getElementById('docTitle');
    el.textContent = `${this.doc.name || 'Disegno1'}.wcad`;
    el.classList.toggle('dirty', !!this.doc.modified);
  }

  markDirty() {
    this.doc.modified = true;
    this.updateDocTitle();
    Autosave.scheduleSave(this);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.resize(); this.render();
      if (this.scene3d) this.scene3d.resize();
    });

    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
      const world = this.camera.screenToWorld(screen);
      this.renderer.cursorScreen = screen;
      const ref = this.lastPoint || (this.tool && (this.tool.center || this.tool.p1 || this.tool.base || (this.tool.points && this.tool.points[this.tool.points.length - 1])));
      const snap = this.snap.query(world, ref);
      this.renderer.snapMarker = (snap.type !== 'free') ? snap : null;
      document.getElementById('coords').textContent = Utils.fmtCoord(snap.point);
      if (this.tool && this.tool.onMove) this.tool.onMove(world, snap, e);
      /* Re-render SEMPRE: il tool può scegliere di aggiornare anteprime,
         ma il crosshair/snap marker devono comunque seguire il cursore. */
      this.render();
    });
    this.canvas.addEventListener('mouseenter', () => { this.renderer.cursorVisible = true; });
    this.canvas.addEventListener('mouseleave', () => {
      this.renderer.cursorVisible = false;
      this.renderer.snapMarker = null;
      this.render();
    });

    this.canvas.addEventListener('mousedown', e => {
      this.canvas.focus();
      const r = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
      const world = this.camera.screenToWorld(screen);
      const ref = this.lastPoint || (this.tool && (this.tool.center || this.tool.p1 || this.tool.base));
      const snap = this.snap.query(world, ref);

      if (e.button === 1) { /* pan con tasto medio */
        this._startPan(e); return;
      }
      if (e.button === 2) {
        e.preventDefault();
        if (this.tool && this.tool.onRightClick) this.tool.onRightClick(snap.point, e);
        return;
      }
      this.shiftDown = e.shiftKey;
      if (this.tool && this.tool.onLeftClick) {
        this.tool.onLeftClick(snap.point, snap, e);
        this.lastPoint = snap.point;
      }
    });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      this.camera.zoomAt(screen, factor);
      document.getElementById('zoomInfo').textContent = `${this.camera.zoomPct()}%`;
      this.render();
    }, { passive: false });

    /* Keyboard a livello window: funziona sempre, indipendentemente da chi ha il focus */
    window.addEventListener('keydown', e => {
      this.shiftDown = e.shiftKey;
      const targetIsInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA';

      /* Tasti che hanno la precedenza ovunque */
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); this.cmd._undo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); this.cmd._redo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); this.cmd._save(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'a' && !targetIsInput) {
        e.preventDefault();
        for (const ent of this.doc.entities) this.doc.select(ent.id);
        this.refreshAll();
        return;
      }
      if (e.key === 'F3') { e.preventDefault(); document.getElementById('stOsnap').click(); return; }
      if (e.key === 'F7') { e.preventDefault(); document.getElementById('stGrid').click(); return; }
      if (e.key === 'F8') { e.preventDefault(); document.getElementById('stOrtho').click(); return; }
      if (e.key === 'F9') { e.preventDefault(); document.getElementById('stSnap').click(); return; }
      if (e.key === 'F10'){ e.preventDefault(); document.getElementById('stPolar').click(); return; }
      if (e.key === 'Escape') {
        if (this.tool && this.tool.cancel) this.tool.cancel();
        this.cli.input.blur();
        this.cli.input.value = '';
        return;
      }
      if (e.key === 'Delete' && !targetIsInput) {
        if (this.doc.selection.size) {
          for (const id of [...this.doc.selection]) this.doc.removeEntity(id);
          this.doc.clearSelection();
          this.history.snapshot('delete');
          this.refreshAll();
        }
        /* Cancellazione di solidi 3D selezionati nella scena */
        if (this.mode === '3d' && this.scene3d && this.scene3d.selectedSolids.size) {
          for (const id of [...this.scene3d.selectedSolids]) this.doc.removeSolid(id);
          this.scene3d.selectedSolids.clear();
          this.history.snapshot('delete-solid');
          this.scene3d.syncFromDocument(this.doc);
          this.ui.refreshSolidSelectionPanel();
        }
        return;
      }

      /* Se l'utente digita una lettera mentre il canvas/body ha il focus, sposta su cmdInput
         (stile AutoCAD: inizi a digitare e parte il comando) */
      if (!targetIsInput && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        this.cli.focus();
        /* lascia che il carattere arrivi all'input naturalmente */
      }

      if (this.tool && this.tool.onKey) this.tool.onKey(e);
    });
    window.addEventListener('keyup', e => { this.shiftDown = e.shiftKey; });
  }

  _startPan(evt) {
    let lastX = evt.clientX, lastY = evt.clientY;
    const move = e => {
      this.camera.pan(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      this.render();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  setTool(name) {
    if (this.tool && this.tool.deactivate) this.tool.deactivate();
    /* clear preview */
    this.renderer.previewEntity = null;
    this.renderer.previewPoints = null;
    this.lastPoint = null;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === name);
    });
    this.tool = this.tools[name] || this.tools.select;
    if (this.tool.activate) this.tool.activate();
    this.render();
  }

  runCommand(name) {
    if (typeof name === 'string' && name.startsWith('_')) {
      const fn = this.cmd[name];
      if (typeof fn === 'function') fn.call(this.cmd);
      return;
    }
    if (this.tools[name]) {
      this.setTool(name);
    } else {
      this.cli.echo(`Strumento sconosciuto: ${name}`, 'err');
    }
  }

  /* Parser punto: assoluto x,y / relativo @dx,dy / polare @r<ang */
  parsePoint(txt, ref = null) {
    txt = txt.trim();
    if (!txt) return null;
    let relative = false;
    if (txt.startsWith('@')) { relative = true; txt = txt.slice(1); }
    if (txt.includes('<')) {
      const [rs, as] = txt.split('<');
      const r = parseFloat(rs), a = Utils.deg2rad(parseFloat(as));
      if (isNaN(r) || isNaN(a)) return null;
      const base = relative && ref ? ref : { x: 0, y: 0 };
      return { x: base.x + r * Math.cos(a), y: base.y + r * Math.sin(a) };
    }
    const parts = txt.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (relative && ref) return { x: ref.x + parts[0], y: ref.y + parts[1] };
      return { x: parts[0], y: parts[1] };
    }
    return null;
  }

  render() {
    document.getElementById('zoomInfo').textContent = `${this.camera.zoomPct()}%`;
    this.renderer.render();
    if (this.mode === '3d' && this.scene3d) {
      this.scene3d.syncFromDocument(this.doc);
    }
  }
  refreshAll() {
    this.ui.refreshProperties();
    this.ui.refreshLayers();
    this.render();
  }
}

/* Azioni rapide del command line / menù */
class CommandActions {
  constructor(app) { this.app = app; }
  _undo() {
    if (!this.app.history.undo()) { this.app.cli.echo('Niente da annullare.', 'warn'); return; }
    this.app.updateDocTitle();
    this.app.refreshAll();
    this.app.cli.echo('Annullato.', 'info');
  }
  _redo() {
    if (!this.app.history.redo()) { this.app.cli.echo('Niente da ripetere.', 'warn'); return; }
    this.app.updateDocTitle();
    this.app.refreshAll();
    this.app.cli.echo('Ripetuto.', 'info');
  }
  _zoomExtents() {
    const bb = this.app.doc.bbox();
    this.app.camera.zoomExtents(bb || { x: -50, y: -50, w: 100, h: 100 });
    this.app.render();
  }
  _pan() { this.app.cli.echo('Tieni premuto il tasto centrale del mouse per pan.', 'info'); }
  _clearCmd() { document.getElementById('cmdHistory').innerHTML = ''; }
  _exportPng() { Exporters.exportPNG(this.app); }
  _exportSvg() { Exporters.exportSVG(this.app); }
  _exportDxf() { DXF.exportDXF(this.app); }
  async _exportStl() { await this._export3D('stl'); }
  async _exportObj() { await this._export3D('obj'); }
  async _exportGltf() { await this._export3D('gltf'); }
  async _export3D(fmt) {
    if (this.app.mode !== '3d') await this.app.toggleMode3D();
    try { await Exporters3D.export(this.app, fmt); }
    catch (err) { this.app.cli.echo(`Errore export ${fmt.toUpperCase()}: ${err.message}`, 'err'); }
  }
  _openLayers() { document.getElementById('btnAddLayer').click(); }
  _toggle3D() { this.app.toggleMode3D(); }
  async _samples() {
    /* Mostra un Modal con la lista di file di esempio e ne carica uno */
    const items = Api.samples;
    const options = items.map((s, i) => `<option value="${i}">${s.label}  (${s.file})</option>`).join('');
    const res = await Modal.form('Apri esempio',
      [{ key: 'idx', label: 'File di esempio', type: 'select', options }],
      { okLabel: 'Apri' });
    if (!res) return;
    const item = items[parseInt(res.idx, 10)];
    if (!item) return;
    try {
      const data = await Api.loadSampleFile(item.file);
      if (data.type === 'json') {
        if (this.app.doc.entities.length || this.app.doc.solids.length) {
          const ok = await Modal.confirm('Apri esempio', 'Scartare il disegno corrente per aprire l\'esempio?', { okLabel: 'Apri' });
          if (!ok) return;
        }
        const doc = CadDocument.fromJSON(data.json);
        this.app.doc = doc;
        this.app.doc.id = null;          /* esempio = doc nuovo, non legato al server */
        this.app.doc.modified = false;
        this.app.renderer.doc = doc;
        this.app.snap.doc = doc;
        this.app.history = new History(doc);
        this.app.updateDocTitle();
        this.app.refreshAll();
        this._zoomExtents();
        this.app.cli.echo(`Esempio "${item.label}" caricato.`, 'ok');
        /* se ci sono solidi, mostralo in 3D */
        if (doc.solids && doc.solids.length) {
          if (this.app.mode !== '3d') await this.app.toggleMode3D();
          else this.app.scene3d.syncFromDocument(doc);
          this.app.setView3D('iso');
        }
        Autosave.saveNow(this.app);
      } else if (data.type === 'dxf') {
        const ok = await Modal.confirm('Importa DXF', `Importare entità da "${item.file}" nel disegno corrente?`, { okLabel: 'Importa' });
        if (!ok) return;
        const n = DXF.importDXF(data.text, this.app.doc);
        this.app.history.snapshot('import-dxf');
        this.app.refreshAll();
        this._zoomExtents();
        this.app.cli.echo(`Importate ${n} entità da "${item.file}".`, 'ok');
      }
    } catch (err) {
      this.app.cli.echo(`Errore apertura esempio: ${err.message}`, 'err');
    }
  }
  async _section() {
    if (this.app.mode !== '3d') {
      await this.app.toggleMode3D();
    }
    if (!this.app.scene3d) return;
    const cur = this.app.scene3d.section;
    const on = !cur.enabled;
    this.app.scene3d.setSectionEnabled(on);
    const chk = document.getElementById('chkSection');
    if (chk) chk.checked = on;
    this.app.cli.echo(on ? `Sezione dinamica attiva (asse ${cur.axis}, pos ${cur.pos}).` : 'Sezione dinamica disattivata.', 'info');
  }

  async _rename() {
    const cur = this.app.doc.name || 'Disegno1';
    const next = await Modal.input('Rinomina progetto', 'Nome del progetto', cur, { okLabel: 'Rinomina' });
    if (!next || next === cur) return;
    this.app.doc.name = next;
    this.app.updateDocTitle();
    /* se è già su server, propaga */
    if (this.app.doc.id) {
      const r = await Api.rename(this.app.doc.id, next);
      if (r && r.ok) {
        this.app.cli.echo(`Progetto rinominato in "${next}".`, 'ok');
        this.app.ui.refreshProjects();
      } else {
        this.app.cli.echo(`Rinomina server fallita; resta in locale.`, 'warn');
      }
    } else {
      this.app.cli.echo(`Nome cambiato in "${next}" (non ancora salvato sul server).`, 'info');
    }
    Autosave.saveNow(this.app);
  }
  async _new() {
    if (this.app.doc.entities.length || this.app.doc.solids.length) {
      const ok = await Modal.confirm('Nuovo disegno', 'Scartare il disegno corrente? Eventuali modifiche non salvate andranno perse.', { okLabel: 'Scarta' });
      if (!ok) return;
    }
    this.app.doc = new CadDocument();
    this.app.renderer.doc = this.app.doc;
    this.app.snap.doc = this.app.doc;
    this.app.history = new History(this.app.doc);
    this.app.updateDocTitle();
    Autosave.clear();
    this.app.refreshAll();
  }
  async _save() {
    let name = this.app.doc.name;
    if (!this.app.doc.id) {
      name = await Modal.input('Salva progetto', 'Nome del progetto', this.app.doc.name || 'Disegno1', { okLabel: 'Salva' });
      if (!name) return;
    }
    this.app.doc.name = name;
    const thumb = this.app.canvas.toDataURL('image/png');
    const r = await Api.save({ id: this.app.doc.id || null, name, doc: this.app.doc.toJSON(), thumb });
    if (r.ok) {
      this.app.doc.id = r.id;
      this.app.doc.modified = false;
      this.app.updateDocTitle();
      this.app.cli.echo(`Salvato come "${name}" (id ${r.id}).`, 'ok');
      this.app.ui.refreshProjects();
      Autosave.saveNow(this.app);
    } else {
      this.app.cli.echo(`Errore salvataggio: ${r.error || 'sconosciuto'}.`, 'err');
    }
  }
  async _open() { this.app.ui.refreshProjects(); this.app.cli.echo('Scegli un progetto dal pannello laterale "Progetti".', 'info'); }
  async _loadProject(id) {
    const r = await Api.load(id);
    if (!r.ok) { this.app.cli.echo(`Errore caricamento: ${r.error}`, 'err'); return; }
    this.app.doc = CadDocument.fromJSON(r.doc);
    this.app.doc.id = r.id;
    this.app.doc.name = r.name;
    this.app.doc.modified = false;
    this.app.renderer.doc = this.app.doc;
    this.app.snap.doc = this.app.doc;
    this.app.history = new History(this.app.doc);
    this.app.updateDocTitle();
    Autosave.saveNow(this.app);
    this.app.cmd._zoomExtents();
    this.app.refreshAll();
    this.app.ui.refreshProjects();
    this.app.cli.echo(`Caricato "${r.name}".`, 'ok');
  }
}

/* Error overlay: se qualcosa si rompe, l'utente vede subito perché */
function showFatalError(msg, where) {
  let box = document.getElementById('webcad-fatal');
  if (!box) {
    box = document.createElement('div');
    box.id = 'webcad-fatal';
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#cf2d2d;color:white;padding:8px 12px;font:12px/1.4 Consolas,monospace;z-index:99999;border-bottom:2px solid #800;';
    document.body.appendChild(box);
  }
  box.textContent = `WebCAD bloccato: ${msg}${where ? ` @ ${where}` : ''}`;
}
window.addEventListener('error', e => {
  console.error('[WebCAD]', e.error || e.message, e);
  if (window.app && window.app.cli) {
    window.app.cli.echo(`Errore: ${e.message}`, 'err');
  } else {
    showFatalError(e.message || 'errore sconosciuto', `${e.filename}:${e.lineno}`);
  }
});
window.addEventListener('unhandledrejection', e => {
  console.error('[WebCAD] promise', e.reason);
  if (window.app && window.app.cli) window.app.cli.echo(`Promise rifiutata: ${e.reason}`, 'err');
});

/* Avvio */
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new CadApp();
    console.log('[WebCAD] avviato OK');
  } catch (err) {
    console.error('[WebCAD] avvio fallito:', err);
    showFatalError(err.message, err.stack ? err.stack.split('\n')[1] : '');
  }
});
