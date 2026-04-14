# Prime Factorization Trees — Implementation Plan

## 1. Math Background

Every integer greater than 1 can be expressed uniquely as a product of prime numbers (the Fundamental Theorem of Arithmetic). To decompose a number, divide it repeatedly by its smallest prime factor until what remains is itself prime. Each division step is one branch in the tree:

```
12 = 2 × 6
          6 = 2 × 3
```

So 12's tree is: root 12, left child 2 (prime leaf), right child 6, which itself has children 2 and 3.

**Why do nearby integers have wildly different trees?**

The factorization of n and n±1 share no common prime factors — consecutive integers are always coprime. This means the tree shape is determined by an entirely independent set of primes. A highly composite number like 360 = 2³ × 3² × 5 produces a wide, bushy tree; its neighbor 361 = 19² is a slim two-node tree; and 362 = 2 × 181 is almost flat (one split, both leaves prime). This stark contrast is the whole visual payoff: the "skeleton" of a number looks nothing like its neighbors.

**Key terms for the developer:**
- **Prime factor**: a prime p such that p divides n evenly.
- **Multiplicity**: how many times p appears in the factorization (e.g., 8 = 2³, multiplicity 3).
- **Leaf node**: a prime number — it has no further factorization.
- **Internal node**: a composite number, always displayed as the product of its two children at that split step. The split does not have to be into two primes — it is into the smallest prime factor and the remaining cofactor. This keeps the tree binary.

---

## 2. Backend Implementation

### Router file: `backend/routers/prime_tree.py`
### Endpoint: `GET /api/prime-tree/{n}`

#### Algorithm

Use SymPy's `factorint` to obtain the full prime factorization as a dict `{prime: exponent}`. Then build a recursive tree by repeatedly peeling off the smallest prime factor:

```python
from sympy import factorint, isprime

def build_tree(n: int) -> dict:
    """Return a nested dict representing the factorization tree of n."""
    if n <= 1:
        return {"value": n, "is_prime": False, "children": []}
    if isprime(n):
        return {"value": n, "is_prime": True, "children": []}
    
    # Find smallest prime factor
    factors = factorint(n)
    p = min(factors.keys())
    cofactor = n // p

    return {
        "value": n,
        "is_prime": False,
        "children": [build_tree(p), build_tree(cofactor)],
    }
```

This always produces a binary tree: left child is the smallest prime, right child is the cofactor. For example, 12 → children [2, 6], and 6 → children [2, 3].

The router calls `build_tree` for n−1, n, and n+1 and returns all three in one response.

#### JSON Response Shape

```json
{
  "n_minus_1": {
    "value": 11,
    "is_prime": true,
    "children": []
  },
  "n": {
    "value": 12,
    "is_prime": false,
    "children": [
      { "value": 2, "is_prime": true, "children": [] },
      {
        "value": 6,
        "is_prime": false,
        "children": [
          { "value": 2, "is_prime": true, "children": [] },
          { "value": 3, "is_prime": true, "children": [] }
        ]
      }
    ]
  },
  "n_plus_1": {
    "value": 13,
    "is_prime": true,
    "children": []
  }
}
```

Each node carries:
- `value` — the integer at this node.
- `is_prime` — boolean; drives leaf styling in the frontend.
- `children` — always empty (leaf) or exactly two entries (binary split).

#### Edge Cases

| Input | Behavior |
|-------|----------|
| `n = 0` | Reject with HTTP 422: "n must be a positive integer greater than 1." |
| `n = 1` | Reject with HTTP 422 for the same reason. The tree for 1 is mathematically undefined (1 has no prime factors). |
| `n = 2` | Valid. n−1 = 1 triggers the edge case above — reject the whole request. Minimum valid n is **3** so that n−1 ≥ 2. |
| `n` is prime | Valid. Returns a single-node tree (root is prime leaf, no children). |
| Large n (e.g., 10¹²) | SymPy's `factorint` handles this quickly for numbers with small factors. For numbers with very large prime factors (e.g., a semiprime near 10¹⁵), factorization can be slow. Cap input at **n ≤ 10¹²** and return HTTP 422 for larger values. This prevents hangs without meaningfully limiting the visualization. |

