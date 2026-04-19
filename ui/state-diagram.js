/**
 * ui/state-diagram.js
 * D3-powered SVG state diagram renderer with animation
 */

class StateDiagram {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      width: options.width || 700,
      height: options.height || 350,
      nodeRadius: options.nodeRadius || 28,
      colors: {
        node: '#1a2332',
        nodeBorder: '#00ff9d',
        nodeAccept: '#00ff9d',
        nodeStart: '#ffd600',
        nodeActive: '#ff6b35',
        nodeDead: '#444',
        edge: '#4a9eff',
        edgeActive: '#ff6b35',
        text: '#e8f4f8',
        label: '#b0c4d8',
        bg: 'transparent'
      }
    };
    this.currentState = null;
    this.animQueue = [];
  }

  /**
   * Render a DFA/NFA automaton
   * @param {Object} automaton - serialized DFA/NFA
   * @param {string} currentState - state to highlight
   */
  render(automaton, currentState = null) {
    this.automaton = automaton;
    this.currentState = currentState;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = '';
    const { states, transitions, startState, acceptStates, alphabet } = automaton;

    // Layout: position states in a line or circle
    const positions = this._layoutStates(states);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', this.options.height);
    svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    svg.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";

    // Defs: arrowhead marker
    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', `arrow-${this.containerId}`);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', '0 0, 10 3.5, 0 7');
    poly.setAttribute('fill', this.options.colors.edge);
    poly.setAttribute('id', `arrow-poly-${this.containerId}`);
    marker.appendChild(poly);
    defs.appendChild(marker);

    // Active arrow marker
    const markerA = document.createElementNS(svgNS, 'marker');
    markerA.setAttribute('id', `arrow-active-${this.containerId}`);
    markerA.setAttribute('markerWidth', '10');
    markerA.setAttribute('markerHeight', '7');
    markerA.setAttribute('refX', '9');
    markerA.setAttribute('refY', '3.5');
    markerA.setAttribute('orient', 'auto');
    const polyA = document.createElementNS(svgNS, 'polygon');
    polyA.setAttribute('points', '0 0, 10 3.5, 0 7');
    polyA.setAttribute('fill', this.options.colors.edgeActive);
    markerA.appendChild(polyA);
    defs.appendChild(markerA);

    svg.appendChild(defs);

    const edgeLayer = document.createElementNS(svgNS, 'g');
    edgeLayer.setAttribute('id', `edges-${this.containerId}`);
    const nodeLayer = document.createElementNS(svgNS, 'g');
    nodeLayer.setAttribute('id', `nodes-${this.containerId}`);

    // Build edge map: group by (from,to) pair
    const edgeMap = {};
    for (const [from, symMap] of Object.entries(transitions || {})) {
      for (const [sym, target] of Object.entries(symMap)) {
        const to = Array.isArray(target) ? target[0] : target;
        if (!to || !positions[to]) continue;
        const key = `${from}→${to}`;
        if (!edgeMap[key]) edgeMap[key] = { from, to, symbols: [] };
        edgeMap[key].symbols.push(sym === '' ? 'ε' : sym);
      }
    }

    // Draw edges
    this._activeEdge = null;
    for (const [key, edge] of Object.entries(edgeMap)) {
      const fromPos = positions[edge.from];
      const toPos = positions[edge.to];
      if (!fromPos || !toPos) continue;
      const g = this._drawEdge(svgNS, edge, fromPos, toPos, key);
      edgeLayer.appendChild(g);
    }

    // Start arrow
    if (positions[startState]) {
      const p = positions[startState];
      const arr = document.createElementNS(svgNS, 'line');
      arr.setAttribute('x1', p.x - 55);
      arr.setAttribute('y1', p.y);
      arr.setAttribute('x2', p.x - this.options.nodeRadius - 2);
      arr.setAttribute('y2', p.y);
      arr.setAttribute('stroke', this.options.colors.nodeStart);
      arr.setAttribute('stroke-width', '2');
      arr.setAttribute('marker-end', `url(#arrow-${this.containerId})`);
      edgeLayer.appendChild(arr);
      const startLabel = document.createElementNS(svgNS, 'text');
      startLabel.setAttribute('x', p.x - 58);
      startLabel.setAttribute('y', p.y - 6);
      startLabel.setAttribute('fill', this.options.colors.nodeStart);
      startLabel.setAttribute('font-size', '10');
      startLabel.textContent = 'start';
      edgeLayer.appendChild(startLabel);
    }

    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    // Draw nodes
    for (const state of states) {
      const pos = positions[state];
      if (!pos) continue;
      const isAccept = (acceptStates || []).includes(state) || (automaton.acceptStates instanceof Set && automaton.acceptStates.has(state));
      const isStart = state === startState;
      const isDead = state === 'dead' || state === '∅';
      const isActive = Array.isArray(currentState) ? currentState.includes(state) : state === currentState;

      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('id', `node-${this.containerId}-${state.replace(/[^a-zA-Z0-9]/g, '_')}`);
      g.setAttribute('class', 'state-node');
      g.style.cursor = 'pointer';

      // Outer circle (accept state = double ring)
      if (isAccept) {
        const outerCircle = document.createElementNS(svgNS, 'circle');
        outerCircle.setAttribute('cx', pos.x);
        outerCircle.setAttribute('cy', pos.y);
        outerCircle.setAttribute('r', this.options.nodeRadius + 6);
        outerCircle.setAttribute('fill', 'none');
        outerCircle.setAttribute('stroke', isActive ? this.options.colors.nodeActive : this.options.colors.nodeAccept);
        outerCircle.setAttribute('stroke-width', '2');
        outerCircle.setAttribute('opacity', isActive ? '1' : '0.8');
        g.appendChild(outerCircle);
      }

      // Main circle
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', this.options.nodeRadius);
      circle.setAttribute('fill', isActive ? '#ff6b3520' : isDead ? '#2a2a2a' : '#0d1b2a');
      circle.setAttribute('stroke',
        isActive ? this.options.colors.nodeActive :
        isStart ? this.options.colors.nodeStart :
        isAccept ? this.options.colors.nodeAccept :
        isDead ? this.options.colors.nodeDead :
        this.options.colors.nodeBorder
      );
      circle.setAttribute('stroke-width', isActive ? '3' : '2');
      if (isActive) {
        circle.setAttribute('filter', 'drop-shadow(0 0 8px #ff6b35)');
      }
      g.appendChild(circle);

      // State label
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y + 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', isActive ? this.options.colors.nodeActive : this.options.colors.text);
      text.setAttribute('font-size', state.length > 4 ? '9' : '12');
      text.setAttribute('font-weight', 'bold');
      text.textContent = state.length > 8 ? state.substring(0, 6) + '..' : state;
      g.appendChild(text);

      nodeLayer.appendChild(g);
    }

    container.appendChild(svg);
    this.svg = svg;
    this.positions = positions;
  }

  _drawEdge(svgNS, edge, fromPos, toPos, key) {
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('id', `edge-${this.containerId}-${key.replace(/[^a-zA-Z0-9]/g, '_')}`);

    const r = this.options.nodeRadius;
    const label = edge.symbols.join(',');
    const isSelf = edge.from === edge.to;

    if (isSelf) {
      // Self-loop
      const loop = document.createElementNS(svgNS, 'path');
      const lx = fromPos.x, ly = fromPos.y - r;
      const d = `M ${lx - 15} ${ly} C ${lx - 35} ${ly - 45} ${lx + 35} ${ly - 45} ${lx + 15} ${ly}`;
      loop.setAttribute('d', d);
      loop.setAttribute('fill', 'none');
      loop.setAttribute('stroke', this.options.colors.edge);
      loop.setAttribute('stroke-width', '1.5');
      loop.setAttribute('marker-end', `url(#arrow-${this.containerId})`);
      g.appendChild(loop);

      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', lx);
      t.setAttribute('y', ly - 38);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', this.options.colors.label);
      t.setAttribute('font-size', '10');
      t.textContent = label;
      g.appendChild(t);
    } else {
      // Check for reverse edge (for curve)
      const dx = toPos.x - fromPos.x, dy = toPos.y - fromPos.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len, ny = dx / len;
      const curve = 30;

      const sx = fromPos.x + (dx / len) * r + nx * 5;
      const sy = fromPos.y + (dy / len) * r + ny * 5;
      const ex = toPos.x - (dx / len) * (r + 8) + nx * 5;
      const ey = toPos.y - (dy / len) * (r + 8) + ny * 5;
      const mx = (sx + ex) / 2 + nx * curve;
      const my = (sy + ey) / 2 + ny * curve;

      const path = document.createElementNS(svgNS, 'path');
      const d = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', this.options.colors.edge);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', `url(#arrow-${this.containerId})`);
      g.appendChild(path);

      // Label at midpoint of curve
      const lx = (sx + 2 * mx + ex) / 4 + nx * 12;
      const ly = (sy + 2 * my + ey) / 4 + ny * 12;
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', lx);
      t.setAttribute('y', ly);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', this.options.colors.label);
      t.setAttribute('font-size', '10');
      t.textContent = label;
      g.appendChild(t);
    }

    return g;
  }

  _layoutStates(states) {
    const positions = {};
    const W = this.options.width;
    const H = this.options.height;
    const n = states.length;

    if (n <= 7) {
      // Horizontal line
      const spacing = Math.min((W - 100) / Math.max(n - 1, 1), 120);
      const startX = (W - spacing * (n - 1)) / 2;
      states.forEach((s, i) => {
        positions[s] = { x: startX + i * spacing, y: H / 2 };
      });
    } else {
      // Circle layout
      const cx = W / 2, cy = H / 2;
      const rx = Math.min(W, H) * 0.38;
      const ry = Math.min(W, H) * 0.32;
      states.forEach((s, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        positions[s] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
      });
    }

    return positions;
  }

  /** Animate a transition: highlight edge from→to */
  animateTransition(from, to, symbol, duration = 600) {
    this.highlightState(to);
  }

  highlightState(state) {
    if (!this.automaton) return;
    this.render(this.automaton, state);
  }
}

if (typeof module !== 'undefined') module.exports = { StateDiagram };
