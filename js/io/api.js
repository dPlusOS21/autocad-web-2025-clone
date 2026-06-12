/* Client API verso backend PHP */
const Api = {
  base: 'backend/api.php',

  async list() {
    const r = await fetch(`${this.base}?action=list`);
    return r.json();
  },
  async load(id) {
    const r = await fetch(`${this.base}?action=load&id=${id}`);
    return r.json();
  },
  async save(payload) {
    const r = await fetch(`${this.base}?action=save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.json();
  },
  async rename(id, name) {
    const r = await fetch(`${this.base}?action=rename`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    return r.json();
  },
  async remove(id) {
    const r = await fetch(`${this.base}?action=delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return r.json();
  },

  /* Sample files statici nella cartella /samples (serviti come file statici dal php server) */
  samples: [
    { file: '01-planimetria.json',      label: 'Planimetria appartamento (2D)' },
    { file: '02-meccanica-3d.json',     label: 'Componenti meccanici 3D (primitive)' },
    { file: '03-vaso-rivoluzione.json', label: 'Vaso da rivoluzione (3D)' },
    { file: '04-elementi-base.dxf',     label: 'Elementi base (DXF)' },
  ],
  async loadSampleFile(fileName) {
    const r = await fetch(`samples/${fileName}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} su samples/${fileName}`);
    if (fileName.endsWith('.dxf')) return { type: 'dxf', text: await r.text() };
    return { type: 'json', json: await r.json() };
  },
};
