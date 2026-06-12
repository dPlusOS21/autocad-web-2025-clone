/* Classe base Tool — riceve eventi dall'app */
class Tool {
  constructor(app) {
    this.app = app;
  }
  get doc()    { return this.app.doc; }
  get camera() { return this.app.camera; }
  prompt(msg)  { this.app.cli.prompt(msg); }
  echo(msg, cls = 'echo') { this.app.cli.echo(msg, cls); }

  activate() {}
  deactivate() {}
  onLeftClick(worldPt, snapInfo, evt) {}
  onRightClick(worldPt, evt) { this.cancel(); }
  onMove(worldPt, snapInfo, evt) {}
  onKey(evt) {
    if (evt.key === 'Escape') this.cancel();
    else if (evt.key === 'Enter' || evt.key === ' ') this.confirm();
  }
  onCommandInput(text) { return false; }
  confirm() {}
  cancel() {
    this.app.setTool('select');
    this.app.render();
  }
}
