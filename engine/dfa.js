/**
 * engine/dfa.js
 * Deterministic Finite Automaton Engine
 * Formal Definition: M = (Q, Σ, δ, q0, F)
 */

class DFA {
  /**
   * @param {string[]} states - Q: finite set of states
   * @param {string[]} alphabet - Σ: finite input alphabet
   * @param {Object} transitions - δ: Q × Σ → Q (transition function)
   * @param {string} startState - q0: initial state
   * @param {string[]} acceptStates - F ⊆ Q: set of accept states
   * @param {string} name - Descriptive name
   * @param {string} description - What this DFA detects
   */
  constructor(states, alphabet, transitions, startState, acceptStates, name = 'DFA', description = '') {
    this.states = states;
    this.alphabet = alphabet;
    this.transitions = transitions; // { 'state': { 'symbol': 'nextState' } }
    this.startState = startState;
    this.acceptStates = new Set(acceptStates);
    this.name = name;
    this.description = description;

    this.currentState = startState;
    this.inputHistory = [];
    this.stateHistory = [startState];
    this.transitionLog = [];

    this._validate();
  }

  _validate() {
    if (!this.states.includes(this.startState)) {
      throw new Error(`Start state '${this.startState}' not in states`);
    }
    for (const s of this.acceptStates) {
      if (!this.states.includes(s)) {
        throw new Error(`Accept state '${s}' not in states`);
      }
    }
  }

  /** Reset to initial configuration */
  reset() {
    this.currentState = this.startState;
    this.inputHistory = [];
    this.stateHistory = [this.startState];
    this.transitionLog = [];
  }

  /**
   * Process a single symbol
   * @returns {{ from, symbol, to, accepted }}
   */
  step(symbol) {
    if (!this.alphabet.includes(symbol)) {
      const entry = { from: this.currentState, symbol, to: null, accepted: false, error: `Symbol '${symbol}' not in alphabet` };
      this.transitionLog.push(entry);
      return entry;
    }

    const stateTransitions = this.transitions[this.currentState] || {};
    const nextState = stateTransitions[symbol] || stateTransitions['*'] || null;

    // Dead state handling
    const to = nextState || (this.states.includes('dead') ? 'dead' : null);

    const entry = {
      from: this.currentState,
      symbol,
      to,
      accepted: to ? this.acceptStates.has(to) : false,
      step: this.inputHistory.length
    };

    this.inputHistory.push(symbol);
    this.transitionLog.push(entry);

    this.currentState = to;
    if (to) {
      this.stateHistory.push(to);
    }

    return entry;
  }

  /**
   * Process an entire string
   * @param {string[]} symbols - array of symbols
   * @returns {{ accepted, trace, finalState }}
   */
  run(symbols) {
    this.reset();
    const trace = [];
    for (const sym of symbols) {
      trace.push(this.step(sym));
    }
    return {
      accepted: this.acceptStates.has(this.currentState),
      finalState: this.currentState,
      trace,
      inputString: symbols.join(''),
      stateHistory: [...this.stateHistory]
    };
  }

  /** Get full transition table as 2D array */
  getTransitionTable() {
    return this.states.map(state => {
      const row = { state, isStart: state === this.startState, isAccept: this.acceptStates.has(state) };
      for (const sym of this.alphabet) {
        row[sym] = (this.transitions[state] || {})[sym] || (this.states.includes('dead') ? 'dead' : '—');
      }
      return row;
    });
  }

  isAccepting() {
    return this.acceptStates.has(this.currentState);
  }

  serialize() {
    return {
      name: this.name,
      description: this.description,
      states: this.states,
      alphabet: this.alphabet,
      transitions: this.transitions,
      startState: this.startState,
      acceptStates: [...this.acceptStates]
    };
  }
}

// ─────────────────────────────────────────────
// Pre-built DFAs for typing pattern detection
// ─────────────────────────────────────────────

/**
 * BOT_DFA_1: Detects exactly 5 consecutive Fast ('F') keystrokes
 * Language: L = { F^5 }
 * States: q0→q1→q2→q3→q4→q5(accept), dead on any deviation
 */
