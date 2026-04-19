/**
 * engine/minimizer.js
 * Myhill-Nerode / Table-Filling (Hopcroft) DFA Minimization
 * Reduces DFA to minimal equivalent DFA
 */

class DFAMinimizer {
  constructor(dfa) {
    this.dfa = dfa;
    this.log = []; // step-by-step log for visualization
  }

  /**
   * Table-Filling Algorithm (Mark distinguishable pairs)
   * Returns minimized DFA data
   */
  minimize() {
    const { states, alphabet, transitions, startState, acceptStates } = this.dfa;
    const F = acceptStates;
    const Q = states.filter(s => s !== 'dead' && s !== '∅');

    this.log = [];

    // Step 1: Remove unreachable states
    const reachable = this._reachableStates(Q, transitions, startState, alphabet);
    this.log.push({ phase: 'Reachability', reachable: [...reachable] });

    const reachQ = Q.filter(s => reachable.has(s));

    // Step 2: Initialize distinguishability table
    // Pairs (i,j) where i < j (lexicographic index)
    const n = reachQ.length;
    const idx = {};
    reachQ.forEach((s, i) => idx[s] = i);

    // marked[i][j] = true means states i,j are distinguishable
    const marked = Array.from({ length: n }, () => Array(n).fill(false));
    // List of pairs waiting to propagate
    const workList = [];

    // Mark accept vs non-accept pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const si = reachQ[i], sj = reachQ[j];
        if (F.has(si) !== F.has(sj)) {
          marked[i][j] = true;
          workList.push([i, j]);
          this.log.push({ phase: 'BaseCase', pair: [si, sj], reason: 'accept≠non-accept' });
        }
      }
    }

    // Propagate: if δ(si,a) and δ(sj,a) are distinguishable → (si,sj) distinguishable
    let changed = true;
    let iteration = 0;
    while (changed) {
      changed = false;
      iteration++;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (marked[i][j]) continue;
          const si = reachQ[i], sj = reachQ[j];
          for (const sym of alphabet) {
            const di = (transitions[si] || {})[sym];
            const dj = (transitions[sj] || {})[sym];
            if (!di || !dj) continue;
            const ii = idx[di], ij = idx[dj];
            if (ii === undefined || ij === undefined) continue;
            const lo = Math.min(ii, ij), hi = Math.max(ii, ij);
            if (lo !== hi && marked[lo][hi]) {
              marked[i][j] = true;
              changed = true;
              this.log.push({
                phase: 'Propagate',
                pair: [si, sj],
                via: sym,
                leadTo: [di, dj],
                iteration
              });
              break;
            }
          }
        }
      }
    }

    // Step 3: Merge indistinguishable pairs into equivalence classes
    // Union-Find
    const parent = reachQ.map((_, i) => i);
    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const union = (x, y) => { parent[find(x)] = find(y); };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (!marked[i][j]) {
          union(i, j);
          this.log.push({ phase: 'Merge', states: [reachQ[i], reachQ[j]] });
        }
      }
    }

    // Build equivalence classes
    const classMap = {};
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!classMap[root]) classMap[root] = [];
      classMap[root].push(reachQ[i]);
    }

    const classes = Object.values(classMap);
    // Name each class by its "representative" (lowest lex)
    const classLabel = (cls) => cls.sort()[0];

    const newStates = classes.map(classLabel);
    const getClass = (s) => {
      const i = idx[s];
      if (i === undefined) return null;
      return classLabel(classMap[find(i)]);
    };

    const newStart = getClass(startState);
    const newAccept = [...new Set(
      [...F].filter(s => reachable.has(s)).map(s => getClass(s)).filter(Boolean)
    )];

    const newTransitions = {};
    for (const cls of classes) {
      const rep = cls[0];
      const label = classLabel(cls);
      newTransitions[label] = {};
      for (const sym of alphabet) {
        const target = (transitions[rep] || {})[sym];
        if (target && reachable.has(target)) {
          newTransitions[label][sym] = getClass(target);
        } else {
          newTransitions[label][sym] = '∅';
        }
      }
    }

    this.log.push({
      phase: 'Result',
      originalStates: n,
      minimizedStates: newStates.length,
      reduction: `${n} → ${newStates.length} states`
    });

    // Return plain data (avoid circular dep with DFA class in browser)
    return {
      states: newStates,
      alphabet,
      transitions: newTransitions,
      startState: newStart,
      acceptStates: newAccept,
      name: `${this.dfa.name} (Minimized)`,
      description: `Myhill-Nerode minimization of '${this.dfa.name}'. ${n}→${newStates.length} states.`,
      log: this.log,
      equivalenceClasses: classes
    };
  }

  _reachableStates(states, transitions, start, alphabet) {
    const visited = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const s = queue.shift();
      for (const sym of alphabet) {
        const t = (transitions[s] || {})[sym];
        if (t && states.includes(t) && !visited.has(t)) {
          visited.add(t);
          queue.push(t);
        }
      }
    }
    return visited;
  }

  /** Get the distinguishability table for visualization */
  getTable(reachQ, marked) {
    return { states: reachQ, marked };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { DFAMinimizer };
}
