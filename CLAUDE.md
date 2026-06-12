# Claude — Note operative su WebCAD

> Memo persistente per le sessioni Claude Code lavorando su questo progetto.
> Aggiornare ad ogni modifica significativa (vedi anche README.md).

## Identità del progetto

**WebCAD 2025** — clone web di AutoCAD 2025.

> Manuale d'uso completo per l'utente finale: `USER_GUIDE.md`.
- Stack: HTML5 + Canvas 2D + JavaScript vanilla (no bundler, no framework) + PHP 8 + SQLite (PDO).
- Modalità 2D nativa, modalità 3D opzionale via Three.js (vendor locale, import map).
- File salvati lato server (SQLite) e bozza locale (localStorage).
- Interoperabilità: DXF R2000 import/export, PNG/SVG export.

## Avvio

```bash
./start.sh
```

Lo script verifica PHP, PDO_SQLITE, porta libera, avvia `php -S 127.0.0.1:8000` nella root del progetto, fa smoke test e apre il browser.

In assenza di `start.sh`:
```bash
php -S 127.0.0.1:8000
```

## Conventioni utente

- **Lingua**: italiano nell'UI e nelle risposte. Sempre accenti corretti (è, à, ù, ò, é, ì).
- **Stile UI**: flat, niente emoji eccessive, niente popup nativi (`alert/prompt/confirm`) — solo Modal eleganti.
- **Documentazione**: tenere `README.md` e questo `CLAUDE.md` aggiornati ad ogni cambio rilevante.
- **No backend stuff hard-coded**: tutto offline-friendly, vendor locale.

## Architettura runtime

Caricamento file in `index.html` (ordine critico — niente moduli ES per gli script "classici"):

```
utils -> geom -> camera -> layer -> entities/* -> document -> snap -> history
      -> renderer -> tools/* -> io/api -> io/exporters -> io/dxf -> io/autosave
      -> 3d/scene3d (lazy three.js) -> 3d/csg (lazy three-bvh-csg)
      -> ui/theme -> ui/ui -> ui/command-line -> core/app
```

`scene3d.js` e `csg.js` importano `three`, `three/addons/controls/OrbitControls.js`,
`three-bvh-csg` come **bare specifiers**, risolti via **import map** in `index.html`
verso i moduli locali in `vendor/`.

### Tre.js offline

```
vendor/
├── three/
│   ├── three.module.js
│   ├── controls/OrbitControls.js
│   └── exporters/{STL,OBJ,GLTF}Exporter.js
├── three-mesh-bvh/index.module.js
└── three-bvh-csg/index.module.js
```

`scene3d.js::ensureThreeJsLoaded()` fa il `import('three')` lazy al primo uso del 3D.

## Modello dati (CadDocument.toJSON)

```jsonc
{
  "name": "string",
  "currentLayer": "string",
  "layers": [{ "name", "color", "visible", "locked", "lineType", "lineWeight" }],
  "entities": [
    /* tipi: line, polyline, circle, arc, rectangle, ellipse, point, text, dimension */
  ],
  "solids": [
    /* kind: extrude-{circle|rect|polyline|ellipse},
             prim-{box|sphere|cylinder|cone|torus|pyramid},
             revolve, csg-mesh */
  ]
}
```

I file in `samples/*.json` rispettano questo schema e sono caricabili dal comando `SAMPLE`.

## Comandi principali (alias)

