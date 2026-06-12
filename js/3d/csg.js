/* Operazioni booleane CSG su mesh — three-bvh-csg risolto dall'import map (vendor locale) */
const CSG = {
  _libPromise: null,

  async load() {
    if (this._libPromise) return this._libPromise;
    this._libPromise = (async () => {
      await window.ensureThreeJsLoaded();
      const mod = await import('three-bvh-csg');
      return mod;
    })();
    return this._libPromise;
  },

  /* op = 'union' | 'subtract' | 'intersect'
     Riceve i record solidi sorgenti (array doc.solids), ritorna una NUOVA mesh combinata. */
  async perform(op, meshA, meshB) {
    const lib = await this.load();
    const THREE = window.THREE;
    const evaluator = new lib.Evaluator();
    const brushA = new lib.Brush(meshA.geometry, meshA.material);
    brushA.position.copy(meshA.position);
    brushA.rotation.copy(meshA.rotation);
    brushA.scale.copy(meshA.scale);
    brushA.updateMatrixWorld();

    const brushB = new lib.Brush(meshB.geometry, meshB.material);
    brushB.position.copy(meshB.position);
    brushB.rotation.copy(meshB.rotation);
    brushB.scale.copy(meshB.scale);
    brushB.updateMatrixWorld();

    const opMap = {
      union: lib.ADDITION,
      subtract: lib.SUBTRACTION,
      intersect: lib.INTERSECTION,
    };
    const result = evaluator.evaluate(brushA, brushB, opMap[op] || lib.ADDITION);
    /* result è già un Mesh; assicuro che riceva ombre e che il materiale sia clonato */
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  },
};

/* Tool comune: opera sui solidi selezionati nella scena 3D */
class CsgTool extends Tool {
  constructor(app, op, label) {
    super(app);
    this.op = op;
    this.label = label;
  }
  async activate() {
    if (this.app.mode !== '3d' || !this.app.scene3d) {
      this.echo(`Passa al workspace 3D e seleziona i solidi prima del comando ${this.label}.`, 'warn');
      this.cancel(); return;
    }
    const sel = [...this.app.scene3d.selectedSolids];
    if (sel.length < 2) {
      this.echo(`Selezionare almeno 2 solidi 3D (click sui solidi in scena, Shift+click per aggiungere).`, 'warn');
      this.cancel(); return;
    }
    try {
      this.echo(`${this.label}: elaborazione...`, 'info');
      /* trova i mesh corrispondenti */
      const meshes = sel.map(id => this.app.scene3d.docGroup.children.find(m => m.userData.solidId === id)).filter(Boolean);
      if (meshes.length < 2) { this.echo('Mesh non trovate.', 'err'); this.cancel(); return; }

      /* Pipeline: A op B op C ... */
      let acc = meshes[0];
      for (let i = 1; i < meshes.length; i++) {
        acc = await CSG.perform(this.op, acc, meshes[i]);
      }

      /* Crea record solid "csg-mesh" che memorizza la geometria risultante come BufferGeometry serializzata.
         Per semplicità memorizzo posizione+indici come array.  */
      const geom = acc.geometry;
      const positions = Array.from(geom.attributes.position.array);
      const normals = geom.attributes.normal ? Array.from(geom.attributes.normal.array) : null;
      const indices = geom.index ? Array.from(geom.index.array) : null;
      const layer = this.doc.getLayer(this.doc.currentLayerName);
      const rec = {
        id: Utils.uid(),
        kind: 'csg-mesh',
        layer: this.doc.currentLayerName,
        color: layer ? layer.color : '#ffffff',
        params: { positions, normals, indices },
      };
      /* rimuovi i solidi sorgenti */
      for (const id of sel) this.doc.removeSolid(id);
      this.doc.addSolid(rec);
      this.app.scene3d.selectedSolids.clear();
      this.app.history.snapshot(`csg-${this.op}`);
      this.app.scene3d.syncFromDocument(this.doc);
      this.echo(`${this.label} completato.`, 'ok');
    } catch (err) {
      this.echo(`Errore ${this.label}: ${err.message}`, 'err');
      console.error(err);
    }
    this.cancel();
  }
}

class UnionTool     extends CsgTool { constructor(app) { super(app, 'union',     'Unione'); } }
class SubtractTool  extends CsgTool { constructor(app) { super(app, 'subtract',  'Sottrazione'); } }
class IntersectTool extends CsgTool { constructor(app) { super(app, 'intersect', 'Intersezione'); } }
