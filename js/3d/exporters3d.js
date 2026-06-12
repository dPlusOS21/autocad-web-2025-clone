/* Export 3D — STL / OBJ / glTF
   Carica gli exporter di Three.js (vendor locale via import map) e
   esporta SOLO i solid mesh del documento (docGroup.children con userData.solidId).
   Per export "scena completa" esportiamo il docGroup intero.
*/
const Exporters3D = {
  _mods: null,

  async _loadExporters() {
    if (this._mods) return this._mods;
    /* Three.js già caricato; carico gli exporter al primo uso */
    const [stl, obj, gltf] = await Promise.all([
      import('three/addons/exporters/STLExporter.js'),
      import('three/addons/exporters/OBJExporter.js'),
      import('three/addons/exporters/GLTFExporter.js'),
    ]);
    this._mods = {
      STLExporter: stl.STLExporter,
      OBJExporter: obj.OBJExporter,
      GLTFExporter: gltf.GLTFExporter,
    };
    return this._mods;
  },

  /* fmt: 'stl' | 'obj' | 'gltf' */
  async export(app, fmt) {
    if (!app.scene3d) throw new Error('Workspace 3D non attivo.');
    const docGroup = app.scene3d.docGroup;
    const solidsCount = docGroup.children.filter(c => c.isMesh && c.userData.solidId).length;
    if (solidsCount === 0) {
      app.cli.echo('Nessun solido 3D da esportare. Crea estrusioni/primitive prima.', 'warn');
      return;
    }
    await window.ensureThreeJsLoaded();
    const mods = await this._loadExporters();
    const baseName = (app.doc.name || 'Disegno1').replace(/\s+/g, '_');

    switch (fmt) {
      case 'stl': {
        const exporter = new mods.STLExporter();
        /* binary = più compatto; opzionale: false → ASCII */
        const data = exporter.parse(docGroup, { binary: true });
        const blob = new Blob([data], { type: 'application/octet-stream' });
        this._download(blob, `${baseName}.stl`);
        app.cli.echo(`Esportati ${solidsCount} solidi in ${baseName}.stl (binary).`, 'ok');
        break;
      }
      case 'obj': {
        const exporter = new mods.OBJExporter();
        const text = exporter.parse(docGroup);
        const blob = new Blob([text], { type: 'text/plain' });
        this._download(blob, `${baseName}.obj`);
        app.cli.echo(`Esportati ${solidsCount} solidi in ${baseName}.obj.`, 'ok');
        break;
      }
      case 'gltf': {
        const exporter = new mods.GLTFExporter();
        const json = await new Promise((res, rej) => {
          exporter.parse(docGroup, res, rej, { binary: false, onlyVisible: true });
        });
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'model/gltf+json' });
        this._download(blob, `${baseName}.gltf`);
        app.cli.echo(`Esportati ${solidsCount} solidi in ${baseName}.gltf.`, 'ok');
        break;
      }
      default:
        throw new Error(`Formato non supportato: ${fmt}`);
    }
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
