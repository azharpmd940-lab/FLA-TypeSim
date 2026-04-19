/**
 * input/symbol-encoder.js
 * Converts IKI (Inter-Keystroke Intervals) into formal symbols over Σ = {F, M, S, R, P, N}
 */

class SymbolEncoder {
  /**
   * @param {Object} thresholds - timing thresholds in ms
   */
  constructor(thresholds = {}) {
    this.thresholds = {
      fast:   thresholds.fast   || 120,   // IKI < 120ms
      medium: thresholds.medium || 300,   // 120ms ≤ IKI < 300ms
      slow:   thresholds.slow   || 700,   // 300ms ≤ IKI < 700ms
      pause:  thresholds.pause  || 700,   // IKI ≥ 700ms
      repetitiveWindow: thresholds.repetitiveWindow || 4 // consecutive same-symbol count
    };

    this.SYMBOLS = {
      F: { name: 'Fast',       color: '#00ff9d', desc: `IKI < ${this.thresholds.fast}ms` },
      M: { name: 'Medium',     color: '#ffd600', desc: `${this.thresholds.fast}ms ≤ IKI < ${this.thresholds.medium}ms` },
      S: { name: 'Slow',       color: '#ff6b35', desc: `${this.thresholds.medium}ms ≤ IKI < ${this.thresholds.pause}ms` },
      P: { name: 'Pause',      color: '#e040fb', desc: `IKI ≥ ${this.thresholds.pause}ms` },
      R: { name: 'Repetitive', color: '#40c4ff', desc: 'Consecutive repeated keystrokes' },
      N: { name: 'Normal',     color: '#b0bec5', desc: 'Default/unclassified' }
    };
  }

  /**
   * Encode a single IKI value to a symbol
   */
  encodeIKI(iki) {
    if (iki === null || iki === undefined) return null;
    if (iki < this.thresholds.fast)   return 'F';
    if (iki < this.thresholds.medium) return 'M';
    if (iki < this.thresholds.pause)  return 'S';
    return 'P';
  }

  /**
   * Encode an array of raw keystroke events into a symbol string
   * Also detects R (Repetitive) sequences
   * @param {Array} events - from KeystrokeCapture.events
   * @returns {Array} encoded symbol objects with metadata
   */
  encodeEvents(events) {
    const result = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.iki === null) continue; // skip first keystroke

      let symbol = this.encodeIKI(ev.iki);

      // Check for repetitive: if last N symbols are all the same base symbol
      const recentSymbols = result.slice(-this.thresholds.repetitiveWindow + 1).map(s => s.baseSymbol);
      const isRepetitive = recentSymbols.length >= this.thresholds.repetitiveWindow - 1 &&
                           recentSymbols.every(s => s === symbol);

      const baseSymbol = symbol;
      if (isRepetitive) symbol = 'R';

      result.push({
        symbol,
        baseSymbol,
        iki: ev.iki,
        key: ev.key,
        timestamp: ev.timestamp,
        index: i,
        meta: this.SYMBOLS[symbol]
      });
    }

    return result;
  }

  /**
   * Encode a raw IKI array (numbers) directly
   * @param {number[]} ikis
   * @returns {string[]} symbol array
   */
  encodeIKIs(ikis) {
    const symbols = ikis.map(iki => this.encodeIKI(iki));
    // Post-process for R detection
    for (let i = this.thresholds.repetitiveWindow - 1; i < symbols.length; i++) {
      const window = symbols.slice(i - this.thresholds.repetitiveWindow + 1, i + 1);
      if (window.every(s => s === window[0]) && window[0] !== 'P') {
        symbols[i] = 'R';
      }
    }
    return symbols;
  }

  /**
   * Generate a "bot-like" IKI sequence (very uniform, low variance)
   */
  generateBotIKIs(count = 20, baseInterval = 80, jitter = 5) {
    return Array.from({ length: count }, () =>
      baseInterval + (Math.random() - 0.5) * jitter
    );
  }

  /**
   * Generate a "human-like" IKI sequence (variable with pauses)
   */
  generateHumanIKIs(count = 20) {
    const result = [];
    for (let i = 0; i < count; i++) {
      // Human rhythm: mostly medium, occasional fast bursts, occasional pauses
      const r = Math.random();
      if (r < 0.15) result.push(50 + Math.random() * 60);      // Fast burst
      else if (r < 0.55) result.push(130 + Math.random() * 150); // Medium
      else if (r < 0.80) result.push(320 + Math.random() * 350); // Slow
      else result.push(750 + Math.random() * 2000);              // Pause (think)
    }
    return result;
  }

  /** Get symbol frequency distribution */
  getDistribution(symbols) {
    const dist = { F: 0, M: 0, S: 0, R: 0, P: 0, N: 0 };
    for (const s of symbols) if (dist[s] !== undefined) dist[s]++;
    const total = symbols.length || 1;
    return Object.entries(dist).map(([sym, count]) => ({
      symbol: sym,
      count,
      percent: ((count / total) * 100).toFixed(1),
      meta: this.SYMBOLS[sym]
    }));
  }
}

if (typeof module !== 'undefined') module.exports = { SymbolEncoder };
