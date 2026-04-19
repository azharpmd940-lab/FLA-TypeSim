/**
 * engine/nfa.js
 * Nondeterministic Finite Automaton Engine
 * Supports ε-transitions for "probabilistic" human pattern modeling
 */

class NFA {
  /**
   * @param {string[]} states
   * @param {string[]} alphabet - Does NOT include ε; ε is represented as ''
   * @param {Object} transitions - δ: Q × (Σ ∪ {ε}) → P(Q)
   * @param {string} startState
   * @param {string[]} acceptStates
   */
  constructor(states, alphabet, transitions, startState, acceptStates, name = 'NFA', description = '') {
    this.states = states;
    this.alphabet = alphabet;
    this.transitions = transitions; // { 'state': { 'symbol': ['s1','s2'], '': ['eps_state'] } }
    this.startState = startState;
    this.acceptStates = new Set(acceptStates);
    this.name = name;
    this.description = description;

    this.currentStates = this.epsilonClosure(new Set([this.startState]));
  }

  reset() {
    this.currentStates = this.epsilonClosure(new Set([this.startState]));
  }

  step(symbol) {
    const moved = this.move(this.currentStates, symbol);
    this.currentStates = this.epsilonClosure(moved);
    const statesArr = [...this.currentStates];
    return {
      symbol,
      to: statesArr,
      accepted: statesArr.some(s => this.acceptStates.has(s))
    };
  }

  /** Compute ε-closure of a set of states */
  epsilonClosure(stateSet) {
    const closure = new Set(stateSet);
    const stack = [...stateSet];
    while (stack.length > 0) {
      const s = stack.pop();
      const epsTargets = (this.transitions[s] || {})[''] || [];
      for (const t of epsTargets) {
        if (!closure.has(t)) {
          closure.add(t);
          stack.push(t);
        }
      }
    }
    return closure;
  }

  /** Move: set of states reachable from stateSet on symbol (without ε) */
  move(stateSet, symbol) {
    const result = new Set();
    for (const s of stateSet) {
      const targets = (this.transitions[s] || {})[symbol] || [];
      for (const t of targets) result.add(t);
    }
    return result;
  }

  /**
   * Run NFA on input string — returns all possible active state sets at each step
   * @returns {{ accepted, trace, finalStates }}
   */
  run(symbols) {
    this.reset();
    const trace = [{ step: -1, symbol: 'ε', activeStates: [...this.currentStates] }];

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      this.step(sym);
      trace.push({ step: i, symbol: sym, activeStates: [...this.currentStates] });
    }

    const finalStates = [...this.currentStates];
    const accepted = finalStates.some(s => this.acceptStates.has(s));

