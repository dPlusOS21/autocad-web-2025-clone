# Manuale d'uso — WebCAD 2025

> Guida completa per usare WebCAD: clone web di AutoCAD 2025 (2D + 3D)
> con interfaccia ribbon, command-line, workspace 3D Three.js.

Indice:
1. [Installazione e avvio](#1-installazione-e-avvio)
2. [Panoramica dell'interfaccia](#2-panoramica-dellinterfaccia)
3. [Disegno 2D](#3-disegno-2d)
4. [Modifica delle entità](#4-modifica-delle-entità)
5. [Disegno assistito (snap, ortho, polar)](#5-disegno-assistito-snap-ortho-polar)
6. [Layer e proprietà](#6-layer-e-proprietà)
7. [Workspace 3D](#7-workspace-3d)
8. [Booleani CSG](#8-booleani-csg)
9. [Sezione dinamica](#9-sezione-dinamica)
10. [Materiali e illuminazione](#10-materiali-e-illuminazione)
11. [Import / Export](#11-import--export)
12. [File di esempio](#12-file-di-esempio)
13. [Salvataggio e progetti](#13-salvataggio-e-progetti)
14. [Command line e alias](#14-command-line-e-alias)
15. [Scorciatoie da tastiera](#15-scorciatoie-da-tastiera)
16. [Risoluzione problemi](#16-risoluzione-problemi)

---

## 1. Installazione e avvio

### Requisiti
- **PHP 8.0+** con estensione `pdo_sqlite` (entrambe normalmente già presenti).
- Browser moderno con supporto a **import map** e **WebGL 2** (Chrome ≥ 89, Firefox ≥ 108, Edge, Safari ≥ 16).
- Nessun gestore di pacchetti, nessuna build, nessuna installazione Node.

### Avvio rapido
```bash
cd Autocad-clone
./start.sh
```
Lo script:
1. Verifica PHP e `pdo_sqlite`.
2. Controlla che la porta sia libera (default `127.0.0.1:8000`).
3. Avvia `php -S` nella cartella del progetto.
4. Fa uno smoke test su `index.html` e `backend/api.php`.
5. Apre il browser sull'URL.
6. Mostra log live; `Ctrl+C` per fermare.

### Avvio manuale alternativo
```bash
cd Autocad-clone
php -S 127.0.0.1:8000
```
Poi apri `http://127.0.0.1:8000/` nel browser.

### Cambiare porta
Modifica la prima riga di `start.sh` (`PORT=8000`) oppure invoca:
```bash
PORT=9090 ./start.sh
```

---

## 2. Panoramica dell'interfaccia

```
┌───────────────────────────────────────────────────────────────────┐
│ [logo] [Nuovo|Apri|Salva|Undo|Redo|Esempi]  Disegno1.wcad  [☾][⛶]│ ← title bar
├───────────────────────────────────────────────────────────────────┤
│  Home  Inserisci  Annota  Modifica  Vista  Output                 │ ← ribbon tabs
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐           │
│  │ Disegna  │ │  Modifica  │ │   Layer    │ │Proprietà│           │ ← pannelli
│  └──────────┘ └────────────┘ └────────────┘ └─────────┘           │
├──────────┬────────────────────────────────────────────┬───────────┤
│ Progetti │                                            │  Layer    │
│          │                                            │           │
│  Pr1     │           area di disegno                  │  Prop.    │
│  Pr2     │              (canvas)                      │           │
│          │                                            │           │
├──────────┴────────────────────────────────────────────┴───────────┤
│ Comando: _                                                        │ ← cmd line
│ [cronologia comandi]                                              │
├───────────────────────────────────────────────────────────────────┤
│ X 123.4  Y 56.7  | Grid Snap Ortho Polar OSnap | 2D | Layer: MURI │ ← status bar
└───────────────────────────────────────────────────────────────────┘
```

- **Title bar**: logo, quick access (Nuovo/Apri/Salva/Undo/Redo/**Esempi**), nome del disegno (clic per rinominare), pulsanti tema chiaro/scuro e schermo intero.
- **Ribbon**: 6 tab — Home, Inserisci, Annota, Modifica, Vista, Output.
- **Pannelli laterali**: progetti a sinistra, layer/proprietà a destra.
- **Area disegno**: canvas 2D oppure scena 3D (toggle).
- **Command line**: digita comandi o alias (es. `L`, `C`, `EXT`, `SEC`).
- **Status bar**: coordinate live, toggle snap/grid/ortho, modalità 2D/3D, layer attivo.

---

## 3. Disegno 2D

Tab **Home → Disegna**:

| Strumento | Comando | Uso |
|---|---|---|
| Linea | `L` | clic primo punto → clic punto finale. Continua a catena, `Esc` per chiudere. |
| Polilinea | `PL` | clic per ogni vertice, `Invio` per terminare aperta, `C` per chiudere. |
| Cerchio | `C` | clic centro → clic punto sul raggio (oppure digita raggio). |
| Arco | `A` | 3 punti: inizio, punto sull'arco, fine. |
| Rettangolo | `REC` | clic primo angolo → clic angolo opposto. |
| Ellisse | `EL` | clic centro → clic per semiasse maggiore → clic per semiasse minore. |
| Punto | `PO` | clic per posizione. |
| Testo | `T` | clic posizione, dialogo per testo e altezza. |
| Quota lineare | `DIM` | clic primo punto → clic secondo punto → clic posizione linea quota. |

### Input coordinate
Mentre uno strumento chiede un punto, puoi digitare in command-line:
- **Assolute**: `100,50` → punto (100, 50).
- **Relative**: `@30,20` → spostamento di (+30, +20) dal punto precedente.
- **Polari**: `@50<45` → distanza 50, angolo 45°.

### Esempio: disegnare un rettangolo
1. Tab Home → clic "Rettangolo" oppure digita `REC` + `Invio`.
2. Clic in canvas per il primo angolo (es. 0,0).
3. Digita `@200,100` + `Invio` per fare un rettangolo 200×100.

---

## 4. Modifica delle entità

Tab **Home → Modifica** o **Modifica**:

| Operazione | Comando | Note |
|---|---|---|
| Sposta | `M` | seleziona → base point → destination |
| Copia | `CO` | come sposta, lascia l'originale |
| Ruota | `RO` | seleziona → pivot → angolo |
| Scala | `SC` | seleziona → pivot → fattore |
| Specchio | `MI` | seleziona → asse (2 punti) → tieni originale? |
| Offset | `O` | distanza → seleziona → lato |
| Trim | `TR` | seleziona limiti → clic su porzioni da tagliare |
| Estendi | `EX` | seleziona limiti → clic su segmenti da estendere |
| Raccordo | `F` | raggio → 2 linee |
| Cancella | `E` / `Canc` | seleziona → conferma |

### Selezione
- Clic singolo sull'entità.
- Drag finestra **da sinistra a destra**: window selection (solo entità completamente dentro).
- Drag finestra **da destra a sinistra**: crossing selection (anche entità che la attraversano).
- `Shift+clic` per aggiungere alla selezione.
- `Ctrl+A` seleziona tutto.

### Grip-edit
Con un'entità selezionata e tool **Select** attivo, appariscono i **grip** (quadratini blu): clic-drag per spostare/ridimensionare direttamente.

---

## 5. Disegno assistito (snap, ortho, polar)

### Toggle nella status bar
- **Grid** (`F7`): mostra griglia.
- **Snap** (`F9`): snap a griglia (cursore "scatta" sui nodi).
- **Ortho** (`F8`): forza movimenti orizzontali/verticali.
- **Polar** (`F10`): snap angolare a multipli (default 45°).
- **OSnap** (`F3`): snap a punti notevoli delle entità.
- **LWT**: mostra spessori di linea reali.

### Tipi di OSnap attivi
- **Endpoint** (estremo) — segmenti, archi.
- **Midpoint** (mediano) — punto centrale di un segmento.
- **Center** (centro) — centro di cerchi/archi/ellissi.
- **Intersection** (intersezione) — punto comune tra due entità.
- **Perpendicular** (perpendicolare) — proietta perpendicolarmente.
- **Quadrant** (quadrante) — 0°/90°/180°/270° su cerchi/ellissi.
- **Tangent** — verrà aggiunto nelle future release.

Marker colorati come AutoCAD (giallo, verde, rosso ecc.).

---

## 6. Layer e proprietà

### Pannello Layer (a destra)
- Combo "Layer corrente" — tutte le entità nuove vanno qui.
- Lista con: icona occhio (visibilità), icona lucchetto (blocco), colore, nome.
- `+` per nuovo layer (Modal "Nome").
- `×` per eliminare un layer (le entità vengono spostate sul layer `0`).

### Proprietà
- **Colore**: cliccabile, ridefinisce il colore dell'entità o lascialo `BYLAYER`.
- **Tipo linea**: continuous, dashed, dotted, dashdot…
- **Spessore (LWT)**: in mm.

Layer di default in un nuovo disegno: `0` (bianco/nero in base al tema).

---

## 7. Workspace 3D

### Attivare il 3D
- **Tab Vista → "Workspace 3D"** oppure comando `3D`.
- La prima volta carica Three.js dal vendor locale (lazy load, ~1 sec).
- Il workspace 3D mostra la scena con orbit camera, griglia, assi colorati (rosso=X, verde=Y, blu=Z).

### Controlli 3D
- **Tasto sinistro mouse**: ruota orbita.
- **Tasto medio o destro**: pan.
- **Rotella**: zoom.
- **ViewCube** (top-right): clic su una faccia per saltare alla vista.
- **Pulsanti vista**: Top, Front, Right, Iso.
- `3D` di nuovo per tornare al 2D.

### Estrusione 2D → 3D
1. In 2D, seleziona una **entità chiusa** (cerchio, rettangolo, polilinea chiusa, ellisse).
2. Tab Vista → "Estrudi" oppure comando `EXT`.
3. Dialogo: inserisci altezza.
4. Il solido appare nello workspace 3D (passa automaticamente).

### Primitive 3D
Tab Vista → pannello **Primitive 3D**, oppure comandi: `BOX`, `SPHERE`, `CYL`, `CONE`, `TORUS`, `PYR`.
Si apre un dialogo per i parametri (raggi, altezze, dimensioni).

### Rivoluzione
1. Disegna una **polilinea aperta** che rappresenti il profilo (mezza sezione).
2. Selezionala.
3. Comando `REV` o pulsante "Rivoluzione".
4. Scegli asse (X o Y) e angolo (1° – 360°).
5. Il solido di rivoluzione viene generato (LatheGeometry).

### Selezione 3D
- Clic sui solidi nella scena 3D per selezionarli.
- `Shift+clic` per aggiungere alla selezione.
- `Canc` per eliminare i solidi selezionati.

---

## 8. Booleani CSG

Operazioni booleane su solidi 3D (Constructive Solid Geometry), basate su `three-bvh-csg`.

### Procedura
1. Crea/seleziona **due o più** solidi 3D nella scena.
2. Comando o pulsante:
   - **Unione** (`UNION` / `UNI`): somma dei volumi.
   - **Sottrazione** (`SUB` / `DIFF`): A meno B (l'ordine è quello di selezione).
   - **Intersezione** (`INT`): solo le parti in comune.
3. I solidi sorgenti vengono **rimossi**; viene creata una nuova mesh `csg-mesh`.

### Pipeline su più solidi
Se selezioni più di due solidi, l'operazione viene applicata a catena: `((A op B) op C) op D…`.

### Limiti
- CSG con `three-bvh-csg` è affidabile su geometrie chiuse e manifold.
- I solidi `wireframe` non danno risultati validi (usa il preset PBR/Phong/Flat prima del CSG).
- Operazioni su mesh molto dense (>100k triangoli) possono richiedere qualche secondo.

---

## 9. Sezione dinamica

Permette di "tagliare" la scena 3D con un piano per vedere all'interno dei solidi.

Tab Vista → pannello **Sezione dinamica**:

| Controllo | Funzione |
|---|---|
| ☐ Sezione attiva | Abilita/disabilita il taglio. |
| Asse `X|Y|Z` | Direzione del piano di taglio. |
| Slider Pos. | Sposta il piano lungo l'asse (−100 … +100). |
| Flip | Inverte il lato visibile. |

Quando attiva, un quad arancione semitrasparente indica la posizione del piano. Tutti i solidi vengono tagliati in tempo reale.

Comando CLI: `SEC` / `SECTION` / `SEZIONE`.

---

## 10. Materiali e illuminazione

Tab Vista → pannello **Materiali & Luci**.

### Preset materiale
- **PBR** (Standard) — fisicamente plausibile, default. Usa `MeshStandardMaterial`.
- **Phong** — lucido, con riflessi speculari. Adatto a metalli/plastica.
- **Flat** — nessuna illuminazione, colore piatto. Utile per stile cartoon o anteprime veloci.
- **Wireframe** — solo le edge della mesh. Utile per controllare la topologia.

### Preset illuminazione
- **Studio** — ambient bilanciato + key light bianco + fill blu (default).
- **Outdoor** — luce solare calda intensa, ambient più basso.
- **Minimal** — solo ambient bianco, niente direzionale: tutto piatto e uniforme.

### Controlli aggiuntivi
- Slider **Sole**: intensità della key light (0 – 3).
- Checkbox **Ombre**: abilita/disabilita le ombre PCF.

---

## 11. Import / Export

### Export 2D (tab Output → Esporta)
- **PNG** — bitmap del canvas alla risoluzione corrente.
- **SVG** — vettoriale, scalabile.
- **DXF** — R2000 (LINE, LWPOLYLINE, CIRCLE, ARC, ELLIPSE, POINT, TEXT), compatibile con AutoCAD/QCAD/LibreCAD.

### Import DXF
Disponibile attraverso il caricamento di un esempio DXF, oppure via API/incolla testo (può essere collegato a un file picker in futuro).

### Export 3D (tab Vista → Esporta 3D)
- **STL** binary — formato standard per stampa 3D / slicer.
- **OBJ** — universale, supporto in tutti i tool 3D.
- **glTF** — formato moderno per il web (JSON `.gltf`).

Comandi CLI: `STL`, `OBJ`, `GLTF`, `GLB`.

Esporta solo i **solidi 3D** del documento; le entità 2D devono prima essere estruse o convertite.

---

## 12. File di esempio

In `samples/`:

| File | Tipo | Cosa mostra |
|---|---|---|
| `01-planimetria.json` | doc nativo | Pianta appartamento con muri, infissi, arredo, quote |
| `02-meccanica-3d.json` | doc nativo | Componenti meccanici (base + cilindri + sfera + toro) |
| `03-vaso-rivoluzione.json` | doc nativo | Profilo + solido di rivoluzione |
| `04-elementi-base.dxf` | DXF | Elementi base importabili (linee, cerchi, polyline, testo) |

### Aprire un esempio
1. Clic sul pulsante **Esempi** in quick-access (header) **o** comando `SAMPLE`.
2. Dialogo con i 4 file: scegli e conferma.
3. Per i `.json` viene caricato come nuovo disegno.
4. Per il `.dxf` le entità vengono **importate** nel disegno corrente.

---

## 13. Salvataggio e progetti

### Salva (`Ctrl+S` o `SAVE`)
- Prima volta: dialogo per nome → salva nel SQLite locale (server).
- Successive: aggiorna in place.

### Apri (`Ctrl+O` o `OPEN`)
- Mostra l'elenco progetti nel pannello laterale sinistro.
- Clic per caricare; `×` per eliminare.

### Rinomina (`RENAME` o clic sul titolo `Disegno1.wcad`)
Dialogo che propaga il nuovo nome al server.

### Nuovo (`Ctrl+N` o `NEW`)
Crea un nuovo disegno vuoto; chiede conferma se ci sono modifiche non salvate.

### Autosave (locale)
- Ogni modifica → debounce 800 ms → `localStorage["webcad.autosave"]`.
- Al boot, se trova una bozza non vuota, chiede se ripristinarla.
- È una **rete di sicurezza** se chiudi il tab senza salvare.
- Pulita automaticamente con "Nuovo" o "Scarta".

---

## 14. Command line e alias

Tutti i comandi sono digitabili (case-insensitive). `Invio` esegue, `↑/↓` cronologia, `Esc` annulla tool in corso.

### Disegno
| Alias | Comando |
|---|---|
| `L` `LINE` `LINEA` | Linea |
| `PL` `POLYLINE` `POLILINEA` | Polilinea |
| `C` `CIRCLE` `CERCHIO` | Cerchio |
| `A` `ARC` `ARCO` | Arco |
| `REC` `RECT` `RETT` | Rettangolo |
| `EL` `ELLIPSE` `ELLISSE` | Ellisse |
| `PO` `POINT` `PUNTO` | Punto |
| `T` `TEXT` `TESTO` | Testo |
| `DIM` `QUOTA` | Dimensione lineare |

### Modifica
| Alias | Comando |
|---|---|
| `M` `MOVE` `SPOSTA` | Sposta |
| `CO` `CP` `COPY` `COPIA` | Copia |
| `RO` `ROTATE` `RUOTA` | Ruota |
| `SC` `SCALE` `SCALA` | Scala |
| `MI` `MIRROR` `SPECCHIO` | Specchio |
| `O` `OFFSET` | Offset |
| `TR` `TRIM` | Trim |
| `EX` `EXTEND` `ESTENDI` | Estendi |
| `F` `FILLET` `RACCORDO` | Raccordo |
| `E` `ERASE` `CANC` `CANCELLA` `DELETE` | Cancella |

### Generali
| Alias | Comando |
|---|---|
| `U` `UNDO` `ANNULLA` | Annulla |
| `RE` `REDO` `RIPETI` | Ripeti |
| `Z` `ZOOM` | Zoom estensione |
| `S` `SELECT` `SELEZIONA` | Tool selezione |
| `LA` `LAYER` | Nuovo layer |
| `SAVE` `SALVA` | Salva progetto |
| `RENAME` `RN` `RINOMINA` | Rinomina progetto |
| `OPEN` `APRI` | Mostra progetti |
| `NEW` `NUOVO` | Nuovo disegno |
| `CL` `CLEAR` | Pulisci cronologia comandi |

### Export
| Alias | Comando |
|---|---|
| `EXP` `EXPORT` | Export PNG |
| `DXF` | Export DXF |
| `SVG` | Export SVG |
| `STL` | Export 3D STL |
| `OBJ` | Export 3D OBJ |
| `GLTF` `GLB` | Export 3D glTF |

### 3D
| Alias | Comando |
|---|---|
| `3D` `WORKSPACE3D` | Toggle workspace 3D |
| `EXT` `EXTRUDE` `ESTRUDI` | Estrudi entità 2D selezionate |
| `BOX` `CUBO` | Primitiva box |
| `SPHERE` `SFERA` | Primitiva sfera |
| `CYL` `CYLINDER` `CILINDRO` | Primitiva cilindro |
| `CONE` `CONO` | Primitiva cono |
| `TORUS` `TORO` | Primitiva toro |
| `PYR` `PYRAMID` `PIRAMIDE` | Primitiva piramide |
| `REV` `REVOLVE` `RIVOLUZIONE` | Rivoluzione |
| `UNION` `UNI` `UNIONE` | CSG Unione |
| `SUB` `SUBTRACT` `DIFF` `SOTTRAI` | CSG Sottrazione |
| `INT` `INTERSECT` `INTERSEZIONE` | CSG Intersezione |
| `SEC` `SECTION` `SEZIONE` | Sezione dinamica |
| `SAMPLE` `SAMPLES` `ESEMPI` `ESEMPIO` | Apri file di esempio |

---

## 15. Scorciatoie da tastiera

| Tasto | Azione |
|---|---|
| `Ctrl+N` | Nuovo |
| `Ctrl+O` | Apri progetti |
| `Ctrl+S` | Salva |
| `Ctrl+Z` | Annulla |
| `Ctrl+Y` o `Ctrl+Shift+Z` | Ripeti |
| `Ctrl+A` | Seleziona tutto |
| `Canc` | Cancella selezione |
| `Esc` | Annulla comando corrente |
| `F3` | Toggle OSnap |
| `F7` | Toggle griglia |
| `F8` | Toggle ortho |
| `F9` | Toggle snap a griglia |
| `F10` | Toggle polar |
| `Tasto medio mouse` | Pan |
| `Rotella mouse` | Zoom in/out |

---

## 16. Risoluzione problemi

### "Non si carica niente, schermo bianco"
- Apri DevTools (`F12`) → Console: cerca errori rossi.
- Se vedi `Failed to resolve module specifier "three"`: la `<script type="importmap">` non viene letta. Browser troppo vecchio o sintassi rotta in `index.html`.
- Verifica che il server PHP stia girando: `curl http://127.0.0.1:8000/`.

### "Workspace 3D non si attiva"
- Apri Console: cerca errori sui file `vendor/three/*.js`.
- Verifica che la cartella `vendor/` sia stata copiata insieme al progetto.
- WebGL deve essere abilitato (vai su `chrome://gpu` o equivalente).

### "I solidi 3D non si vedono dopo un undo"
Bug noto e corretto: la nuova `History` ripristina anche `doc.solids` e sincronizza la scena 3D. Se ti capita, ricarica la pagina (`F5`) — l'autosave restaura lo stato.

### "I controlli da tastiera non funzionano"
- Probabilmente il focus è sul command-line input. Clicca sul canvas per riportare il focus.
- I tasti F3/F7/F8/F9/F10 e gli `Ctrl+...` sono registrati a livello `window`, quindi funzionano comunque.

### "L'export STL/OBJ/glTF dice 'Nessun solido'"
Stai esportando da workspace 3D **senza** solidi nel documento. Crea almeno un'estrusione, primitiva o rivoluzione prima di esportare.

### "Errore CSG: Mesh non manifold"
La libreria CSG vuole geometrie chiuse senza buchi. Evita di applicare CSG su risultati `wireframe` o su mesh importate da glTF/OBJ esterni. Per fare boolean su primitive native il problema non si presenta.

### "L'autosave non si attiva"
- Controlla in DevTools → Application → Local Storage: deve esserci la chiave `webcad.autosave`.
- Se il browser è in modalità anonima e blocchi i localStorage, l'autosave non funziona; ma puoi sempre salvare via `Ctrl+S` (server SQLite).

### "Voglio spostare il progetto su un altro PC"
1. Copia la cartella `Autocad-clone/` ovunque.
2. Su quel PC: `./start.sh`.
3. Lo stato locale (autosave) **non** si trasferisce (è in localStorage del browser). I progetti sul server SQLite sì se copi `data/webcad.db`.

---

## Appendice: architettura in sintesi

```
Autocad-clone/
├── index.html              <- importmap + ribbon + canvas + script tags
├── css/style.css           <- temi scuro/chiaro
├── start.sh                <- launcher con checks
├── README.md               <- panoramica
├── CLAUDE.md               <- istruzioni per Claude Code
├── USER_GUIDE.md           <- questo file
├── js/
│   ├── core/    utils, geom, camera, renderer, snap, history, layer, document, app
│   ├── entities/ line, polyline, circle, arc, rectangle, ellipse, point, text, dimension
│   ├── tools/   select, draw-tools, modify-tools, 3d-tools, tool
│   ├── ui/      ui, command-line, theme
│   ├── io/      api, exporters, dxf, autosave
│   └── 3d/      scene3d, csg, exporters3d
├── vendor/      three.js + addons + three-bvh-csg + three-mesh-bvh (offline)
├── backend/     api.php, db.php (PHP REST + SQLite)
├── samples/     file di esempio JSON e DXF
└── data/        webcad.db (creato a runtime)
```

Buon disegno.
