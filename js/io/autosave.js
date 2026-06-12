/* Autosave del documento corrente in localStorage. Sopravvive al refresh. */
const Autosave = {
  KEY: 'webcad.autosave',
  DEBOUNCE_MS: 800,
  _t: null,

  /* Salva subito (sincrono) */
  saveNow(app) {
    try {
      const payload = {
        ts: Date.now(),
        id: app.doc.id || null,
        name: app.doc.name || 'Disegno1',
        doc: app.doc.toJSON(),
      };
      localStorage.setItem(this.KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[Autosave] save fallito:', err);
    }
  },

  /* Salva entro DEBOUNCE_MS dall'ultima chiamata */
  scheduleSave(app) {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.saveNow(app), this.DEBOUNCE_MS);
  },

  /* Carica bozza salvata, se presente */
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch {}
  },

  /* Eseguito al boot dell'app: se c'è una bozza, chiede se ripristinarla */
  async init(app) {
    const draft = this.load();
    if (!draft || !draft.doc) return;
    const hasContent = (draft.doc.entities && draft.doc.entities.length)
                    || (draft.doc.solids && draft.doc.solids.length);
    if (!hasContent) { this.clear(); return; }
    const age = Math.round((Date.now() - draft.ts) / 1000);
    const ageStr = age < 60 ? `${age} s` : age < 3600 ? `${Math.round(age/60)} min` : `${Math.round(age/3600)} h`;
    const counts = `${(draft.doc.entities || []).length} entità · ${(draft.doc.solids || []).length} solidi`;
    const restore = await Modal.confirm(
      'Bozza locale trovata',
      `WebCAD ha trovato una bozza locale di <b>"${draft.name}"</b> salvata ${ageStr} fa<br>(${counts}).<br><br>Vuoi ripristinarla?`,
      { okLabel: 'Ripristina', cancelLabel: 'Scarta' },
    );
    if (restore) {
      app.doc = CadDocument.fromJSON(draft.doc);
      app.doc.id = draft.id;
      app.doc.name = draft.name;
      app.renderer.doc = app.doc;
      app.snap.doc = app.doc;
      app.history = new History(app.doc);
      app.doc.modified = true; /* è "non sincronizzata" col server */
      app.updateDocTitle();
      app.refreshAll();
      app.cli.echo(`Bozza locale ripristinata.`, 'ok');
    } else {
      this.clear();
    }
  },
};
