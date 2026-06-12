/* Gestione tema chiaro/scuro: persiste in localStorage, propaga al canvas 2D e alla scena 3D */
const Theme = {
  STORAGE_KEY: 'webcad.theme',

  current() { return document.body.classList.contains('theme-light') ? 'light' : 'dark'; },

  init(app) {
    const saved = localStorage.getItem(this.STORAGE_KEY) || 'dark';
    this.set(saved, app, /*silent*/ true);
    document.getElementById('btnTheme').addEventListener('click', () => {
      this.set(this.current() === 'light' ? 'dark' : 'light', app);
    });
  },

  set(name, app, silent = false) {
    document.body.classList.toggle('theme-light', name === 'light');
    document.body.classList.toggle('theme-dark', name !== 'light');
    localStorage.setItem(this.STORAGE_KEY, name);
    this._syncRenderer(app);
    this._syncScene3D(app);
    document.getElementById('btnTheme').innerHTML = name === 'light' ? '&#x263C;' : '&#x263D;';
    document.getElementById('btnTheme').title = name === 'light'
      ? 'Passa al tema scuro' : 'Passa al tema chiaro';
    if (app && !silent) app.cli.echo(`Tema ${name === 'light' ? 'chiaro' : 'scuro'} attivato.`, 'info');
    if (app) app.render();
  },

  _readVar(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  },

  _syncRenderer(app) {
    if (!app || !app.renderer) return;
    app.renderer.bgColor = this._readVar('--bg-canvas', '#2b2b2b');
    app.renderer.gridMinor = this._readVar('--grid-minor', '#3a3a3a');
    app.renderer.gridMajor = this._readVar('--grid-major', '#4a4a4a');
    app.renderer.axisX = this._readVar('--axis-x', '#aa3333');
    app.renderer.axisY = this._readVar('--axis-y', '#33aa33');
    app.renderer.crosshairColor = this._readVar('--crosshair', '#cfcfcf');
  },

  _syncScene3D(app) {
    if (!app || !app.scene3d || !window.THREE) return;
    const top = this._readVar('--3d-bg-top', '#1f2733');
    /* la scena ha sfondo solido; il gradient resta nel CSS dietro il canvas */
    app.scene3d.scene.background = new window.THREE.Color(top);
    /* griglia: ricreo con i colori del tema */
    if (app.scene3d.grid) {
      app.scene3d.scene.remove(app.scene3d.grid);
      const isLight = this.current() === 'light';
      app.scene3d.grid = new window.THREE.GridHelper(
        200, 40,
        isLight ? 0x888888 : 0x666666,
        isLight ? 0xcccccc : 0x3a3a3a
      );
      app.scene3d.grid.rotation.x = Math.PI / 2;
      app.scene3d.scene.add(app.scene3d.grid);
    }
  },
};
