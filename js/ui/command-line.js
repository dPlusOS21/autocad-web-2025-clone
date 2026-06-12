/* Command line: parser comandi stile AutoCAD */
class CommandLine {
  constructor(app) {
    this.app = app;
    this.input = document.getElementById('cmdInput');
    this.promptEl = document.getElementById('cmdPrompt');
    this.history = document.getElementById('cmdHistory');
    this.cmdHistory = [];
    this.cmdHistoryIdx = -1;

    this.input.addEventListener('keydown', this._onKey.bind(this));
    /* Non rubiamo il focus al canvas: l'utente lo restituisce digitando una lettera
       (vedi App._bindEvents -> redirect typing-to-cli). */
  }
  focus() { this.input.focus(); }

  prompt(text) {
    this.promptEl.textContent = text;
  }
  echo(text, cls = 'echo') {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    this.history.appendChild(div);
    this.history.scrollTop = this.history.scrollHeight;
  }

  _onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = this.input.value.trim();
      this.input.value = '';
      if (raw === '') {
        /* Invio vuoto: ripeti ultimo comando OR confirm sullo strumento corrente */
        if (this.app.tool && typeof this.app.tool.confirm === 'function') this.app.tool.confirm();
        return;
      }
      this.echo(`Comando: ${raw}`);
      this.cmdHistory.push(raw);
      this.cmdHistoryIdx = this.cmdHistory.length;
      this._dispatch(raw);
    } else if (e.key === 'ArrowUp') {
      if (this.cmdHistory.length === 0) return;
      e.preventDefault();
      this.cmdHistoryIdx = Math.max(0, this.cmdHistoryIdx - 1);
      this.input.value = this.cmdHistory[this.cmdHistoryIdx] || '';
    } else if (e.key === 'ArrowDown') {
      if (this.cmdHistory.length === 0) return;
      e.preventDefault();
      this.cmdHistoryIdx = Math.min(this.cmdHistory.length, this.cmdHistoryIdx + 1);
      this.input.value = this.cmdHistory[this.cmdHistoryIdx] || '';
    } else if (e.key === 'Escape') {
      this.input.value = '';
      if (this.app.tool && typeof this.app.tool.cancel === 'function') this.app.tool.cancel();
    }
  }

  _dispatch(raw) {
    /* prima: lascia che lo strumento corrente intercetti l'input come parametro */
    if (this.app.tool && typeof this.app.tool.onCommandInput === 'function') {
      if (this.app.tool.onCommandInput(raw)) return;
    }
    const cmd = raw.toUpperCase();
    const alias = CommandLine.ALIASES[cmd];
    if (alias) {
      this.app.runCommand(alias);
      return;
    }
    /* coordinate dirette: x,y per posizionare cursore senza tool? -> ignoro */
    this.echo(`Comando sconosciuto: ${raw}`, 'err');
  }
}

CommandLine.ALIASES = {
  /* disegna */
  'L': 'line', 'LINE': 'line', 'LINEA': 'line',
  'PL': 'polyline', 'POLYLINE': 'polyline', 'POLILINEA': 'polyline',
  'C': 'circle', 'CIRCLE': 'circle', 'CERCHIO': 'circle',
  'A': 'arc', 'ARC': 'arc', 'ARCO': 'arc',
  'REC': 'rectangle', 'RECT': 'rectangle', 'RECTANG': 'rectangle', 'RETT': 'rectangle',
  'EL': 'ellipse', 'ELLIPSE': 'ellipse', 'ELLISSE': 'ellipse',
  'PO': 'point', 'POINT': 'point', 'PUNTO': 'point',
  'T': 'text', 'TEXT': 'text', 'TESTO': 'text',
  'DIM': 'dimension', 'DIMLINEAR': 'dimension', 'QUOTA': 'dimension',
  /* modifica */
  'M': 'move', 'MOVE': 'move', 'SPOSTA': 'move',
  'CO': 'copy', 'CP': 'copy', 'COPY': 'copy', 'COPIA': 'copy',
  'RO': 'rotate', 'ROTATE': 'rotate', 'RUOTA': 'rotate',
  'SC': 'scale', 'SCALE': 'scale', 'SCALA': 'scale',
  'MI': 'mirror', 'MIRROR': 'mirror', 'SPECCHIO': 'mirror',
  'O': 'offset', 'OFFSET': 'offset',
  'TR': 'trim', 'TRIM': 'trim',
  'EX': 'extend', 'EXTEND': 'extend', 'ESTENDI': 'extend',
  'F': 'fillet', 'FILLET': 'fillet', 'RACCORDO': 'fillet',
  'E': 'erase', 'ERASE': 'erase', 'CANC': 'erase', 'CANCELLA': 'erase', 'DELETE': 'erase',
  /* generali */
  'U': '_undo', 'UNDO': '_undo', 'ANNULLA': '_undo',
  'RE': '_redo', 'REDO': '_redo', 'RIPETI': '_redo',
  'Z': '_zoomExtents', 'ZOOM': '_zoomExtents',
  'P': '_pan', 'PAN': '_pan',
  'S': 'select', 'SELECT': 'select', 'SELEZIONA': 'select',
  'SAVE': '_save', 'SALVA': '_save',
  'RENAME': '_rename', 'RINOMINA': '_rename', 'RN': '_rename',
  'OPEN': '_open', 'APRI': '_open',
  'NEW': '_new', 'NUOVO': '_new',
  'EXP': '_exportPng', 'EXPORT': '_exportPng',
  'DXF': '_exportDxf',
  'SVG': '_exportSvg',
  'LAYER': '_openLayers', 'LA': '_openLayers',
  'CLEAR': '_clearCmd', 'CL': '_clearCmd',
  /* 3D */
  'EXT': 'extrude', 'EXTRUDE': 'extrude', 'ESTRUDI': 'extrude',
  '3D': '_toggle3D', 'WORKSPACE3D': '_toggle3D',
  'BOX': 'box', 'CUBO': 'box',
  'SPHERE': 'sphere', 'SFERA': 'sphere',
  'CYL': 'cylinder', 'CYLINDER': 'cylinder', 'CILINDRO': 'cylinder',
  'CONE': 'cone', 'CONO': 'cone',
  'TORUS': 'torus', 'TORO': 'torus',
  'PYR': 'pyramid', 'PYRAMID': 'pyramid', 'PIRAMIDE': 'pyramid',
  'UNION': 'union', 'UNI': 'union', 'UNIONE': 'union',
  'SUB': 'subtract', 'SUBTRACT': 'subtract', 'SOTTRAI': 'subtract', 'DIFF': 'subtract',
  'INT': 'intersect', 'INTERSECT': 'intersect', 'INTERSEZIONE': 'intersect',
  'REV': 'revolve', 'REVOLVE': 'revolve', 'RIVOLUZIONE': 'revolve',
  'SEC': '_section', 'SECTION': '_section', 'SEZIONE': '_section',
  'SAMPLE': '_samples', 'SAMPLES': '_samples', 'ESEMPI': '_samples', 'ESEMPIO': '_samples',
  'STL': '_exportStl', 'OBJ': '_exportObj', 'GLTF': '_exportGltf', 'GLB': '_exportGltf',
};
