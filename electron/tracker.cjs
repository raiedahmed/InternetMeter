const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// يشغّل NetTracker.exe (ETW) ويحوّل مخرجاته إلى أحداث 'rows'. الحالات:
// starting | running | noadmin | missing | error
class Tracker extends EventEmitter {
  constructor() {
    super();
    this.status = 'starting';
    this.stopped = false;
    this.buf = '';
  }

  exePath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'helper', 'NetTracker.exe')
      : path.join(__dirname, '..', 'helper', 'bin', 'NetTracker.exe');
  }

  setStatus(s, detail) {
    if (this.status === s && !detail) return;
    this.status = s;
    this.detail = detail || '';
    this.emit('status', { status: s, detail: this.detail });
  }

  start() {
    const exe = this.exePath();
    if (!fs.existsSync(exe)) return this.setStatus('missing');
    this.setStatus('starting');
    this.buf = '';
    this.ps = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    this.ps.stdout.setEncoding('utf8');
    this.ps.stdout.on('data', (c) => {
      this.buf += c;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (line) this.onLine(line);
      }
    });
    this.ps.on('error', (e) => this.setStatus('error', e.message));
    this.ps.on('exit', (code) => {
      if (this.stopped || this.status === 'noadmin') return;
      if (this.status !== 'error') this.setStatus('error', `exit ${code}`);
      setTimeout(() => !this.stopped && this.start(), 5000);
    });
  }

  onLine(line) {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.err) return this.setStatus(m.err === 'access' ? 'noadmin' : 'error', m.err);
    if (m.ready) return this.setStatus('running');
    if (m.rows) { if (this.status !== 'running') this.setStatus('running'); this.emit('rows', m.rows); }
  }

  stop() {
    this.stopped = true;
    try { this.ps.stdin.end(); } catch { /* ignore */ }
    try { this.ps.kill(); } catch { /* ignore */ }
  }
}

module.exports = { Tracker };