function createBotDFA_ExactFiveF() {
  const states = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'dead'];
  const alphabet = ['F', 'M', 'S', 'R', 'P', 'N'];

  const transitions = {};
  const nonF = ['M', 'S', 'R', 'P', 'N'];

  // Build transitions for q0..q4: F → next, others → dead
  for (let i = 0; i <= 4; i++) {
    const q = `q${i}`;
    transitions[q] = { F: `q${i + 1}` };
    for (const sym of nonF) transitions[q][sym] = 'dead';
  }
  // q5 (accept): anything → dead
  transitions['q5'] = {};
  for (const sym of alphabet) transitions['q5'][sym] = 'dead';
  // dead → dead
  transitions['dead'] = {};
  for (const sym of alphabet) transitions['dead'][sym] = 'dead';

  return new DFA(
    states, alphabet, transitions, 'q0', ['q5'],
    'Bot DFA — Exact 5F',
    'Accepts strings of exactly 5 consecutive Fast keystrokes. Rigid periodic bot pattern.'
  );
}

/**
 * BOT_DFA_2: Detects repetitive uniform sequences (R symbol stream)
 * Language: Strings over {R} with length ≥ 3
 */
function createBotDFA_Repetitive() {
  const states = ['q0', 'q1', 'q2', 'q3', 'dead'];
  const alphabet = ['F', 'M', 'S', 'R', 'P', 'N'];
  const nonR = ['F', 'M', 'S', 'P', 'N'];

  const transitions = {
    q0: { R: 'q1' },
    q1: { R: 'q2' },
    q2: { R: 'q3' },
    q3: { R: 'q3' },
    dead: {}
  };
  for (const sym of nonR) {
    transitions.q0[sym] = 'dead';
    transitions.q1[sym] = 'dead';
    transitions.q2[sym] = 'dead';
    transitions.q3[sym] = 'dead';
    transitions.dead[sym] = 'dead';
  }
  transitions.dead['R'] = 'dead';

  return new DFA(
    states, alphabet, transitions, 'q0', ['q3'],
    'Bot DFA — Repetitive R³⁺',
    'Accepts strings of 3 or more consecutive Repetitive (R) symbols. Detects scripted/macro typing.'
  );
}

/**
 * HUMAN_DFA: Detects natural human rhythm patterns
 * Accepts strings containing at least one Pause (P) and variety (not all same symbol)
 * Simplified approximation for DFA (exact human language is non-regular)
 */
function createHumanDFA_Natural() {
  // States encode: seen_pause × seen_variety
  const states = ['start', 'hasVar', 'hasPause', 'hasBoth', 'dead'];
  const alphabet = ['F', 'M', 'S', 'R', 'P', 'N'];

  const transitions = {
    start: { F: 'hasVar', M: 'hasVar', S: 'hasVar', R: 'hasVar', N: 'hasVar', P: 'hasPause' },
    hasVar: { F: 'hasVar', M: 'hasVar', S: 'hasVar', R: 'hasVar', N: 'hasVar', P: 'hasBoth' },
    hasPause: { F: 'hasBoth', M: 'hasBoth', S: 'hasBoth', R: 'hasBoth', N: 'hasBoth', P: 'hasPause' },
    hasBoth: { F: 'hasBoth', M: 'hasBoth', S: 'hasBoth', R: 'hasBoth', N: 'hasBoth', P: 'hasBoth' },
    dead: { F: 'dead', M: 'dead', S: 'dead', R: 'dead', P: 'dead', N: 'dead' }
  };

  return new DFA(
    states, alphabet, transitions, 'start', ['hasBoth'],
    'Human DFA — Natural Rhythm',
    'Accepts strings containing at least one pause (P) and at least one non-pause symbol. Approximates natural human typing with think-pauses.'
  );
}

// Export
if (typeof module !== 'undefined') {
  module.exports = { DFA, createBotDFA_ExactFiveF, createBotDFA_Repetitive, createHumanDFA_Natural };
}
