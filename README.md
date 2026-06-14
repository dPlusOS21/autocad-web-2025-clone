# WebCAD 2025

Clone web di AutoCAD 2025 (2D + 3D). Interfaccia ribbon con tema
chiaro/scuro, canvas HTML5, workspace 3D opzionale via Three.js
(distribuito in locale), backend PHP + SQLite per la persistenza.

🚀 **Demo live** (2D + 3D, gira interamente nel browser): **https://thecloners21.github.io/autocad-web-2025-clone/**

> 📖 **Manuale d'uso completo**: [USER_GUIDE.md](USER_GUIDE.md)

## Caratteristiche

### Disegno
- Linea, polilinea, cerchio, arco (3 punti), rettangolo, ellisse, punto
- Testo, quotatura lineare allineata

### Modifica
- Sposta, copia, ruota, scala, specchio, offset, trim, estendi, raccordo, cancella
- Grip-edit sugli oggetti selezionati
- Selezione singola, con finestra (window/crossing)

### Disegno assistito
- **Object snap**: estremo, mediano, centro, intersezione, perpendicolare, quadrante
- **Orto** (F8), **polare** (F10), **snap a griglia** (F9), **OSnap** (F3)
- Coordinate digitate: assolute `100,50`, relative `@30,20`, polari `@50<45`
- Crosshair, marker di snap colorati come AutoCAD

### Layer
- Multi-layer con colore, visibilità, blocco, tipo linea, spessore
- Riassegnazione automatica al layer `0` se un layer viene eliminato

### Interfaccia
- Ribbon con tab Home / Inserisci / Annota / Modifica / Vista / Output
- Pannello layer e proprietà a destra, pannello progetti a sinistra
- Riga di comando con history (frecce ↑↓) e alias AutoCAD
- ViewCube e icona UCS in canvas
- Status bar con coordinate live, toggle griglia/ortho/snap

### File / interoperabilità
- Salvataggio nativo via API (SQLite lato server)
- **Autosave** in localStorage con ripristino bozza all'avvio
- Export **PNG**, **SVG**, **DXF** (R2000, leggibile da AutoCAD/QCAD/LibreCAD)
- Import **DXF** (LINE, LWPOLYLINE, CIRCLE, ARC, POINT, TEXT, ELLIPSE)
- Cartella `samples/` con esempi (planimetria, meccanica 3D, rivoluzione, DXF)

### 3D (Three.js, vendor locale)
- Workspace 3D con orbit/pan/zoom, viewcube, viste Top/Front/Right/Iso
- **Estrusione** 2D→3D (cerchio, rettangolo, polilinea chiusa, ellisse)
- **Primitive**: box, sfera, cilindro, cono, toro, piramide
- **Rivoluzione** di un profilo polilinea attorno ad asse X/Y (LatheGeometry)
- **Booleani CSG**: unione, sottrazione, intersezione (three-bvh-csg)
- **Sezione dinamica**: piano di taglio interattivo con asse X/Y/Z, slider posizione, flip
- **Materiali e luci**: preset PBR / Phong / Flat / Wireframe; illuminazione Studio / Outdoor / Minimal; toggle ombre e intensità sole
- **Export 3D**: STL (binary), OBJ, glTF
- Three.js è in `vendor/` (no CDN): funziona anche offline

## Avvio

Serve PHP ≥ 7.4 con estensione `pdo_sqlite`.

```bash
cd Autocad-clone
php -S 0.0.0.0:8080
```

Poi apri il browser su:

    http://localhost:8080/

Il database SQLite verrà creato automaticamente in `data/webcad.db`.

## Comandi rapidi (alias)

| Alias | Comando         | Alias | Comando        |
|-------|-----------------|-------|----------------|
| L     | Linea           | M     | Sposta         |
| PL    | Polilinea       | CO    | Copia          |
| C     | Cerchio         | RO    | Ruota          |
| A     | Arco            | SC    | Scala          |
| REC   | Rettangolo      | MI    | Specchio       |
| EL    | Ellisse         | O     | Offset         |
| PO    | Punto           | TR    | Trim           |
| T     | Testo           | EX    | Estendi        |
| DIM   | Quota lineare   | F     | Raccordo       |
| LA    | Layer (aggiungi)| E     | Cancella       |
| U     | Annulla         | RE    | Ripeti         |
| Z     | Zoom estensione | SAVE  | Salva          |
| DXF   | Esporta DXF     | SVG   | Esporta SVG    |

## Scorciatoie

- `Ctrl+Z` / `Ctrl+Y` — Annulla / Ripeti
- `Ctrl+S` — Salva
- `Ctrl+A` — Seleziona tutto
- `Canc`   — Cancella selezione
- `F3` OSnap, `F7` Griglia, `F8` Orto, `F9` Snap, `F10` Polare
- `Esc`    — Annulla comando corrente
- Tasto medio mouse — Pan
- Rotella mouse — Zoom in/out

## Architettura

```
Autocad-clone/
├── index.html
├── css/style.css
├── js/
│   ├── core/    utils, geom, camera, renderer, snap, history, layer, document, app
│   ├── entities/ line, polyline, circle, arc, rectangle, ellipse, point, text, dimension
│   ├── tools/   select, draw-tools, modify-tools
│   ├── ui/      ui, command-line
│   └── io/      api, exporters, dxf
├── backend/     api.php, db.php
└── data/        webcad.db (creato a runtime)
```

## Limiti noti

- Niente formato `.dwg` (proprietario Autodesk, non legalmente
  reverse-engineerabile). L'interscambio passa da DXF.
- 3D limitato a solidi parametrici (estrusione, primitive, rivoluzione, CSG):
  niente texturing UV avanzato, niente animazioni.
- Tipi di linea limitati ai più comuni; niente font shx personalizzati.
- Trim/extend supportano principalmente linee.
- Stampa: usa l'export PNG/SVG/DXF o `Ctrl+P` del browser.

## Licenza

Codice libero per uso personale ed educativo.