| Alias      | Funzione                | Alias    | Funzione                  |
|------------|-------------------------|----------|---------------------------|
| L          | line                    | EXT      | estrusione 2D→3D          |
| PL         | polyline                | BOX      | primitiva box             |
| C          | circle                  | SPHERE   | primitiva sfera           |
| REC        | rectangle               | CYL      | primitiva cilindro        |
| EL         | ellipse                 | CONE     | primitiva cono            |
| A          | arc                     | TORUS    | primitiva toro            |
| T          | text                    | PYR      | primitiva piramide        |
| DIM        | dimensione              | REV      | rivoluzione (Lathe)       |
| M / CO     | move / copy             | UNION    | CSG unione                |
| RO / SC    | rotate / scale          | SUB      | CSG sottrazione           |
| MI / O     | mirror / offset         | INT      | CSG intersezione          |
| TR / EX    | trim / extend           | SEC      | sezione dinamica          |
| F / E      | fillet / erase          | SAMPLE   | apri esempio              |
| U / RE     | undo / redo             | RENAME   | rinomina progetto         |
| LA / Z     | layer / zoom extents    | 3D       | toggle workspace 3D       |
| SAVE / NEW | salva / nuovo           | DXF / SVG| export                    |
| STL / OBJ  | export 3D STL/OBJ       | GLTF/GLB | export glTF               |

## Stato attuale roadmap 3D

- [x] Step 1 — Workspace 3D, Three.js, orbit, griglia, viewcube
- [x] Step 2 — Estrusione 2D→3D
- [x] Step 3 — Primitive (box, sphere, cylinder, cone, torus, pyramid)
- [x] Step 4 — Booleani CSG (union, subtract, intersect)
- [x] Step 5 — Rivoluzione (LatheGeometry)
- [x] Step 6 — Sezione dinamica (Three.Plane clipping)
- [x] Step 7 — Materiali (PBR/Phong/Flat/Wireframe) + luci (Studio/Outdoor/Minimal) + ombre + intensità sole
- [x] Step 8 — Export STL (binary) / OBJ / glTF (lazy load `three/addons/exporters/*`)

## File di esempio (samples/)

- `01-planimetria.json` — appartamento 2D con layer multipli e quote
- `02-meccanica-3d.json` — base + cilindri + sfera + toro (assemblaggio)
- `03-vaso-rivoluzione.json` — profilo + solido di rivoluzione
- `04-elementi-base.dxf` — DXF importabile (linee, cerchi, polyline, testo)

Caricabili dal pulsante "Esempi" in quick-access o dal comando `SAMPLE`.

## Persistenza

- **Server**: `backend/api.php` (SQLite in `data/webcad.db`).
  Azioni: `list`, `load`, `save`, `rename`, `delete`.
- **Locale (autosave)**: `js/io/autosave.js` -> `localStorage["webcad.autosave"]`,
  debounce 800ms. Modal di ripristino al boot se trovata bozza non vuota.

## Modal API (js/ui/ui.js)

```js
await Modal.input(title, label, defaultValue, opts)   // → Promise<string|null>
await Modal.confirm(title, message, opts)             // → Promise<boolean>
await Modal.form(title, fields, opts)                 // → Promise<{[k]:value}|null>
// fields: [{ key, label, value, type: 'text'|'number'|'select', options, min, max, step }]
```

Tutti i `prompt/confirm/alert` nativi sono stati eliminati. Mai reintrodurli.

## Cose da non fare

- Non aggiungere dipendenze CDN per Three.js o suoi addon: usa l'import map locale.
- Non usare `alert()`, `prompt()`, `confirm()` nativi (rompono l'UX flat).
- Non rompere l'ordine di caricamento script in `index.html`: niente `type="module"` sui file `js/` legacy.
- Non commit di `data/webcad.db` (è runtime, gitignore-like).
- Non toccare gli accenti italiani.

## Strumenti di debug

- Console del browser → log `[WebCAD]`.
- `js/core/app.js::showFatalError()` → banner rosso fisso se boot crash.
- Comando `CLEAR` → pulisce la cronologia comandi.
- Bozza autosave: `localStorage.getItem('webcad.autosave')` in DevTools.

## Per spostare la sessione Claude su un altro PC

Il codice (`Autocad-clone/`) è autonomo: basta copiarlo. La memoria/cronologia di
Claude Code è invece in `~/.claude/projects/<slug-del-path>/` e dipende dal path
assoluto. Per portare anche quella, copiare la cartella memoria nella nuova
posizione, oppure tenere il knowledge dentro questo `CLAUDE.md` (è già caricato
in automatico da Claude Code ovunque venga aperto il progetto).
