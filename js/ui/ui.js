/* ===========================================================
   Helper Modal — API a promise per sostituire prompt()/confirm()
   ===========================================================
   - Modal.input(title, label, value)        -> Promise<string|null>
   - Modal.confirm(title, message)           -> Promise<boolean>
   - Modal.form(title, fields)               -> Promise<object|null>
       fields: [{ key, label, value, type='text'|'number', min, max, step }]
   - Modal.open(title, bodyHtml, buttons)    -> raw (uso interno o avanzato)
   =========================================================== */
const Modal = {
  _resolver: null,

  open(title, bodyHtml, buttons = []) {
    const bg = document.getElementById('modalBg');
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML = bodyHtml || '';
    const foot = document.getElementById('modalFoot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.primary) btn.className = 'primary';
      btn.onclick = () => { try { b.onClick && b.onClick(); } catch (e) { console.error(e); } };
      foot.appendChild(btn);
    }
    bg.hidden = false;
    /* autofocus al primo input o al bottone primario */
    setTimeout(() => {
      const inp = document.querySelector('#modalBody input, #modalBody textarea');
      if (inp) inp.focus(), inp.select && inp.select();
      else {
        const btn = document.querySelector('#modalFoot button.primary');
        if (btn) btn.focus();
      }
    }, 30);
  },

  close(value) {
    const bg = document.getElementById('modalBg');
    if (bg) bg.hidden = true;
    if (this._resolver) {
      const r = this._resolver; this._resolver = null;
      r(value);
    }
  },

  _withPromise(title, body, primaryLabel, getResult) {
    return new Promise(resolve => {
      this._resolver = resolve;
      this.open(title, body, [
        { label: 'Annulla', onClick: () => Modal.close(null) },
        { label: primaryLabel, primary: true, onClick: () => Modal.close(getResult()) },
      ]);
      /* Enter conferma, Esc annulla */
      const onKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          Modal.close(getResult());
          document.removeEventListener('keydown', onKey, true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          Modal.close(null);
          document.removeEventListener('keydown', onKey, true);
        }
      };
      document.addEventListener('keydown', onKey, true);
    });
  },

  input(title, label, defaultValue = '', opts = {}) {
    const id = 'modal-inp';
    const body = `
      <div class="m-field">
        <label for="${id}">${label || ''}</label>
        <input id="${id}" type="${opts.type || 'text'}" value="${(defaultValue + '').replace(/"/g, '&quot;')}" ${opts.min!=null?`min="${opts.min}"`:''} ${opts.max!=null?`max="${opts.max}"`:''} ${opts.step!=null?`step="${opts.step}"`:''}>
      </div>
    `;
    return this._withPromise(title, body, opts.okLabel || 'OK', () => {
      const v = document.getElementById(id).value.trim();
      return v === '' ? null : (opts.type === 'number' ? parseFloat(v) : v);
    });
  },

  confirm(title, message, opts = {}) {
    const body = `<div class="m-msg">${message}</div>`;
    return new Promise(resolve => {
      this._resolver = resolve;
      this.open(title, body, [
        { label: opts.cancelLabel || 'Annulla', onClick: () => Modal.close(false) },
        { label: opts.okLabel || 'Conferma', primary: true, onClick: () => Modal.close(true) },
      ]);
      const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); Modal.close(true); document.removeEventListener('keydown', onKey, true); }
        else if (e.key === 'Escape') { e.preventDefault(); Modal.close(false); document.removeEventListener('keydown', onKey, true); }
      };
      document.addEventListener('keydown', onKey, true);
    });
  },

  form(title, fields, opts = {}) {
    const id = (k) => `mf_${k}`;
    const renderField = (f) => {
      if (f.type === 'select') {
        return `
          <div class="m-field">
            <label for="${id(f.key)}">${f.label}</label>
            <select id="${id(f.key)}">${f.options || ''}</select>
          </div>`;
      }
      return `
        <div class="m-field">
          <label for="${id(f.key)}">${f.label}</label>
          <input id="${id(f.key)}" type="${f.type || 'text'}"
                 value="${(f.value !== undefined ? f.value : '') + ''}"
                 ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} ${f.step!=null?`step="${f.step}"`:''}>
        </div>`;
    };
    const html = `
      <form class="m-form" onsubmit="return false;">
        ${fields.map(renderField).join('')}
      </form>
    `;
    return this._withPromise(title, html, opts.okLabel || 'OK', () => {
      const out = {};
      for (const f of fields) {
        const el = document.getElementById(id(f.key));
        if (!el) continue;
        out[f.key] = f.type === 'number' ? parseFloat(el.value) : el.value;
      }
      return out;
    });
  },
};

