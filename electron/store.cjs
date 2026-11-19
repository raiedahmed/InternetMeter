const fs = require('fs');
const path = require('path');

const DEFAULTS = () => ({
  version: 1,
  settings: { quotaGB: 200, cycleDay: 1, alerts: [50, 80, 95], autoStart: false, configured: false },
  daily: {},
  counters: { boot: 0, adapters: {} },
  alerted: { cycle: '', levels: [] },
});

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'data.json');
    this.state = DEFAULTS();
    this.dirty = false;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const d = DEFAULTS();
      this.state = { ...d, ...raw, settings: { ...d.settings, ...raw.settings } };
    } catch { /* أول تشغيل أو ملف تالف */ }
  }

  add(key, down, up) {
    if (!down && !up) return;
    const rec = (this.state.daily[key] ||= { d: 0, u: 0 });
    rec.d += down;
    rec.u += up;
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      fs.renameSync(tmp, this.file); // كتابة آمنة لتجنب تلف الملف
      this.dirty = false;
    } catch (e) { console.error('save failed', e); }
  }

  touch() { this.dirty = true; }
}

module.exports = { Store };
