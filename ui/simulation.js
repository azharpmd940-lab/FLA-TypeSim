/**
 * ui/simulation.js
 * Main simulation controller — orchestrates all modules
 */

class SimulationController {
  constructor() {
    this.encoder = new SymbolEncoder();
    this.generator = new PatternGenerator();

    this.dfaBot1 = createBotDFA_ExactFiveF();
    this.dfaBot2 = createBotDFA_Repetitive();
    this.dfaHuman = createHumanDFA_Natural();
    this.nfaHuman = createHumanNFA_Varied();

    this.capturedSymbols = [];
    this.isCapturing = false;
    this.stepDelay = 400; // ms between animation steps

    this.diagrams = {};
    this._initDiagrams();
    this._initEventListeners();
    this._renderAll();
  }

  _initDiagrams() {
    this.diagrams.bot1 = new StateDiagram('diagram-bot1', { width: 680, height: 220 });
    this.diagrams.bot2 = new StateDiagram('diagram-bot2', { width: 680, height: 220 });
    this.diagrams.human = new StateDiagram('diagram-human', { width: 680, height: 220 });
    this.diagrams.nfa = new StateDiagram('diagram-nfa', { width: 680, height: 220 });
    this.diagrams.minimized = new StateDiagram('diagram-minimized', { width: 680, height: 220 });
  }

  _renderAll() {
    this.diagrams.bot1.render(this.dfaBot1.serialize());
    this.diagrams.bot2.render(this.dfaBot2.serialize());
    this.diagrams.human.render(this.dfaHuman.serialize());
    this.diagrams.nfa.render(this.nfaHuman.serialize(), [...this.nfaHuman.currentStates]);

    // Minimized DFA
    try {
      const minimizer = new DFAMinimizer(this.dfaHuman);
      const minData = minimizer.minimize();
      this.diagrams.minimized.render(minData);
      this._renderMinimizationLog(minData.log);
    } catch (e) {
      console.warn('Minimization error:', e);
    }
  }

  _initEventListeners() {
    // Live capture area
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
      this.keystrokeCapture = new KeystrokeCapture(captureArea);
      this.keystrokeCapture.on('keystroke', (ev) => {
        if (!this.isCapturing) return;

        if (ev.iki !== null) {
          // Use encodeEvents on the full history to correctly trigger 'R' (Repetitive) sequences
          const encoded = this.encoder.encodeEvents(this.keystrokeCapture.events);
          const latest = encoded[encoded.length - 1];
          
          this.capturedSymbols.push(latest.symbol);
          this._onNewSymbol(latest.symbol, latest.iki, ev.key);
        }
      });
    }

    // Controls
    document.getElementById('btn-start-capture')?.addEventListener('click', () => this.startCapture());
    document.getElementById('btn-stop-capture')?.addEventListener('click', () => this.stopCapture());
    document.getElementById('btn-clear-capture')?.addEventListener('click', () => this.clearCapture());
    document.getElementById('btn-analyze')?.addEventListener('click', () => this.analyzeCapture());