    return { accepted, finalStates, trace, inputString: symbols.join('') };
  }

  /**
   * Subset Construction: NFA → DFA
   * Returns a DFA object (plain data, not class instance)
   * @returns {import('./dfa.js').DFA}
   */
  toDFA() {
    const { DFA } = typeof require !== 'undefined'
      ? require('./dfa.js')
      : { DFA: window.DFA };

    const startClosure = [...this.epsilonClosure(new Set([this.startState]))].sort();
    const startLabel = startClosure.join(',') || '∅';

    const dfaStates = new Map(); // label → set
    const queue = [startClosure];
    dfaStates.set(startLabel, startClosure);

    const dfaTransitions = {};
    const dfaAccept = [];

    while (queue.length > 0) {
      const current = queue.shift();
      const label = current.sort().join(',') || '∅';
      dfaTransitions[label] = {};

      // Check if accept
      if (current.some(s => this.acceptStates.has(s))) {
        dfaAccept.push(label);
      }

      for (const sym of this.alphabet) {
        const moved = this.move(new Set(current), sym);
        const closed = [...this.epsilonClosure(moved)].sort();
        const targetLabel = closed.join(',') || '∅';

        dfaTransitions[label][sym] = targetLabel;

        if (!dfaStates.has(targetLabel)) {
          dfaStates.set(targetLabel, closed);
          queue.push(closed);
        }
      }
    }

    // Add dead state transitions for ∅
    if (!dfaTransitions['∅']) {
      dfaTransitions['∅'] = {};
      for (const sym of this.alphabet) dfaTransitions['∅'][sym] = '∅';
    }

    const allDFAStates = [...dfaStates.keys()];
    if (!allDFAStates.includes('∅')) allDFAStates.push('∅');

    return new DFA(
      allDFAStates,
      this.alphabet,
      dfaTransitions,
      startLabel,
      dfaAccept,
      `${this.name} → DFA (Subset Construction)`,
      `DFA equivalent of NFA '${this.name}' via Subset Construction algorithm`
    );
  }

  getTransitionTable() {
    return this.states.map(state => {
      const row = {
        state,
        isStart: state === this.startState,
        isAccept: this.acceptStates.has(state)
      };
      for (const sym of [...this.alphabet, 'ε']) {
        const key = sym === 'ε' ? '' : sym;
        const targets = (this.transitions[state] || {})[key] || [];
        row[sym] = targets.length ? `{${targets.join(',')}}` : '∅';
      }
      return row;
    });
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
// Pre-built NFAs
// ─────────────────────────────────────────────

/**
 * HUMAN_NFA: Models natural human typing variety
 * Language: Strings containing (F|M|S) followed eventually by P
 * Uses ε-transitions to model optional intermediate symbols
 */
function createHumanNFA_Varied() {
  const alphabet = ['F', 'M', 'S', 'R', 'P', 'N'];

  //  q0 --ε--> q1 (start counting)
  //  q0 --(F|M|S|R|N)--> q0 (loop on non-pause)
  //  q1 --(F|M|S|R|N)--> q1 (vary)
  //  q1 --P--> q2 (accept)

  const transitions = {
    q0: { '': ['q1'], F: ['q0'], M: ['q0'], S: ['q0'], R: ['q0'], N: ['q0'] },
    q1: { F: ['q1'], M: ['q1'], S: ['q1'], R: ['q1'], N: ['q1'], P: ['q2'] },
    q2: { F: ['q2'], M: ['q2'], S: ['q2'], R: ['q2'], N: ['q2'], P: ['q2'] }
  };

  return new NFA(
    ['q0', 'q1', 'q2'],
    alphabet,
    transitions,
    'q0',
    ['q2'],
    'Human NFA — Varied + Pause',
    'Accepts any string containing at least one Pause (P). Models natural human think-pause behavior.'
  );
}

/**
 * PATTERN_NFA: Models "Fast burst then Slow recovery" human pattern
 * Accepts: F+ · (M|S) · P · (any)*
 */
function createHumanNFA_BurstRecovery() {
  const alphabet = ['F', 'M', 'S', 'R', 'P', 'N'];

  const transitions = {
    q0: { F: ['q1'] },   // start: need at least one F
    q1: { F: ['q1'], M: ['q2'], S: ['q2'] }, // F+ then M or S
    q2: { P: ['q3'] },   // then a pause
    q3: { F: ['q3'], M: ['q3'], S: ['q3'], R: ['q3'], P: ['q3'], N: ['q3'] } // then anything
  };
  // Fill missing with empty
  for (const state of ['q0', 'q1', 'q2', 'q3']) {
    transitions[state] = transitions[state] || {};
    for (const sym of alphabet) {
      transitions[state][sym] = transitions[state][sym] || [];
    }
  }

  return new NFA(
    ['q0', 'q1', 'q2', 'q3'],
    alphabet,
    transitions,
    'q0',
    ['q3'],
    'Human NFA — Burst+Recovery',
    'Accepts strings matching Fast-burst → slowdown → pause → anything. Models sprint-then-think human typing.'
  );
}

if (typeof module !== 'undefined') {
  module.exports = { NFA, createHumanNFA_Varied, createHumanNFA_BurstRecovery };
}
