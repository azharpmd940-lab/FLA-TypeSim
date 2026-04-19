/**
 * input/pattern-generator.js
 * Generates test patterns for simulation and demo modes
 */

class PatternGenerator {
  constructor() {
    this.ALPHABET = ['F', 'M', 'S', 'R', 'P', 'N'];
  }

  /** Generate a deterministic bot pattern: exactly 5 F's */
  botPattern_ExactFiveF() {
    return { symbols: ['F', 'F', 'F', 'F', 'F'], label: 'Bot: 5×F', type: 'bot' };
  }

  /** Generate a bot pattern: long repetitive R sequence */
  botPattern_Repetitive(length = 8) {
    return { symbols: Array(length).fill('R'), label: `Bot: ${length}×R`, type: 'bot' };
  }

  /** Generate a bot pattern: alternating uniform F/M */
  botPattern_Alternating(length = 10) {
    const syms = Array.from({ length }, (_, i) => i % 2 === 0 ? 'F' : 'M');
    return { symbols: syms, label: 'Bot: FM alternating', type: 'bot' };
  }

  /** Generate human pattern: varied symbols with pauses */
  humanPattern_Natural() {
    return {
      symbols: ['F', 'M', 'F', 'S', 'P', 'M', 'F', 'F', 'M', 'P', 'S', 'M'],
      label: 'Human: Natural Rhythm', type: 'human'
    };
  }

  /** Generate human pattern: burst then recovery */
  humanPattern_BurstRecovery() {
    return {
      symbols: ['F', 'F', 'F', 'M', 'S', 'P', 'M', 'F', 'M'],
      label: 'Human: Burst→Recovery', type: 'human'
    };
  }

  /** Generate human pattern: thinking pauses */
  humanPattern_ThinkPause() {
    return {
      symbols: ['M', 'F', 'M', 'P', 'P', 'S', 'F', 'M', 'P', 'F'],
      label: 'Human: Think-Pause', type: 'human'
    };
  }



  /** Random bot pattern (deterministic seed) */
  randomBot(length = 12) {
    const choices = ['F', 'F', 'F', 'M', 'R', 'R'];
    return {
      symbols: Array.from({ length }, (_, i) => choices[i % choices.length]),
      label: 'Bot: Cyclic Pattern', type: 'bot'
    };
  }

  /** Random human-like pattern */
  randomHuman(length = 15) {
    const probs = [
      { sym: 'F', weight: 20 }, { sym: 'M', weight: 35 },
      { sym: 'S', weight: 25 }, { sym: 'P', weight: 15 },
      { sym: 'R', weight: 3 },  { sym: 'N', weight: 2 }
    ];
    const symbols = [];
    for (let i = 0; i < length; i++) {
      const r = Math.random() * 100;
      let acc = 0;
      for (const { sym, weight } of probs) {
        acc += weight;
        if (r < acc) { symbols.push(sym); break; }
      }
    }
    return { symbols, label: 'Human: Stochastic', type: 'human' };
  }

  /** All preset patterns */
  getAllPresets() {
    return [
      this.botPattern_ExactFiveF(),
      this.botPattern_Repetitive(6),
      this.botPattern_Alternating(10),
      this.humanPattern_Natural(),
      this.humanPattern_BurstRecovery(),
      this.humanPattern_ThinkPause()
    ];
  }

  /**
   * Behavioral classifier: score a symbol sequence
   * Returns { score (0=bot, 1=human), confidence, reasons }
   */
  classify(symbols) {
    const reasons = [];
    let botScore = 0, humanScore = 0;

    // Feature 1: Coefficient of variation of symbol distribution
    const freq = {};
    for (const s of symbols) freq[s] = (freq[s] || 0) + 1;
    const counts = Object.values(freq);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const cv = Math.sqrt(variance) / (mean || 1);

    if (cv < 0.3) {
      botScore += 30;
      reasons.push({ type: 'bot', msg: `Low symbol diversity (CV=${cv.toFixed(2)}) — uniform distribution` });
    } else {
      humanScore += 20;
      reasons.push({ type: 'human', msg: `Varied symbol distribution (CV=${cv.toFixed(2)})` });
    }

    // Feature 2: Presence of Pauses
    const pauseCount = symbols.filter(s => s === 'P').length;
    const pauseRatio = pauseCount / symbols.length;
    if (pauseRatio > 0.05) {
      humanScore += 25;
      reasons.push({ type: 'human', msg: `Contains ${pauseCount} pause(s) (${(pauseRatio * 100).toFixed(0)}%) — natural think-pauses` });
    } else {
      botScore += 20;
      reasons.push({ type: 'bot', msg: 'No or few pauses — machines don\'t need to think' });
    }

    // Feature 3: Repetitive symbols
    const repCount = symbols.filter(s => s === 'R').length;
    const repRatio = repCount / symbols.length;
    if (repRatio > 0.3) {
      botScore += 25;
      reasons.push({ type: 'bot', msg: `High repetition ratio (${(repRatio * 100).toFixed(0)}%) — scripted/loop pattern` });
    }

    // Feature 4: Max run length
    let maxRun = 1, curRun = 1;
    for (let i = 1; i < symbols.length; i++) {
      if (symbols[i] === symbols[i - 1]) curRun++;
      else { maxRun = Math.max(maxRun, curRun); curRun = 1; }
    }
    maxRun = Math.max(maxRun, curRun);
    if (maxRun >= 5) {
      botScore += 25;
      reasons.push({ type: 'bot', msg: `Long run of ${maxRun} identical symbols — mechanical repetition` });
    } else {
      humanScore += 15;
      reasons.push({ type: 'human', msg: `Max run length ${maxRun} — within human range` });
    }

    // Feature 5: F-start domination
    const fRatio = (freq['F'] || 0) / symbols.length;
    if (fRatio > 0.7) {
      botScore += 15;
      reasons.push({ type: 'bot', msg: `Extremely high Fast-stroke ratio (${(fRatio * 100).toFixed(0)}%)` });
    }

    const total = botScore + humanScore || 1;
    const humanPct = humanScore / total;

    return {
      verdict: humanPct >= 0.5 ? 'HUMAN' : 'BOT',
      confidence: Math.abs(humanPct - 0.5) * 2,
      humanScore,
      botScore,
      humanPercent: (humanPct * 100).toFixed(1),
      botPercent: ((1 - humanPct) * 100).toFixed(1),
      reasons,
      symbolCount: symbols.length
    };
  }
}

if (typeof module !== 'undefined') module.exports = { PatternGenerator };
