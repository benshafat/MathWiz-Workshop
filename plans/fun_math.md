# List of cool number theory things to work on

## 1. Prime Factorization Trees 

Decompose any integer into its prime factors recursively and render it as a branching tree. The visual shows the "skeleton" of a number. For a visual, have the user provide a number and to the left and right display the tree of the +/-1 number, so that it's clear how nearby integers have wildly different tree shapes.

## 2. Ulam Spiral 

Place integers in a clockwise spiral on a grid, highlight the primes — and diagonal patterns mysteriously emerge. Nobody fully understands why. It's a great 2D canvas visualization with zooming, and you can overlay other sequences (twin primes, etc.). Possible visual - click on a prime and have it draw a line in diagonals so we can see the spiral pattern.

## 3. Collatz Conjecture (3n+1 Problem)

Take any positive integer. If even, halve it; if odd, triple it and add 1. Repeat. The conjecture says every starting number eventually reaches 1 — but nobody has proven it despite nearly a century of effort. Erdős famously said "mathematics is not yet ready for such problems."

Visualization ideas: Collatz Tree / Directed Graph
- Given K numbers, compute the path of each, and show where they converge on the same node.
- Another idea: Instead of tracing individual trajectories forward, render the reverse Collatz tree. Start from 1 at the root and branch outward: every node n has a child 2n (always valid), and a child (n−1)/3 if that's a positive odd integer. This produces a tree that contains every natural number exactly once (if the conjecture is true). The result looks like a massive organic root system or river delta.

The most striking version uses the "Collatz graph" layout popularized by Edmund Harriss and others: assign each node an angle based on whether the step that led to it was even (slight turn left) or odd (slight turn right), then draw segments of fixed length. The resulting plot looks like a plant or coral — completely different structures emerge for different angle parameters, and you can sweep those with a slider.

## 4. Totient Function Graph (Euler's φ) 

φ(n) counts integers ≤ n that are coprime to n. Plot it for 1–10,000 and you get a surprisingly beautiful scatter with clear structure: spikes at primes, floors at highly composite numbers. Fun to explore interactively with hover tooltips.

## 5. Continued Fraction Expansions

Any real number (π, √2, golden ratio) can be written as a nested fraction. Visualize the convergents — the rational approximations that "snap" toward the true value — as a path on a number line or Stern-Brocot tree. The golden ratio is the "hardest" to approximate, which is aesthetically lovely.

## 6. Recamán's Sequence

Start at 0. At each step, subtract n if the result is positive and not yet visited; otherwise add n. The resulting sequence has huge jumps, loops back on itself, and sounds musical when mapped to notes. Visualize as an arc diagram — it's one of the most beautiful sequences in OEIS (The On-Line Encyclopedia of Integer Sequences). 

## 7. Modular Arithmetic Webs (Multiplication Tables mod n) 

Draw points 0–n on a circle. Connect k → (k×m) mod n for a fixed multiplier m. Change m or n with a slider and watch the patterns morph from simple polygons into cardioids and nephroid curves. The cardioid at m=2, n=200 is famous.