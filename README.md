# FLA-TypeSim: Formal Language-Based Behavioral Classification

*A web-based simulation system classifying typing behavior by treating keystroke timing as a formal language problem.*

## Overview
This project presents a deterministically mathematical approach based on **Theory of Computation** to distinguish human typists from bot scripts. 

Instead of traditional black-box machine learning over raw timing heuristics, this system encodes Inter-Keystroke Intervals (IKIs) into a discrete formal alphabet: `Σ = {F, M, S, R, P, N}`. By securely translating biometric keystroke signals into a symbolic string, we use classical Finite Automata graphs to classify the underlying behavior.

### Key Features
- **Live Keystroke Capture Engine**: Measures raw milliseconds between physical keystrokes in real-time.
- **Formal Lexical Analysis**: Translates speeds to categorical symbols (e.g. `F` for Fast < 120ms, `P` for Human Pause > 700ms).
- **Automata State Machines**: 
  - **Deterministic Finite Automata (DFA)** instantly catch and flag rigid, mathematical bot routines (such as exactly 5 rapid strokes in succession).
  - **Nondeterministic Finite Automata (NFA)** with ε-transitions smoothly model the probabilistic, choppy "uncertainty" of genuine human typing flows.
- **Visual Graph Animations**: The simulation streams keystrokes through the formal graphs in real time, verifying transitions step by step.

## Running the Project Local Simulator
This is a pure client-side application. No heavy backend or package managers are required!

1. Clone the repository.
2. Open `ui/index.html` in any modern web browser.
3. Click **"Start Capture"** in the Live Capture tab and begin typing to watch the Formal Language algorithms process your behavior.

## Project Structure
```
project/
├── engine/
│   ├── dfa.js              # Core DFA routing logic
│   ├── nfa.js              # NFA evaluation and state tracking
│   └── minimizer.js        # Myhill-Nerode Table-Filling minimizer
├── input/
│   ├── keystroke-capture.js # DOM event and IKI capture
│   ├── symbol-encoder.js    # Translates IKI times into formal Σ alphabet
│   └── pattern-generator.js # Classification rule evaluator
├── ui/
│   ├── state-diagram.js    # Real-time SVG graph visualizer
│   ├── simulation.js       # Core architecture bridging engine and DOM UI
│   ├── theme.css           # UI styling
│   └── index.html          # App entrypoint
└── README.md               # You are here
```

## The Formal Alphabet $\Sigma$
| Symbol | Meaning | Timing Range |
| --- | --- | --- |
| **F** | Fast | IKI < 120 ms (Automated bursts) |
| **M** | Medium | 120–300 ms (Standard typing) |
| **S** | Slow | 300–700 ms (Deliberate typing) |
| **R** | Repetitive | Uniform identical runs |
| **P** | Pause | IKI > 700 ms (Human calculation delay) |
| **N** | Normal | Fallback/None |

## Classification Logic
By reducing continuous noisy time data to discrete characters, we are able to mathematically prove that biological typing often generates an irregular context-free language (employing distinct symmetrical properties like pauses), whereas programmatic bot typing tends heavily towards strict Regular languages mapping perfectly to isolated Deterministic Finite Automata models.
