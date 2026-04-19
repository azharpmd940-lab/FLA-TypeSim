/**
 * input/keystroke-capture.js
 * Real-time keystroke timing capture and event management
 */

class KeystrokeCapture {
  constructor(targetElement, options = {}) {
    this.target = targetElement;
    this.options = {
      fastThreshold: options.fastThreshold || 120,   // ms: < 120ms = Fast
      mediumThreshold: options.mediumThreshold || 300, // ms: 120-300ms = Medium
      slowThreshold: options.slowThreshold || 700,     // ms: 300-700ms = Slow
      pauseThreshold: options.pauseThreshold || 700,   // ms: > 700ms = Pause
      repetitiveWindow: options.repetitiveWindow || 5, // last N keys to check repetition
    };

    this.events = [];        // raw keystroke events
    this.lastKeyTime = null;
    this.active = false;
    this._listeners = {};

    this._boundKeydown = this._onKeydown.bind(this);
    this._boundKeyup = this._onKeyup.bind(this);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.events = [];
    this.lastKeyTime = null;
    if (this.target) {
      this.target.addEventListener('keydown', this._boundKeydown);
      this.target.addEventListener('keyup', this._boundKeyup);
    }
  }

  stop() {
    this.active = false;
    if (this.target) {
      this.target.removeEventListener('keydown', this._boundKeydown);
      this.target.removeEventListener('keyup', this._boundKeyup);
    }
  }

  reset() {
    this.events = [];
    this.lastKeyTime = null;
  }

  _onKeydown(e) {
    // Ignore modifier-only keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;

    const now = performance.now();
    const iki = this.lastKeyTime !== null ? now - this.lastKeyTime : null; // inter-keystroke interval

    const event = {
      key: e.key,
      keyCode: e.keyCode,
      timestamp: now,
      iki,              // inter-keystroke interval in ms
      type: 'keydown',
      index: this.events.length
    };

    this.events.push(event);
    this.lastKeyTime = now;
    this._emit('keystroke', event);
  }

  _onKeyup(e) {
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    // Could track dwell time here (keydown → keyup)
  }

  /** Get all IKI values (excluding first keystroke) */
  getIKIs() {
    return this.events.filter(e => e.iki !== null).map(e => e.iki);
  }

  /** Get statistics */
  getStats() {
    const ikis = this.getIKIs();
    if (ikis.length === 0) return null;

    const mean = ikis.reduce((a, b) => a + b, 0) / ikis.length;
    const variance = ikis.reduce((a, b) => a + (b - mean) ** 2, 0) / ikis.length;
    const stdDev = Math.sqrt(variance);
    const sorted = [...ikis].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return {
      count: ikis.length,
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      min: Math.min(...ikis).toFixed(2),
      max: Math.max(...ikis).toFixed(2),
      cv: (stdDev / mean).toFixed(3), // Coefficient of variation (bot has low CV)
    };
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }

  /** Export raw events as JSON */
  export() {
    return {
      events: this.events,
      stats: this.getStats(),
      capturedAt: new Date().toISOString()
    };
  }
}

if (typeof module !== 'undefined') module.exports = { KeystrokeCapture };