    // Preset patterns
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.loadPreset(preset);
      });
    });

    // Replay buttons
    const replayHandler = () => {
      if (this.capturedSymbols.length > 0) {
        this._animatePlayback(this.capturedSymbols);
      }
    };
    document.getElementById('btn-replay-dfa')?.addEventListener('click', replayHandler);
    document.getElementById('btn-replay-nfa')?.addEventListener('click', replayHandler);

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  startCapture() {
    this.isCapturing = true;
    this.keystrokeCapture?.start();
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
      captureArea.focus();
      captureArea.placeholder = '▶ CAPTURING — Type here...';
      captureArea.classList.add('capturing');
    }
    document.getElementById('btn-start-capture').disabled = true;
    document.getElementById('btn-stop-capture').disabled = false;
    this._log('Capture started. Type naturally in the text area.', 'info');
  }

  stopCapture() {
    this.isCapturing = false;
    this.keystrokeCapture?.stop();
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
      captureArea.placeholder = 'Click "Start Capture" then type here...';
      captureArea.classList.remove('capturing');
    }
    document.getElementById('btn-start-capture').disabled = false;
    document.getElementById('btn-stop-capture').disabled = true;
    this._log(`Capture stopped. ${this.capturedSymbols.length} symbols collected.`, 'success');

    if (this.capturedSymbols.length > 0) this.analyzeCapture();
  }

  clearCapture() {
    this.capturedSymbols = [];
    this.keystrokeCapture?.reset();
    const captureArea = document.getElementById('capture-area');
    if (captureArea) captureArea.value = '';
    const streams = ['symbol-stream', 'dfa-symbol-stream', 'nfa-symbol-stream'];
    streams.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = id === 'symbol-stream' ? '' : '<span style="color:var(--text2); font-size:10px; font-style:italic;">No active capture.</span>';
    });
    const res = document.getElementById('live-result');
    if (res) res.innerHTML = '';
    this._toggleReplayButtons(false);
    this._log('Capture cleared.', 'warning');
  }

  _onNewSymbol(sym, iki, key) {
    // Update symbol stream display
    const streams = ['symbol-stream', 'dfa-symbol-stream', 'nfa-symbol-stream'];
    streams.forEach(id => {
      const stream = document.getElementById(id);
      if (!stream) return;
      if (stream.children.length > 0 && stream.children[0].tagName === 'SPAN' && stream.children[0].textContent.includes('No active')) {
         stream.innerHTML = '';
      }
      const chip = document.createElement('span');
      chip.className = `sym-chip sym-${sym}`;
      if (iki != null && key != null) chip.title = `Key: ${key} | IKI: ${iki.toFixed(0)}ms`;
      chip.textContent = sym;
      stream.appendChild(chip);
      stream.scrollTop = stream.scrollHeight;
    });

    this._toggleReplayButtons(true);

    // Real-time automaton animation
    this._stepAllAutomata(sym);

    // Live IKI meter
    this._updateIKIMeter(iki);
  }

  _stepAllAutomata(sym) {
    // Also light up transition table for live capture
    this._highlightTableStep('tt-bot1', this.dfaBot1.currentState, sym);
    this._highlightTableStep('tt-bot2', this.dfaBot2.currentState, sym);
    this._highlightTableStep('tt-human', this.dfaHuman.currentState, sym);

    const r1 = this.dfaBot1.step(sym);
    const r2 = this.dfaBot2.step(sym);
    const r3 = this.dfaHuman.step(sym);
    const r4 = this.nfaHuman.step(sym);

    this.diagrams.bot1.highlightState(r1.to || this.dfaBot1.currentState);
    this.diagrams.bot2.highlightState(r2.to || this.dfaBot2.currentState);
    this.diagrams.human.highlightState(r3.to || this.dfaHuman.currentState);
    this.diagrams.nfa.highlightState(r4.to || [...this.nfaHuman.currentStates]);

    // Jump to resultant row
    setTimeout(() => {
      this._highlightTableRow('tt-bot1', this.dfaBot1.currentState);
      this._highlightTableRow('tt-bot2', this.dfaBot2.currentState);
      this._highlightTableRow('tt-human', this.dfaHuman.currentState);
    }, 150); // small delay to emulate hopping
  }

  analyzeCapture() {
    if (this.capturedSymbols.length === 0) {
      this._log('No symbols to analyze. Please type in the capture area first.', 'warning');
      return;
    }

    const syms = this.capturedSymbols;
    const classification = this.generator.classify(syms);

    // Run all automata
    const res1 = this.dfaBot1.run(syms);
    const res2 = this.dfaBot2.run(syms);
    const res3 = this.dfaHuman.run(syms);
    const nfaRes = this.nfaHuman.run(syms);

    // Distribution
    const dist = this.encoder.getDistribution(syms);

    this._renderResult(classification, { res1, res2, res3, nfaRes, dist, syms });
    this._animatePlayback(syms);
  }

  loadPreset(presetName) {
    const presets = {
      'bot-5f':        ['F','F','F','F','F'],
      'bot-rep':       ['R','R','R','R','R','R'],
      'bot-alt':       ['F','M','F','M','F','M','F','M'],
      'human-nat':     ['F','M','F','S','P','M','F','F','M','P','S','M'],
      'human-burst':   ['F','F','F','M','S','P','M','F','M'],
      'human-think':   ['M','F','M','P','P','S','F','M','P','F'],
      'pl-3':          ['S','S','S','P','S','S','S'],
      'pl-4':          ['S','S','S','S','P','S','S','S','S'],
    };

    const syms = presets[presetName];
    if (!syms) return;

    this.keystrokeCapture?.reset();
    this.capturedSymbols = [...syms];
    this._renderPresetStream(syms);

    // Reset automata
    this.dfaBot1.reset(); this.dfaBot2.reset(); this.dfaHuman.reset(); this.nfaHuman.reset();
    this._renderAll();

    this.analyzeCapture();
    this._animatePlayback(syms);
    this._log(`Loaded preset: ${presetName}`, 'info');
  }

  _renderPresetStream(syms) {
    const streams = ['symbol-stream', 'dfa-symbol-stream', 'nfa-symbol-stream'];
    streams.forEach(id => {
      const stream = document.getElementById(id);
      if (!stream) return;
      stream.innerHTML = '';
      for (const sym of syms) {
        const chip = document.createElement('span');
        chip.className = `sym-chip sym-${sym}`;
        chip.textContent = sym;
        stream.appendChild(chip);
      }
    });
    this._toggleReplayButtons(true);
  }

  async _animatePlayback(syms) {
    // Reset diagrams
    this.dfaBot1.reset(); this.dfaBot2.reset(); this.dfaHuman.reset(); this.nfaHuman.reset();
    this.diagrams.bot1.render(this.dfaBot1.serialize(), this.dfaBot1.startState);
    this.diagrams.bot2.render(this.dfaBot2.serialize(), this.dfaBot2.startState);
    this.diagrams.human.render(this.dfaHuman.serialize(), this.dfaHuman.startState);
    this.diagrams.nfa.render(this.nfaHuman.serialize(), [...this.nfaHuman.currentStates]);

    // Reset Table Highlights
    this._highlightTableRow('tt-bot1', this.dfaBot1.startState);
    this._highlightTableRow('tt-bot2', this.dfaBot2.startState);
    this._highlightTableRow('tt-human', this.dfaHuman.startState);

    for (const sym of syms) {
      this._highlightTableStep('tt-bot1', this.dfaBot1.currentState, sym);
      this._highlightTableStep('tt-bot2', this.dfaBot2.currentState, sym);
      this._highlightTableStep('tt-human', this.dfaHuman.currentState, sym);

      await new Promise(r => setTimeout(r, this.stepDelay));

      const r1 = this.dfaBot1.step(sym);
      const r2 = this.dfaBot2.step(sym);
      const r3 = this.dfaHuman.step(sym);
      const r4 = this.nfaHuman.step(sym);

      this.diagrams.bot1.highlightState(this.dfaBot1.currentState);
      this.diagrams.bot2.highlightState(this.dfaBot2.currentState);
      this.diagrams.human.highlightState(this.dfaHuman.currentState);
      this.diagrams.nfa.highlightState([...this.nfaHuman.currentStates]);

      this._highlightTableRow('tt-bot1', this.dfaBot1.currentState);
      this._highlightTableRow('tt-bot2', this.dfaBot2.currentState);
      this._highlightTableRow('tt-human', this.dfaHuman.currentState);

      await new Promise(r => setTimeout(r, this.stepDelay / 2));
    }
  }

  _clearTableHighlights(containerId) {
    document.querySelectorAll(`#${containerId} .highlight-row, #${containerId} .highlight-cell`).forEach(el => {
      el.classList.remove('highlight-row', 'highlight-cell');
    });
  }

  _highlightTableStep(containerId, state, sym) {
    this._clearTableHighlights(containerId);
    const row = document.getElementById(`tr-${containerId}-${state}`);
    const cell = document.getElementById(`td-${containerId}-${state}-${sym}`);
    if (row) row.classList.add('highlight-row');
    if (cell) cell.classList.add('highlight-cell');
  }

  _highlightTableRow(containerId, state) {
    this._clearTableHighlights(containerId);
    const row = document.getElementById(`tr-${containerId}-${state}`);
    if (row) row.classList.add('highlight-row');
  }

  _renderResult(classification, { res1, res2, res3, nfaRes, dist, syms }) {
    const el = document.getElementById('live-result');
    if (!el) return;

    const verdict = classification.verdict;
    const color = verdict === 'HUMAN' ? '#00ff9d' : '#ff4444';

    el.innerHTML = `
      <div class="result-header" style="color:${color}">
        <span class="result-verdict">${verdict === 'HUMAN' ? '👤' : '🤖'} ${verdict}</span>
        <span class="result-confidence">Confidence: ${(classification.confidence * 100).toFixed(0)}%</span>
      </div>
      <div class="result-scores">
        <div class="score-bar">
          <span>Human</span>
          <div class="bar-track"><div class="bar-fill human" style="width:${classification.humanPercent}%"></div></div>
          <span>${classification.humanPercent}%</span>
        </div>
        <div class="score-bar">
          <span>Bot</span>
          <div class="bar-track"><div class="bar-fill bot" style="width:${classification.botPercent}%"></div></div>
          <span>${classification.botPercent}%</span>
        </div>
      </div>
      <div class="automata-results">
        <div class="aut-row ${res1.accepted ? 'accepted' : 'rejected'}">
          <span>Bot DFA (5×F):</span> <span>${res1.accepted ? '✓ ACCEPTED' : '✗ Rejected'}</span>
        </div>
        <div class="aut-row ${res2.accepted ? 'accepted' : 'rejected'}">
          <span>Bot DFA (R³⁺):</span> <span>${res2.accepted ? '✓ ACCEPTED' : '✗ Rejected'}</span>
        </div>
        <div class="aut-row ${res3.accepted ? 'accepted' : 'rejected'}">
          <span>Human DFA:</span> <span>${res3.accepted ? '✓ ACCEPTED' : '✗ Rejected'}</span>
        </div>
        <div class="aut-row ${nfaRes.accepted ? 'accepted' : 'rejected'}">
          <span>Human NFA:</span> <span>${nfaRes.accepted ? '✓ ACCEPTED' : '✗ Rejected'}</span>
        </div>
      </div>
      <div class="symbol-dist">
        ${dist.map(d => `
          <div class="dist-item">
            <span class="sym-chip sym-${d.symbol}">${d.symbol}</span>
            <span>${d.count} (${d.percent}%)</span>
          </div>`).join('')}
      </div>
      <div class="reason-list">
        ${classification.reasons.map(r =>
          `<div class="reason ${r.type}">▸ ${r.msg}</div>`
        ).join('')}
      </div>
    `;
  }

  _renderMinimizationLog(log) {
    const el = document.getElementById('min-log');
    if (!el || !log) return;
    const result = log.find(e => e.phase === 'Result');
    const merges = log.filter(e => e.phase === 'Merge');
    const base = log.filter(e => e.phase === 'BaseCase');
    el.innerHTML = `
      <div class="min-summary">${result ? result.reduction : ''}</div>
      <div class="min-detail">
        Base distinguishable pairs: ${base.length}<br>
        Merged pairs: ${merges.length}
      </div>
    `;
  }

  _updateIKIMeter(iki) {
    const el = document.getElementById('iki-value');
    if (el) el.textContent = `${iki.toFixed(0)}ms`;
    const sym = this.encoder.encodeIKI(iki);
    const el2 = document.getElementById('iki-sym');
    if (el2) { el2.textContent = sym; el2.className = `iki-sym sym-${sym}`; }
  }

  _log(msg, type = 'info') {
    const logEl = document.getElementById('event-log');
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(entry);
    if (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
  }

  _toggleReplayButtons(enabled) {
    const btnDFA = document.getElementById('btn-replay-dfa');
    const btnNFA = document.getElementById('btn-replay-nfa');
    if (btnDFA) btnDFA.disabled = !enabled;
    if (btnNFA) btnNFA.disabled = !enabled;
  }

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.sim = new SimulationController();
});