/* UI: ribbon, status bar, pannelli laterali, modali */
class UI {
  constructor(app) {
    this.app = app;
    this._initRibbon();
    this._initQuickAccess();
    this._initStatusBar();
    this._initViewToggles();
    this._initLayerSelect();
    this._initLayerProps();
    this._initOutput();
    this._initInsert();
    this._initFile();
  }

  _initRibbon() {
    document.querySelectorAll('.ribbon-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.ribbon-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const tab = t.dataset.tab;
        document.querySelectorAll('.ribbon-page').forEach(p => {
          p.classList.toggle('active', p.dataset.page === tab);
        });
      });
    });
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.addEventListener('click', () => this.app.runCommand(b.dataset.tool));
    });
  }

  _initQuickAccess() {
    document.querySelectorAll('.qa-btn').forEach(b => {
      b.addEventListener('click', () => {
        const cmd = b.dataset.cmd;
        if (cmd === 'new') this.app.cmd._new();
        else if (cmd === 'open') this.app.cmd._open();
        else if (cmd === 'save') this.app.cmd._save();
        else if (cmd === 'undo') this.app.cmd._undo();
        else if (cmd === 'redo') this.app.cmd._redo();
        else if (cmd === 'samples') this.app.cmd._samples();
      });
    });
    document.getElementById('btnFullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
  }

  _initStatusBar() {
    const tog = (id, prop, getter, after) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => {
        const v = !getter();
        prop(v);
        el.classList.toggle('active', v);
        if (after) after(v);
        this.app.render();
      });
    };
    tog('stGrid', v => this.app.renderer.showGrid = v, () => this.app.renderer.showGrid);
    tog('stSnap', v => this.app.snap.gridSnap = v, () => this.app.snap.gridSnap);
    tog('stOrtho', v => this.app.snap.ortho = v, () => this.app.snap.ortho);
    tog('stPolar', v => this.app.snap.polar = v, () => this.app.snap.polar);
    tog('stOsnap', v => this.app.snap.enabled = v, () => this.app.snap.enabled);
    tog('stOtrack', v => {}, () => false);
    tog('stLwt', v => this.app.renderer.showLwt = v, () => this.app.renderer.showLwt);
    tog('stDyn', v => {}, () => false);
  }

  _initViewToggles() {
    const set = (id, fn) => document.getElementById(id).addEventListener('change', e => { fn(e.target.checked); this.app.render(); });
    set('chkGrid', v => this.app.renderer.showGrid = v);
    set('chkAxes', v => this.app.renderer.showAxes = v);
    set('chkUcs', v => document.getElementById('ucsIcon').style.display = v ? 'block' : 'none');
    document.getElementById('btnZoomExtents').addEventListener('click', () => this.app.cmd._zoomExtents());
    document.getElementById('btnZoomIn').addEventListener('click', () => {
      this.app.camera.zoom *= 1.25; this.app.render();
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
      this.app.camera.zoom /= 1.25; this.app.render();
    });

    /* Toggle 3D */
    document.getElementById('btnToggle3D').addEventListener('click', () => this.app.toggleMode3D());

    /* Pulsanti viste 3D nel ribbon */
    document.querySelectorAll('[data-view3d]').forEach(b => {
      b.addEventListener('click', () => {
        if (this.app.mode !== '3d') this.app.toggleMode3D().then(() => this.app.setView3D(b.dataset.view3d));
        else this.app.setView3D(b.dataset.view3d);
      });
    });

    /* Viewcube cliccabile (anche in 2D, attiva il 3D) */
    document.querySelectorAll('.vc-face').forEach(f => {
      f.addEventListener('click', () => {
        if (this.app.mode !== '3d') this.app.toggleMode3D().then(() => this.app.setView3D(f.dataset.view));
        else this.app.setView3D(f.dataset.view);
      });
    });

    /* === Sezione dinamica (clipping plane) === */
    const ensure3DScene = async () => {
      if (this.app.mode !== '3d') await this.app.toggleMode3D();
      return this.app.scene3d;
    };
    const chkSec = document.getElementById('chkSection');
    const axisSel = document.getElementById('secAxis');
    const posInp = document.getElementById('secPos');
    const posVal = document.getElementById('secPosVal');
    const flipBtn = document.getElementById('secFlip');
    if (chkSec) chkSec.addEventListener('change', async () => {
      const sc = await ensure3DScene();
      if (sc) sc.setSectionEnabled(chkSec.checked);
    });
    if (axisSel) axisSel.addEventListener('change', async () => {
      const sc = await ensure3DScene();
      if (sc) sc.setSectionAxis(axisSel.value);
    });
    if (posInp) {
      const updPos = async () => {
        if (posVal) posVal.textContent = posInp.value;
        if (this.app.scene3d) this.app.scene3d.setSectionPos(parseFloat(posInp.value));
      };
      posInp.addEventListener('input', updPos);
    }
    if (flipBtn) flipBtn.addEventListener('click', async () => {
      const sc = await ensure3DScene();
      if (!sc) return;
      sc.setSectionFlip(!sc.section.flip);
      flipBtn.classList.toggle('active', sc.section.flip);
    });

    /* === Materiali e illuminazione === */
    const matSel = document.getElementById('matPreset');
    const lightSel = document.getElementById('lightPreset');
    const sunInt = document.getElementById('sunInt');
    const sunIntVal = document.getElementById('sunIntVal');
    const chkShadows = document.getElementById('chkShadows');
    if (matSel) matSel.addEventListener('change', async () => {
      const sc = await ensure3DScene();
      if (sc) sc.setMaterialPreset(matSel.value);
    });
    if (lightSel) lightSel.addEventListener('change', async () => {
      const sc = await ensure3DScene();
      if (sc) sc.setLightingPreset(lightSel.value);
    });
    if (sunInt) sunInt.addEventListener('input', async () => {
      if (sunIntVal) sunIntVal.textContent = parseFloat(sunInt.value).toFixed(2);
      if (this.app.scene3d) this.app.scene3d.setSunIntensity(parseFloat(sunInt.value));
    });
    if (chkShadows) chkShadows.addEventListener('change', async () => {
      const sc = await ensure3DScene();
      if (sc) sc.setShadowsEnabled(chkShadows.checked);
    });

    /* === Export 3D === */
    const exp = (fmt) => async () => {
      if (this.app.mode !== '3d' || !this.app.scene3d) {
        await this.app.toggleMode3D();
      }
      try { await Exporters3D.export(this.app, fmt); }
      catch (err) { this.app.cli.echo(`Errore export ${fmt.toUpperCase()}: ${err.message}`, 'err'); }
    };
    const btnStl = document.getElementById('btnExportStl');
    const btnObj = document.getElementById('btnExportObj');
    const btnGltf = document.getElementById('btnExportGltf');
    if (btnStl) btnStl.addEventListener('click', exp('stl'));
    if (btnObj) btnObj.addEventListener('click', exp('obj'));
    if (btnGltf) btnGltf.addEventListener('click', exp('gltf'));
  }

  _initLayerSelect() {
    document.getElementById('layerSelect').addEventListener('change', e => {
      this.app.doc.currentLayerName = e.target.value;
      this.refreshLayers();
    });
    document.getElementById('btnAddLayer').addEventListener('click', async () => {
      const name = await Modal.input('Nuovo layer', 'Nome del layer', '', { okLabel: 'Crea' });
      if (!name) return;
      if (!this.app.doc.addLayer(new Layer({ name, color: '#ffffff' }))) {
        await Modal.confirm('Errore', `Esiste già un layer chiamato "${name}".`, { okLabel: 'OK', cancelLabel: '' });
        return;
      }
      this.app.history.snapshot('add-layer');
      this.refreshLayers();
    });
  }

  _initLayerProps() {
    const set = (id, prop) => document.getElementById(id).addEventListener('change', e => {
      this.app.doc[prop] = e.target.value;
    });
    document.getElementById('curColor').addEventListener('input', e => this.app.doc.currentColor = e.target.value);
    document.getElementById('curLineWeight').addEventListener('change', e => this.app.doc.currentLineWeight = parseFloat(e.target.value));
    document.getElementById('curLineType').addEventListener('change', e => this.app.doc.currentLineType = e.target.value);
  }

  _initOutput() {
    document.getElementById('btnExportPng').addEventListener('click', () => Exporters.exportPNG(this.app));
    document.getElementById('btnExportSvg').addEventListener('click', () => Exporters.exportSVG(this.app));
    document.getElementById('btnExportDxf').addEventListener('click', () => DXF.exportDXF(this.app));
    document.getElementById('btnPrint').addEventListener('click', () => window.print());
  }

  _initInsert() {
    document.getElementById('btnImportDxf').addEventListener('click', () => {
      const fi = document.getElementById('fileInput');
      fi.accept = '.dxf';
      fi.value = '';
      fi.onchange = async () => {
        const f = fi.files[0]; if (!f) return;
        const txt = await f.text();
        const n = DXF.importDXF(txt, this.app.doc);
        this.app.history.snapshot('import dxf');
        this.app.cmd._zoomExtents();
        this.app.cli.echo(`Importate ${n} entità da DXF.`, 'ok');
      };
      fi.click();
    });
    document.getElementById('btnImportImg').addEventListener('click', () => {
      alert('Riferimento immagine non ancora implementato in questa build.');
    });
  }

  _initFile() {
    document.getElementById('btnRefreshProjects').addEventListener('click', () => this.refreshProjects());

    /* Modale: la X e il click sullo sfondo chiudono sempre */
    const modalBg = document.getElementById('modalBg');
    const modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', () => Modal.close());
    if (modalBg) modalBg.addEventListener('click', e => {
      if (e.target === modalBg) Modal.close();
    });
    /* assicurati che sia chiusa all'avvio (paranoia in caso qualche script l'avesse aperta) */
    Modal.close();
  }

  /* ===== Refresh viste ===== */
  refreshSolidSelectionPanel() {
    /* mostra "N solidi selezionati" se in 3D */
    if (this.app.mode !== '3d' || !this.app.scene3d) return;
    const n = this.app.scene3d.selectedSolids.size;
    const panel = document.getElementById('propertiesPanel');
    if (n === 0) {
      panel.innerHTML = '<div class="empty">Nessuna selezione</div>';
      return;
    }
    const head = document.createElement('div');
    head.style.cssText = 'padding:4px 6px;background:var(--bg-2);font-weight:600;';
    head.textContent = `${n} solid${n === 1 ? 'o' : 'i'} 3D selezionat${n === 1 ? 'o' : 'i'}`;
    panel.innerHTML = '';
    panel.appendChild(head);
    const hint = document.createElement('div');
    hint.style.cssText = 'padding:6px;color:var(--fg-2);font-size:11px;line-height:1.5;';
    hint.innerHTML = 'Pronti per: UNI / SUB / INT / Canc.<br>Shift+click per aggiungere.';
    panel.appendChild(hint);
  }

  refreshLayers() {
    const sel = document.getElementById('layerSelect');
    sel.innerHTML = '';
    for (const l of this.app.doc.layers) {
      const opt = document.createElement('option');
      opt.value = l.name; opt.textContent = l.name;
      if (l.name === this.app.doc.currentLayerName) opt.selected = true;
      sel.appendChild(opt);
    }
    const panel = document.getElementById('layersPanel');
    panel.innerHTML = '';
    for (const l of this.app.doc.layers) {
      const row = document.createElement('div');
      row.className = 'layer-item' + (l.name === this.app.doc.currentLayerName ? ' current' : '');

      const vis = document.createElement('button');
      vis.className = 'layer-vis' + (l.visible ? '' : ' off');
      vis.textContent = l.visible ? '●' : '○';
      vis.title = l.visible ? 'Visibile' : 'Nascosto';
      vis.onclick = (e) => { e.stopPropagation(); l.visible = !l.visible; this.refreshLayers(); this.app.render(); };

      const lock = document.createElement('button');
      lock.className = 'layer-lock';
      lock.textContent = l.locked ? '🔒' : '🔓';
      lock.onclick = (e) => { e.stopPropagation(); l.locked = !l.locked; this.refreshLayers(); };

      const col = document.createElement('div');
      col.className = 'layer-color';
      col.style.background = l.color;
      col.onclick = (e) => {
        e.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'color'; inp.value = l.color;
        inp.onchange = () => { l.color = inp.value; this.refreshLayers(); this.app.render(); };
        inp.click();
      };

      const name = document.createElement('input');
      name.className = 'layer-name';
      name.value = l.name; name.disabled = (l.name === '0');
      name.onchange = () => {
        if (name.value && name.value !== l.name) this.app.doc.renameLayer(l.name, name.value);
        this.refreshLayers();
      };

      const del = document.createElement('button');
      del.className = 'layer-del';
      del.textContent = '×';
      del.title = 'Elimina';
      del.onclick = async (e) => {
        e.stopPropagation();
        const ok = await Modal.confirm('Elimina layer', `Eliminare il layer "${l.name}"? Le entità verranno spostate sul layer 0.`, { okLabel: 'Elimina' });
        if (ok) {
          this.app.doc.removeLayer(l.name);
          this.app.history.snapshot('remove-layer');
          this.refreshLayers();
          this.app.render();
        }
      };

      row.append(vis, lock, col, name, del);
      row.onclick = () => { this.app.doc.currentLayerName = l.name; this.refreshLayers(); };
      panel.appendChild(row);
    }
  }

  refreshProperties() {
    const panel = document.getElementById('propertiesPanel');
    panel.innerHTML = '';
    const sel = this.app.doc.selectedEntities();
    if (sel.length === 0) {
      panel.innerHTML = '<div class="empty">Nessuna selezione</div>';
      return;
    }
    const head = document.createElement('div');
    head.style.padding = '4px 6px';
    head.style.background = 'var(--bg-2)';
    head.style.fontWeight = '600';
    head.textContent = sel.length === 1 ? sel[0].type.toUpperCase() : `${sel.length} oggetti`;
    panel.appendChild(head);

    const layerRow = this._propRow('Layer', sel[0].layer);
    panel.appendChild(layerRow);
    const colorRow = this._propRow('Colore', sel[0].color);
    panel.appendChild(colorRow);
    const ltRow = this._propRow('Tipo linea', sel[0].lineType);
    panel.appendChild(ltRow);

    if (sel.length === 1) {
      const e = sel[0];
      if (e.type === 'line') {
        panel.appendChild(this._propRow('Lunghezza', Utils.fmt(e.length(), 4)));
        panel.appendChild(this._propRow('Angolo °', Utils.fmt(Utils.rad2deg(e.angle()), 2)));
      } else if (e.type === 'circle') {
        panel.appendChild(this._propRow('Raggio', Utils.fmt(e.radius, 4)));
        panel.appendChild(this._propRow('Diametro', Utils.fmt(e.radius * 2, 4)));
      } else if (e.type === 'rectangle') {
        const w = Math.abs(e.p2.x - e.p1.x), h = Math.abs(e.p2.y - e.p1.y);
        panel.appendChild(this._propRow('Larghezza', Utils.fmt(w, 4)));
        panel.appendChild(this._propRow('Altezza', Utils.fmt(h, 4)));
      } else if (e.type === 'text') {
        panel.appendChild(this._propRow('Testo', e.text));
        panel.appendChild(this._propRow('Altezza', Utils.fmt(e.height, 2)));
      }
    }
  }
  _propRow(label, value) {
    const row = document.createElement('div');
    row.className = 'prop-display';
    const l = document.createElement('label'); l.textContent = label;
    const i = document.createElement('input'); i.value = value; i.readOnly = true;
    row.append(l, i); return row;
  }

  refreshProjects() {
    const el = document.getElementById('projectList');
    el.innerHTML = '<div class="empty">Caricamento...</div>';
    Api.list().then(r => {
      el.innerHTML = '';
      if (!r.ok) { el.innerHTML = '<div class="empty">Errore: backend non raggiungibile</div>'; return; }
      if (!r.projects.length) { el.innerHTML = '<div class="empty">Nessun progetto salvato</div>'; return; }
      for (const p of r.projects) {
        const div = document.createElement('div');
        div.className = 'project-item';
        if (this.app.doc.id === p.id) div.classList.add('active');
        const name = document.createElement('span');
        name.textContent = p.name;
        const del = document.createElement('button');
        del.className = 'del'; del.textContent = '×';
        del.onclick = async (e) => {
          e.stopPropagation();
          const ok = await Modal.confirm('Elimina progetto', `Eliminare definitivamente "${p.name}"?`, { okLabel: 'Elimina' });
          if (ok) {
            await Api.remove(p.id);
            this.refreshProjects();
          }
        };
        div.append(name, del);
        div.onclick = () => this.app.cmd._loadProject(p.id);
        el.appendChild(div);
      }
    }).catch(() => {
      el.innerHTML = '<div class="empty">Backend non disponibile.<br>Avvia il server PHP.</div>';
    });
  }
}