#### Caching

Cache key: `prime_tree:{n}`. SymPy's `factorint` can be slow for large semiprimes; users navigating through adjacent integers (n, n+1, n+2, ...) will naturally re-request the same triplets. Cache each response via `backend/cache.py`.
| n−1 or n+1 is 1 | Cannot happen for n ≥ 3 (n−1 ≥ 2, n+1 ≥ 4). Already handled by the minimum n = 3 rule. |

#### Full Router Skeleton

```python
from fastapi import APIRouter, HTTPException
from sympy import factorint, isprime

router = APIRouter(prefix="/api", tags=["prime-tree"])

MAX_N = 10**12
MIN_N = 3

def build_tree(n: int) -> dict:
    if isprime(n):
        return {"value": n, "is_prime": True, "children": []}
    factors = factorint(n)
    p = min(factors.keys())
    cofactor = n // p
    return {
        "value": n,
        "is_prime": False,
        "children": [build_tree(p), build_tree(cofactor)],
    }

@router.get("/prime-tree/{n}")
def prime_tree(n: int):
    if n < MIN_N or n > MAX_N:
        raise HTTPException(
            status_code=422,
            detail=f"n must be between {MIN_N} and {MAX_N:,}."
        )
    return {
        "n_minus_1": build_tree(n - 1),
        "n":         build_tree(n),
        "n_plus_1":  build_tree(n + 1),
    }
```

---

## 3. Frontend Implementation

### File: `frontend/views/primeTree.js`
### Exports: `render(data, container)`

#### Layout Choice: D3 Tree Layout (d3.tree)

Use `d3.hierarchy` + `d3.tree` — the standard top-down tree layout. It handles arbitrary depths, computes (x, y) positions for each node automatically, and works well in plain SVG without a build step.

Do **not** use a force layout here. The tree structure is fixed and acyclic; force simulation would add unnecessary complexity and instability.

The `d3.tree()` layout is invoked once per tree (three times total: n−1, n, n+1), then each tree is rendered into its own `<g>` element inside a shared `<svg>`.

#### Three-Tree Side-by-Side Layout

The SVG is divided into three equal vertical columns. Each column gets its own `d3.tree()` layout sized to fit its column width. A column header label ("n−1 = 11", "n = 12", "n+1 = 13") sits above each tree.

Rough sizing:
- Total SVG width: 100% of container, minimum 900px.
- Each column: one-third of SVG width, with ~20px padding on each side.
- Tree height: fixed at ~400px; scale down automatically for shallow trees.

If any tree is a single node (prime leaf), display it centered in its column as a large circle with the label "prime" beneath it.

#### Visual Encoding

| Element | Style |
|---------|-------|
| Internal node (composite) | Medium grey circle, value label inside |
| Leaf node (prime) | Filled circle in accent color (e.g., coral/orange), value label inside |
| Links (edges) | Thin grey lines, straight or curved (use `d3.linkVertical` for smooth curves) |
| Central tree (n) | Slightly larger nodes and bolder strokes to distinguish it as the "main" tree |

#### Input Field

Above the SVG, place a single `<input type="number">` with a "Compute" button. On submit:
1. Call `fetch(`/api/prime-tree/${n}`)`.
2. On success, call `render(data, container)` which clears the container and redraws all three trees.
3. On error (422 from backend), display the error detail string in a small `<p class="error">` below the input.

Also add a small note near the input: "Enter an integer between 3 and 1,000,000,000,000."

#### Hover Tooltips

