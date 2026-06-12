/* ===========================================================
   Scene3D — Three.js scene per workspace 3D di WebCAD
   ===========================================================
   Carica Three.js dinamicamente da CDN al primo uso (lazy).
   Esporta window.Scene3D (class) e window.ensureThreeJsLoaded().
   =========================================================== */

/* Three.js viene risolto dall'import map definita in index.html:
   - "three"                              -> ./vendor/three/three.module.js
   - "three/addons/controls/OrbitControls.js" -> ./vendor/three/controls/OrbitControls.js
   Così funziona anche offline senza CDN. */

let _threePromise = null;

window.ensureThreeJsLoaded = function() {
  if (_threePromise) return _threePromise;
  _threePromise = (async () => {
    const three = await import('three');
    const orbit = await import('three/addons/controls/OrbitControls.js');
    window.THREE = three;
    window.OrbitControls = orbit.OrbitControls;
    return three;
  })();
  return _threePromise;
};

class Scene3D {
  constructor(host) {
    const THREE = window.THREE;
    this.host = host;
    this.objectsByEntityId = new Map();

    /* Scena */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1f2733);

    /* Camera prospettica */
    const r = host.getBoundingClientRect();
    const aspect = (r.width || 800) / (r.height || 600);
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 50000);
    this.camera.position.set(80, -80, 60);
    this.camera.up.set(0, 0, 1); /* convenzione CAD: Z verso l'alto */
    this.camera.lookAt(0, 0, 0);

    /* Renderer */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(r.width || 800, r.height || 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    host.appendChild(this.renderer.domElement);

    /* Sezione dinamica (clipping plane) */
    this.section = {
      enabled: false,
      axis: 'Z',          /* normale del piano: X|Y|Z */
      pos: 0,             /* coordinata del piano lungo l'asse normale */
      flip: false,        /* inverte il lato visibile */
      plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
      visualizer: null,   /* mesh quad semitrasparente che mostra il piano di taglio */
    };

    /* Luci — salvate per essere riconfigurate dai preset */
    this.lights = {
      ambient: new THREE.AmbientLight(0xffffff, 0.55),
      sun: new THREE.DirectionalLight(0xffffff, 0.85),
      back: new THREE.DirectionalLight(0x8aa6ff, 0.25),
    };
    const sun = this.lights.sun;
    sun.position.set(80, 60, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    this.lights.back.position.set(-100, -80, 60);
    this.scene.add(this.lights.ambient);
    this.scene.add(this.lights.sun);
    this.scene.add(this.lights.back);

    /* Style: preset materiale + illuminazione (persistono finché Scene3D vive) */
    this.style = {
      material: 'pbr',     /* pbr | phong | flat | wireframe */
      lighting: 'studio',  /* studio | outdoor | minimal */
      shadows: true,
      sunIntensity: 0.85,
    };

    /* Griglia + assi colorati */
    this.grid = new THREE.GridHelper(200, 40, 0x666666, 0x3a3a3a);
    /* GridHelper di default è su XZ; per CAD lo metto su XY (ruoto su X di 90°) */
    this.grid.rotation.x = Math.PI / 2;
    this.scene.add(this.grid);

    this.axes = this._makeColoredAxes(60);
    this.scene.add(this.axes);

    /* Piano d'appoggio per le ombre (invisibile, riceve solo) */
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this.shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), shadowMat);
    this.shadowPlane.rotation.x = 0; /* su XY */
    this.shadowPlane.position.z = -0.01;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    /* OrbitControls */
    this.controls = new window.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 5000;
    /* tasto medio per pan come CAD */
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };

    /* Container 3D dei mesh "documento" */
    this.docGroup = new THREE.Group();
    this.docGroup.name = 'doc';
    this.scene.add(this.docGroup);

    /* Selezione solid: id -> bool */
    this.selectedSolids = new Set();
    this._raycaster = new THREE.Raycaster();
    this._mouseNdc = new THREE.Vector2();

    /* Click sinistro sui solidi → selezione (shift = aggiungi) */
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      this._mouseNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this._mouseNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this._raycaster.setFromCamera(this._mouseNdc, this.camera);
      const hits = this._raycaster.intersectObjects(this.docGroup.children, false);
      const meshHit = hits.find(h => h.object.userData.solidId);
      if (!e.shiftKey) this.selectedSolids.clear();
      if (meshHit) {
        const id = meshHit.object.userData.solidId;
        if (this.selectedSolids.has(id) && e.shiftKey) this.selectedSolids.delete(id);
        else this.selectedSolids.add(id);
      }
      this._refreshSelectionVisual();
      if (window.app && window.app.ui) window.app.ui.refreshSolidSelectionPanel();
    });

    this._loop = this._loop.bind(this);
    this._running = false;
  }

  _refreshSelectionVisual() {
    const THREE = window.THREE;
    for (const m of this.docGroup.children) {
      if (!m.userData.solidId) continue;
      const isSel = this.selectedSolids.has(m.userData.solidId);
      if (isSel) {
        if (!m.userData._origEmissive) m.userData._origEmissive = m.material.emissive ? m.material.emissive.clone() : new THREE.Color(0);
        if (m.material.emissive) m.material.emissive.setHex(0x2266ff);
      } else if (m.userData._origEmissive && m.material.emissive) {
        m.material.emissive.copy(m.userData._origEmissive);
      }
    }
  }

  _makeColoredAxes(len) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const mk = (color, dir) => {
      const m = new THREE.LineBasicMaterial({ color });
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(dir.x * len, dir.y * len, dir.z * len),
      ]);
      group.add(new THREE.Line(g, m));
      /* cono freccia */
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(len * 0.04, len * 0.12, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      cone.position.set(dir.x * len, dir.y * len, dir.z * len);
      /* orienta il cono lungo dir */
      if (dir.x) cone.rotation.z = -Math.PI / 2;
      else if (dir.z) cone.rotation.x = 0;
      else cone.rotation.x = Math.PI / 2;
      group.add(cone);
    };
    mk(0xe74c3c, { x: 1, y: 0, z: 0 }); /* X */
    mk(0x2ecc71, { x: 0, y: 1, z: 0 }); /* Y */
    mk(0x3498db, { x: 0, y: 0, z: 1 }); /* Z */
    return group;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }
  stop() { this._running = false; }
  _loop() {
    if (!this._running) return;
    requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(r.width, r.height);
  }

  /* ===== Viste preset ===== */
  setView(name) {
    const d = 120;
    switch (name) {
      case 'top':
        this.camera.position.set(0, 0, d);
        this.camera.up.set(0, 1, 0);
        break;
      case 'front':
        this.camera.position.set(0, -d, 0);
        this.camera.up.set(0, 0, 1);
        break;
      case 'right':
        this.camera.position.set(d, 0, 0);
        this.camera.up.set(0, 0, 1);
        break;
      case 'iso':
      default:
        this.camera.position.set(d * 0.7, -d * 0.7, d * 0.7);
        this.camera.up.set(0, 0, 1);
        break;
    }
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  /* ===== Sincronizzazione documento 2D -> oggetti 3D ===== */
  /* Le entità 2D vengono mostrate come linee/curve su piano Z=0,
     i solidi (doc.solids) come mesh estruse con materiale shaded. */
  syncFromDocument(doc) {
    const THREE = window.THREE;
    /* svuota */
    while (this.docGroup.children.length) {
      const c = this.docGroup.children[0];
      this.docGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material && c.material.dispose) c.material.dispose();
    }
    this.objectsByEntityId.clear();

    /* Solidi 3D */
    for (const s of doc.solids) {
      const layer = doc.getLayer(s.layer || '0');
      if (layer && !layer.visible) continue;
      const mesh = this._buildSolidMesh(s, layer);
      if (mesh) {
        mesh.userData.solidId = s.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.docGroup.add(mesh);
      }
    }

    for (const ent of doc.entities) {
      const layer = doc.getLayer(ent.layer);
      if (!layer || !layer.visible) continue;
      const color = new THREE.Color(this._resolveColor(ent, layer));
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
      let obj = null;

      switch (ent.type) {
        case 'line': {
          const g = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(ent.p1.x, ent.p1.y, 0),
            new THREE.Vector3(ent.p2.x, ent.p2.y, 0),
          ]);
          obj = new THREE.Line(g, mat); break;
        }
        case 'polyline': {
          const pts = ent.points.map(p => new THREE.Vector3(p.x, p.y, 0));
          if (ent.closed && pts.length > 2) pts.push(pts[0].clone());
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          obj = new THREE.Line(g, mat); break;
        }
        case 'circle': {
          const pts = [];
          const N = 64;
          for (let i = 0; i <= N; i++) {
            const a = (i / N) * Math.PI * 2;
            pts.push(new THREE.Vector3(ent.center.x + ent.radius * Math.cos(a), ent.center.y + ent.radius * Math.sin(a), 0));
          }
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          obj = new THREE.LineLoop(g, mat); break;
        }
        case 'arc': {
          const pts = [];
          const N = 48;
          const a0 = ent.startAngle, a1 = ent.endAngle;
          const span = (a1 - a0 + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2;
          for (let i = 0; i <= N; i++) {
            const a = a0 + (i / N) * span;
            pts.push(new THREE.Vector3(ent.center.x + ent.radius * Math.cos(a), ent.center.y + ent.radius * Math.sin(a), 0));
          }
          obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); break;
        }
        case 'rectangle': {
          const c = [
            new THREE.Vector3(ent.p1.x, ent.p1.y, 0),
            new THREE.Vector3(ent.p2.x, ent.p1.y, 0),
            new THREE.Vector3(ent.p2.x, ent.p2.y, 0),
            new THREE.Vector3(ent.p1.x, ent.p2.y, 0),
            new THREE.Vector3(ent.p1.x, ent.p1.y, 0),
          ];
          obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c), mat); break;
        }
        case 'ellipse': {
          const pts = [];
          const N = 64;
          for (let i = 0; i <= N; i++) {
            const a = (i / N) * Math.PI * 2;
            pts.push(new THREE.Vector3(ent.center.x + ent.rx * Math.cos(a), ent.center.y + ent.ry * Math.sin(a), 0));
          }
          obj = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat); break;
        }
        case 'point': {
          const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ent.position.x, ent.position.y, 0)]);
          obj = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 3, sizeAttenuation: false })); break;
        }
      }
      if (obj) {
        obj.userData.entityId = ent.id;
        this.docGroup.add(obj);
        this.objectsByEntityId.set(ent.id, obj);
      }
    }
  }

  _resolveColor(ent, layer) {
    const c = ent.color;
    if (!c || c === '#bylayer' || c === 'BYLAYER') return layer ? layer.color : '#ffffff';
    return c;
  }

  /* Factory materiale in base al preset corrente */
  _makeMaterial(colorHex) {
    const THREE = window.THREE;
    const color = new THREE.Color(colorHex);
    const planes = this.section.enabled ? [this.section.plane] : [];
    const common = { color, side: THREE.DoubleSide, clippingPlanes: planes, clipShadows: true };
    switch (this.style.material) {
      case 'flat':      return new THREE.MeshBasicMaterial(common);
      case 'phong':     return new THREE.MeshPhongMaterial({ ...common, shininess: 80, specular: 0x222222 });
      case 'wireframe': return new THREE.MeshBasicMaterial({ ...common, wireframe: true });
      case 'pbr':
      default:          return new THREE.MeshStandardMaterial({ ...common, metalness: 0.05, roughness: 0.62 });
    }
  }

  /* Costruzione mesh per un record solido */
  _buildSolidMesh(s, layer) {
    const THREE = window.THREE;
    const mat = this._makeMaterial(this._resolveColor({ color: s.color }, layer));
    let geom = null;
    const p = s.params || {};
    const h = s.height || 1;

    switch (s.kind) {
      case 'extrude-circle': {
        geom = new THREE.CylinderGeometry(p.radius, p.radius, h, 48, 1, false);
        /* CylinderGeometry è verticale lungo Y; ruoto a Z */
        geom.rotateX(Math.PI / 2);
        geom.translate(p.cx || 0, p.cy || 0, h / 2);
        break;
      }
      case 'extrude-rect': {
        const w = Math.abs(p.x2 - p.x1), d = Math.abs(p.y2 - p.y1);
        geom = new THREE.BoxGeometry(w, d, h);
        geom.translate((p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, h / 2);
        break;
      }
      case 'extrude-polyline': {
        const shape = new THREE.Shape();
        const pts = p.points || [];
        if (pts.length < 3) return null;
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();
        geom = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 24 });
        break;
      }
      case 'extrude-ellipse': {
        const shape = new THREE.Shape();
        const N = 64;
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          const x = (p.cx || 0) + p.rx * Math.cos(a);
          const y = (p.cy || 0) + p.ry * Math.sin(a);
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        geom = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 24 });
        break;
      }
      /* ----- Primitive 3D ----- */
      case 'prim-box': {
        geom = new THREE.BoxGeometry(p.w, p.d, p.h);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.h / 2);
        break;
      }
      case 'prim-sphere': {
        geom = new THREE.SphereGeometry(p.r, 48, 32);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.r);
        break;
      }
      case 'prim-cylinder': {
        geom = new THREE.CylinderGeometry(p.r, p.r, p.h, 48, 1);
        geom.rotateX(Math.PI / 2);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.h / 2);
        break;
      }
      case 'prim-cone': {
        geom = new THREE.ConeGeometry(p.r, p.h, 48);
        geom.rotateX(Math.PI / 2);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.h / 2);
        break;
      }
      case 'prim-torus': {
        geom = new THREE.TorusGeometry(p.R, p.r, 24, 64);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.r);
        break;
      }
      case 'revolve': {
        /* p.points: [{x,y}] profilo 2D world; p.axis: 'X'|'Y'; p.angleDeg */
        const pts = (p.points || []).map(pp => new THREE.Vector2(Math.abs(pp[p.axis === 'X' ? 'y' : 'x']), pp[p.axis === 'X' ? 'x' : 'y']));
        if (pts.length < 2) return null;
        const ang = Utils.deg2rad(p.angleDeg || 360);
        geom = new THREE.LatheGeometry(pts, 64, 0, ang);
        if (p.axis === 'X') geom.rotateZ(-Math.PI / 2);
        break;
      }
      case 'csg-mesh': {
        const positions = new Float32Array(p.positions);
        geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        if (p.normals) geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(p.normals), 3));
        if (p.indices) geom.setIndex(p.indices);
        if (!p.normals) geom.computeVertexNormals();
        break;
      }
      case 'prim-pyramid': {
        /* piramide a base quadrata = ConeGeometry con 4 segmenti radiali */
        geom = new THREE.ConeGeometry(p.base * Math.SQRT2 / 2, p.h, 4);
        geom.rotateX(Math.PI / 2);
        geom.rotateZ(Math.PI / 4);
        geom.translate(p.cx, p.cy, (p.z || 0) + p.h / 2);
        break;
      }
      default:
        return null;
    }
    return new THREE.Mesh(geom, mat);
  }

  /* ===== Sezione dinamica ===== */
  _updateSectionPlane() {
    const THREE = window.THREE;
    const s = this.section;
    const sign = s.flip ? -1 : 1;
    const n = new THREE.Vector3(
      s.axis === 'X' ? sign : 0,
      s.axis === 'Y' ? sign : 0,
      s.axis === 'Z' ? sign : 0,
    );
    /* Plane.constant: signed distance dell'origine dal piano.
       Vogliamo che il piano passi per coord = s.pos lungo s.axis.
       Equazione: n·p + d = 0 con p sul piano -> d = -n·p_on_plane.
       Se p_on_plane = (pos,0,0) e n=(±1,0,0) -> d = ∓pos. */
    s.plane.normal.copy(n);
    s.plane.constant = -sign * s.pos;
  }
  _rebuildSectionVisualizer() {
    const THREE = window.THREE;
    const s = this.section;
    if (s.visualizer) {
      this.scene.remove(s.visualizer);
      s.visualizer.geometry.dispose();
      s.visualizer.material.dispose();
      s.visualizer = null;
    }
    if (!s.enabled) return;
    const size = 200;
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa33, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    /* Allineamento normale: PlaneGeometry è su XY (normale +Z).
       Per asse X ruoto Y di 90°, per asse Y ruoto X di -90°, per Z resta. */
    if (s.axis === 'X') { mesh.rotation.y = Math.PI / 2; mesh.position.x = s.pos; }
    else if (s.axis === 'Y') { mesh.rotation.x = -Math.PI / 2; mesh.position.y = s.pos; }
    else { mesh.position.z = s.pos; }
    s.visualizer = mesh;
    this.scene.add(mesh);
  }
  setSectionEnabled(on) {
    this.section.enabled = !!on;
    this._updateSectionPlane();
    this._applyClippingToMaterials();
    this._rebuildSectionVisualizer();
  }
  setSectionAxis(axis) {
    if (!['X', 'Y', 'Z'].includes(axis)) return;
    this.section.axis = axis;
    this._updateSectionPlane();
    this._rebuildSectionVisualizer();
  }
  setSectionPos(pos) {
    this.section.pos = Number(pos) || 0;
    this._updateSectionPlane();
    if (this.section.visualizer) {
      const s = this.section;
      const v = s.visualizer;
      v.position.set(0, 0, 0);
      if (s.axis === 'X') v.position.x = s.pos;
      else if (s.axis === 'Y') v.position.y = s.pos;
      else v.position.z = s.pos;
    }
  }
  setSectionFlip(flip) {
    this.section.flip = !!flip;
    this._updateSectionPlane();
  }
  _applyClippingToMaterials() {
    const planes = this.section.enabled ? [this.section.plane] : [];
    for (const m of this.docGroup.children) {
      if (m.material && 'clippingPlanes' in m.material) {
        m.material.clippingPlanes = planes;
        m.material.needsUpdate = true;
      }
    }
  }

  /* ===== Style: materiali e illuminazione ===== */
  setMaterialPreset(name) {
    if (!['pbr', 'phong', 'flat', 'wireframe'].includes(name)) return;
    this.style.material = name;
    /* Ricostruisce i materiali di tutte le mesh esistenti senza ricreare le geometrie */
    for (const m of this.docGroup.children) {
      if (!m.isMesh) continue;
      const oldColor = m.material && m.material.color ? '#' + m.material.color.getHexString() : '#ffffff';
      m.material.dispose();
      m.material = this._makeMaterial(oldColor);
      m.material.needsUpdate = true;
    }
  }
  setLightingPreset(name) {
    if (!['studio', 'outdoor', 'minimal'].includes(name)) return;
    this.style.lighting = name;
    const { ambient, sun, back } = this.lights;
    switch (name) {
      case 'outdoor':
        ambient.color.setHex(0xfff4d6); ambient.intensity = 0.35;
        sun.color.setHex(0xffffff);     sun.intensity = this.style.sunIntensity * 1.4;
        sun.position.set(100, 80, 200);
        back.color.setHex(0x88aaff);    back.intensity = 0.15;
        break;
      case 'minimal':
        ambient.color.setHex(0xffffff); ambient.intensity = 0.95;
        sun.intensity = 0;
        back.intensity = 0;
        break;
      case 'studio':
      default:
        ambient.color.setHex(0xffffff); ambient.intensity = 0.55;
        sun.color.setHex(0xffffff);     sun.intensity = this.style.sunIntensity;
        sun.position.set(80, 60, 120);
        back.color.setHex(0x8aa6ff);    back.intensity = 0.25;
        break;
    }
  }
  setShadowsEnabled(on) {
    this.style.shadows = !!on;
    this.renderer.shadowMap.enabled = !!on;
    this.lights.sun.castShadow = !!on;
    if (this.shadowPlane) this.shadowPlane.visible = !!on;
    /* obbliga il refresh dei materiali (clipShadows interagisce con shadowMap) */
    for (const m of this.docGroup.children) {
      if (m.material) m.material.needsUpdate = true;
    }
  }
  setSunIntensity(v) {
    this.style.sunIntensity = Math.max(0, Math.min(3, Number(v) || 0));
    if (this.style.lighting === 'studio') this.lights.sun.intensity = this.style.sunIntensity;
    else if (this.style.lighting === 'outdoor') this.lights.sun.intensity = this.style.sunIntensity * 1.4;
  }

  dispose() {
    this.stop();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

window.Scene3D = Scene3D;