On `mouseover` of any node, show a floating tooltip (a positioned `<div>` with `pointer-events: none`) with:
- The node's value.
- If composite: its full factorization in the form `2² × 3` (render the exponent from SymPy's returned tree — see note below).
- If prime: the label "Prime".

To display the full factorization on hover without an extra backend call, derive it client-side from the subtree: collect all leaf values from that subtree and group by prime. This is straightforward tree traversal in JS.

#### Complexity Flag

The three-tree D3 layout is well within plain HTML + D3 capability. No TypeScript or build step is needed. The only potential complexity concern is very deep trees (e.g., n = 2^40 produces a tree of depth 40). At depth > ~15 nodes, the default D3 tree layout will produce very narrow spacing. Mitigate by capping display depth to 20 and collapsing deeper subtrees with a "..." node, or by enabling horizontal scrolling on deep columns. For the likely range of n values users will enter interactively, this is rarely a problem.

---

## 4. Additional Visualization Ideas

These go beyond the core spec but are feasible in plain HTML + D3:

**a. Animated decomposition** — When a new n is submitted, animate the tree growing from the root downward: reveal each level with a short delay. Use D3's `transition().delay()` per node. This makes the "skeleton forming" metaphor visceral. Complexity: low, straightforward with D3 enter transitions.

**b. Color by prime identity** — Instead of a single accent color for all primes, assign each distinct prime its own color (e.g., 2 is always blue, 3 is always green, 5 is always red). The same color appears in all three trees, making it immediately obvious which primes are shared or absent. Use `d3.scaleOrdinal(d3.schemeTableau10)` keyed on prime value. This is especially striking when n and n+1 share no prime colors at all.

**c. Multiplicity depth indicator** — When a prime has high multiplicity (e.g., 2⁸ = 256 produces a chain of 8 nodes all labeled "2"), the chain is visually repetitive. Optionally collapse a chain of identical primes into a single node with a badge showing the exponent (e.g., "2" with a superscript "8"), then expand on click. This requires a pre-processing pass over the tree data before rendering.

**d. "Interesting n" suggestions** — Add a row of preset buttons below the input for numbers known to produce striking contrasts: 360, 1024, 1023, 720720, 999983 (a large prime). Each button populates the input and triggers a fetch. Complexity: trivial.

**e. Tree depth and node count stats** — Below each tree, display a small stat line: "Depth: 4 | Nodes: 7 | Distinct primes: 2". Computed client-side from the JSON. Helps users see the structural difference numerically as well as visually.

---

## 5. MCP Suggestions

- **Browser / Puppeteer MCP** — Useful for iterating on D3 layout and visual design. You can ask Claude to take a screenshot of the current render, describe what looks off, and make targeted fixes — much faster than switching to a browser manually during the workshop.
- **Filesystem MCP** — Already implicit in the workflow (reading/writing files), but worth confirming it's enabled so the implementation agent can write `primeTree.js` and `prime_tree.py` directly.

No specialized math MCPs are needed here — SymPy handles all the computation.

---

## 6. Additional Packages Needed

No new Python packages are required beyond those already listed in `infra_plans.md`:

```
fastapi
uvicorn[standard]
sympy
numpy
```

SymPy's `factorint` and `isprime` are sufficient for all backend computation. No additional JS libraries are needed beyond D3.js (already on CDN).

---

## 7. Open Questions — Resolve Before Implementing

1. **Binary vs. flat tree representation** — The plan above always splits into (smallest prime, cofactor), giving a binary tree. An alternative is to represent 12 = 2² × 3 as a single root with three children [2, 2, 3] (flat/star layout). The binary approach produces more interesting visual depth; the flat approach is arguably more mathematically literal. Which form is preferred visually?

2. **Minimum n = 3 rule** — The spec says "provide a number," implying any positive integer. But n = 1 and n = 2 break the three-tree display (n−1 would be 1 or 0). Should these be silently rejected with an inline message, or should the UI disable the Compute button and show a "n must be ≥ 3" hint before the user submits?

3. **Tree depth cap for large inputs** — The plan proposes collapsing trees deeper than ~20 levels. Should collapsed subtrees be expandable on click (requires stateful rendering), or should they just display a static "..." node with a tooltip explaining why it's truncated?

4. **Column width for very wide trees** — Highly composite numbers (e.g., 720720 = 2⁴ × 3² × 5 × 7 × 11 × 13) produce wide trees at shallow depth. The fixed three-column layout may crowd these. Options: allow horizontal scrolling per column, or dynamically redistribute column widths based on the width of each tree. Which is preferred?

5. **n input type** — Should the input accept only integers typed by the user, or also support expressions like `2^10` or `10!` (parsed on the frontend before sending to the backend)? Expression parsing is a modest JS complexity addition but would make the tool much more fun to explore.
