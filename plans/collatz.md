# Collatz Conjecture — Implementation Plan

## 1. Math Background

### The 3n+1 Rule

Pick any positive integer _n_. Apply the following rule repeatedly:

- If _n_ is **even**: replace it with _n_ / 2
- If _n_ is **odd**: replace it with 3_n_ + 1

The **Collatz Conjecture** (also called the 3n+1 problem, or the Syracuse problem) states that no matter which positive integer you start with, this process will always eventually reach 1. Once it hits 1, it cycles: 1 → 4 → 2 → 1 → ...

Example starting from 6: `6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1`

The problem is trivially easy to compute but has resisted all proof attempts. Paul Erdős said "mathematics is not yet ready for such problems." As of 2025, it has been verified for all starting values up to at least 2.95 × 10²⁰.

**Why is it hard?** The two rules pull in opposite directions — halving shrinks a number rapidly, but tripling-and-adding-one can cause large jumps. There is no known invariant or global structure that guarantees descent. The sequence of step types (even/odd) for a given starting point looks pseudo-random, which makes algebraic analysis extremely difficult.

### The Reverse Collatz Tree

Instead of tracing sequences forward, we can ask: which numbers lead to a given node in one step?

Given a node _n_, its **reverse predecessors** are:
- **2n** — always a valid predecessor, since 2n is even and (2n)/2 = n.
- **(n − 1) / 3** — valid only if (n − 1) is divisible by 3 **and** (n − 1)/3 is a **positive odd integer** (even numbers can't produce odd-step predecessors, because 3k+1 is always even when k is odd, so k itself must be odd).

Starting from 1 as the root and expanding predecessors recursively produces a tree that, if the conjecture is true, contains every positive integer exactly once. This tree is structurally like a river delta or a vascular system — densely branching near the root, thinning at the tips.

### The Organic-Plant Layout

The most visually striking rendering assigns each node a geometric angle based on the **type of step** that produced it during the forward sequence:

- If the step that produced this node from its parent was an **even step** (halving), rotate the drawing direction by `even_angle` degrees (e.g. slightly left).
- If the step was an **odd step** (3n+1), rotate by `odd_angle` degrees (e.g. slightly right).

Draw a segment of fixed length at the current direction, then recurse. The resulting image resembles a plant, coral polyp, or river system. The exact shape is highly sensitive to the angle parameters — sweeping them with a slider produces dramatically different organic structures.

This layout is purely a frontend rendering choice; it uses only the sequence of step types (even/odd labels per transition), not numeric values, to determine angles. The backend does not need to know about angles at all — see the Backend section below.


## 2. Backend Implementation

### File: `backend/routers/collatz.py`
### Endpoint: `GET /api/collatz/{n}`

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `n` | int (path) | required | Starting integer for the primary sequence |
| `k` | int | 1 | Number of consecutive starting values (n, n+1, ..., n+k-1) for multi-path mode |
| `mode` | str | `"forward"` | `"forward"` for multi-path convergence, `"reverse"` for tree-from-1 |
| `depth` | int | 20 | Max depth for reverse tree expansion |

#### Angles: frontend concern only

`even_angle` and `odd_angle` are **not** query parameters and do not affect the data returned. The backend returns the sequence of step types (`"even"` / `"odd"`) for each transition, and the frontend applies angles locally. This is the right split because:

1. The angles affect only rendering, not math.
2. Keeping them out of the backend lets the frontend redraw instantly when the user moves a slider, without a round-trip.
3. It avoids coupling a physics/geometry detail to the data API.

#### Computing Forward Sequences

```python
def collatz_sequence(n: int) -> list[dict]:
    steps = []
    while n != 1:
        if n % 2 == 0:
            steps.append({"from": n, "to": n // 2, "type": "even"})
            n = n // 2
        else:
            steps.append({"from": n, "to": 3 * n + 1, "type": "odd"})
            n = 3 * n + 1
    return steps
```

Use plain Python integers (not NumPy) to avoid overflow. SymPy is not needed for this computation — standard Python integers handle arbitrary precision.

#### Computing the Reverse Tree

```python
def reverse_collatz_tree(root: int, depth: int) -> dict:
    if depth == 0:
        return {"value": root, "children": []}
    children = []
    # Always valid: 2*root
    children.append(reverse_collatz_tree(2 * root, depth - 1))
    # Valid only if (root - 1) % 3 == 0 and (root-1)//3 is a positive odd integer
    candidate = (root - 1) // 3
    if (root - 1) % 3 == 0 and candidate > 0 and candidate % 2 == 1:
        children.append(reverse_collatz_tree(candidate, depth - 1))
    return {"value": root, "children": children}
```

Cap `depth` at 25 to avoid exponential blowup (the 2n branch always exists, so the tree is always at least binary, meaning 2^25 ≈ 33 million nodes in the worst case — cap at 20 in practice, around 1 million nodes).

#### JSON Response Shapes

**Forward / multi-path mode** (`mode=forward`):

```json
{
  "mode": "forward",
  "paths": [
    {
      "start": 6,
      "sequence": [6, 3, 10, 5, 16, 8, 4, 2, 1],
      "steps": [
        {"from": 6,  "to": 3,  "type": "even"},
        {"from": 3,  "to": 10, "type": "odd"},
        {"from": 10, "to": 5,  "type": "even"},
        {"from": 5,  "to": 16, "type": "odd"},
        {"from": 16, "to": 8,  "type": "even"},
        {"from": 8,  "to": 4,  "type": "even"},
        {"from": 4,  "to": 2,  "type": "even"},
        {"from": 2,  "to": 1,  "type": "even"}
      ],
      "length": 8
    }
  ],
  "convergence_nodes": [
    {"value": 16, "paths_meeting": [6, 7]},
    {"value": 8,  "paths_meeting": [6, 7]},
    {"value": 4,  "paths_meeting": [6, 7]},
    {"value": 2,  "paths_meeting": [6, 7]},
    {"value": 1,  "paths_meeting": [6, 7]}
  ]
}
```

`convergence_nodes` lists every value that appears in more than one path (in the order they appear), along with which starting values share them. This is computed in Python by intersecting the `sequence` sets across paths.

**Reverse tree mode** (`mode=reverse`):

```json
{
  "mode": "reverse",
  "depth": 20,
  "root": 1,
  "tree": {
    "value": 1,
    "children": [
      {
        "value": 2,
        "children": [...]
      }
    ]
  }
}
```

#### Input Validation

- Reject `n < 1` with HTTP 422.
- Clamp `k` to the range [1, 20] (20 simultaneous paths is enough for a clear visual).
- Clamp `depth` to [1, 20].
- No SymPy or NumPy imports needed — pure Python suffices.

#### Caching

Cache key: `collatz:{n}:{k}:{mode}:{depth}`. Forward sequences are cheap, but the reverse tree at depth 20 can reach ~1M nodes and is expensive to rebuild. Cache all responses via `backend/cache.py`.

#### Pydantic Models (recommended)

Define response models in the router or a `schemas/collatz.py` file so FastAPI generates accurate OpenAPI docs:

```python
class CollatzStep(BaseModel):
    from_: int = Field(alias="from")
    to: int
    type: Literal["even", "odd"]

class CollatzPath(BaseModel):
    start: int
    sequence: list[int]
    steps: list[CollatzStep]
    length: int

class ConvergenceNode(BaseModel):
    value: int
    paths_meeting: list[int]

class ForwardResponse(BaseModel):
    mode: Literal["forward"]
    paths: list[CollatzPath]
    convergence_nodes: list[ConvergenceNode]

class ReverseTreeNode(BaseModel):
    value: int
    children: list["ReverseTreeNode"]

class ReverseResponse(BaseModel):
    mode: Literal["reverse"]
    depth: int
    root: int
    tree: ReverseTreeNode
```


## 3. Frontend Implementation

### File: `frontend/views/collatz.js`
### Exports: `render(data, container)`

The view has two sub-modes driven by `data.mode`:
- `"forward"` → multi-path convergence graph
- `"reverse"` → organic-plant / reverse tree layout

A small control panel above the SVG lets the user switch modes, set _n_, _k_, and (for the plant layout) the two angle sliders.

### Controls

```
[ n: ______ ] [ k: __ ] [ Mode: Forward | Plant | Reverse Tree ]
[ Even angle: ---o--- ] [ Odd angle: ---o--- ]   (visible only in Plant mode)
[ Draw ]
```

On "Draw", `api.js` fetches from `/api/collatz/{n}?k={k}&mode={mode}` and calls `render(data, container)`. For Plant mode, the angle sliders call a pure-JS `redraw()` that recomputes geometry from the already-fetched step sequence — no new backend call.

### Mode 1: Multi-Path Convergence (D3 force layout)

Represent the union of all paths as a directed graph:
- Each unique integer value is a node.
- Each step (`from` → `to`) is a directed edge.
- Node size scales with the number of paths passing through it.
- Convergence nodes (those in `convergence_nodes`) are highlighted in a distinct color.
- Starting nodes are labeled with their starting value.

Use **D3 force simulation** (`d3.forceSimulation`) with:
- `d3.forceLink` — pulls connected nodes together.
- `d3.forceManyBody` — repulsion to spread nodes out.
- `d3.forceCenter` — centers the graph.

Directed edges are drawn as `<line>` elements with arrowhead markers (`<marker>` in SVG `<defs>`).

Color encoding:
- Starting nodes: orange.
- Convergence nodes (shared by 2+ paths): purple, scaled by `paths_meeting.length`.
- Terminal node (1): red.
- Regular nodes: steel blue.

This is straightforward D3 and does not push the limits of plain JS + D3.

### Mode 2: Organic-Plant Layout (turtle-graphics style)

This is the visually striking centerpiece. Implementation:

1. Fetch data in `forward` mode with `k=1` (single path from starting node _n_).
2. The `steps` array contains the sequence of `"even"` / `"odd"` type labels.
3. Apply turtle-graphics recursion:
   - Maintain a current position `(x, y)` and direction `angle` (in radians).
   - For each step in `steps`:
     - If type is `"even"`, turn by `even_angle` degrees.
     - If type is `"odd"`, turn by `odd_angle` degrees.
     - Advance by `segment_length` pixels in the current direction.
     - Push a `<line>` or append to an SVG `<path>` d-string.
4. Color each segment by step type (e.g. blue for even, orange for odd) to make the branching pattern legible.

The angle sliders update `even_angle` and `odd_angle` JS variables, then call `redraw()` which recomputes all geometry from the cached `steps` array. No network request needed.

**Complexity note (plain HTML + D3):** Turtle-graphics on a flat sequence is simple SVG path construction — no D3 abstractions needed, just geometry math. This is well within reach of plain JS.

For very long sequences (e.g. starting from a large _n_), the number of SVG elements could be large. If the sequence exceeds ~5000 steps, switch to a `<canvas>` renderer instead of SVG to maintain performance.

### Mode 3: Reverse Tree Layout (D3 tree layout)

Use `d3.tree()` from D3's hierarchy module:

1. Convert the nested `tree` JSON to a `d3.hierarchy` node.
2. Apply `d3.tree().size([width, height])` to compute `x, y` positions.
3. Render nodes as `<circle>` elements and links as curved `<path>` elements using `d3.linkVertical()`.
4. Add pan/zoom with `d3.zoom()` — the reverse tree at depth 15+ is too large to fit on screen.
5. Label nodes on hover with a tooltip showing the integer value.

**Complexity note:** `d3.tree()` handles arbitrary tree layouts and is well-supported in plain D3. The main challenge at high depth is the number of nodes (exponential in depth). Limit the UI to depth ≤ 15 and add a warning label when depth > 12.


## 4. Additional Visualization Ideas

These go beyond the spec but are feasible with plain D3:

### Stopping-Time Heatmap
Compute the Collatz stopping time (number of steps to reach 1) for integers from 1 to N. Render as a 1D bar chart or color strip where height/color encodes stopping time. This reveals wild variation — numbers near each other can have vastly different stopping times. N up to 10,000 is fast to compute and renders well as an SVG bar chart.

### Trajectory-Length vs. Starting-Value Scatter
Plot `(n, stopping_time(n))` as a scatter plot for n from 1 to 10,000. The cloud of points has a striking irregular structure with clear record-breakers visible as outliers. Add a toggle to show only record-breaking values (those with a longer path than all smaller n).

### Peak-Value Plot
For each starting value n, record the maximum value reached during its trajectory (the "altitude"). Plot altitude vs. n. Some numbers like 27 reach heights orders of magnitude larger than their starting value before descending — this surprises most people and makes a great "wow" moment.

### Animated Trajectory
For a single starting value, animate the forward sequence step by step on a number line (log scale), showing the value bouncing up and down before crashing to 1. Achievable with D3 transitions on a single animated circle.


## 5. MCP Suggestions

- **Filesystem MCP** — useful for caching computed reverse trees at high depth to disk (avoids recomputing on hot reload during development). Not essential since computation is fast for depth ≤ 20.
- **Browser / Playwright MCP** — useful for visually inspecting the D3 output during iteration, especially for the organic-plant layout where the "does it look like a plant?" question is purely visual. Highly recommended for the plant layout iteration cycle.
- **Memory MCP** — could store which `(n, even_angle, odd_angle)` combinations produced visually interesting plant shapes, so the workshop facilitator can quickly recall and share good parameter combinations.


## 6. Additional Packages Needed

No additional Python packages are required beyond those already in `infra_plans.md`:

| Package | Already listed? | Notes |
|---------|----------------|-------|
| `fastapi` | Yes | Framework |
| `uvicorn[standard]` | Yes | ASGI server |
| `sympy` | Yes | Not actually needed for Collatz math, but available |
| `numpy` | Yes | Not needed; plain Python integers avoid overflow |

The reverse tree recursion and sequence computation are entirely handled by Python builtins. Do not use `numpy` for Collatz sequences — numpy integers have fixed bit-width and will silently overflow for large starting values. Use native Python `int` throughout.

No new JS libraries are needed beyond D3, which already covers force layout, tree layout, and SVG path construction.


## 7. Answered Questions 

1. **Reverse tree depth cap in the UI** — depth 20 can produce over 1 million nodes and make the browser unresponsive. Should the UI hard-cap the slider at 15, or show a warning and let the user proceed? Answer: hard-cap at 15 with a label explaining why. KISS principle for the workshop.

2. **Plant layout: single sequence or multi-branch?** — The current spec describes applying turtle-graphics to a single forward sequence (a linear path). A more organic-looking variant would render the reverse tree with turtle-graphics (each branch turns based on step type). This is significantly more complex because branches share a coordinate frame and must be drawn recursively with save/restore of the turtle state. Decide whether the plant layout is (a) a single-path turtle walk (simple, linear) or (b) a reverse-tree turtle walk (more organic, more complex). Answer: implement (a) for now. 

3. **Segment length for the plant layout** — a fixed pixel length per step means long sequences (e.g. starting from 27, which takes 111 steps) produce a very long plant that may overflow the viewport. Options: (a) fixed length with pan/zoom, (b) length that auto-scales to fit the viewport based on sequence length. Answer: fixed length with pan/zoom.

4. **Convergence node definition** — currently defined as any node appearing in more than one path. An alternative is to define convergence as the **first** node where all k paths join and stay joined (i.e. a true merge point). Both are interesting but produce different visuals. The current JSON shape supports the former (listing all shared nodes). Answer: all shared nodes.

5. **Starting value range for k paths** — the spec says n, n+1, ..., n+k-1. An alternative is to let the user specify k arbitrary starting values (a comma-separated input). The consecutive-values approach is simpler and still reveals interesting convergence structure. Answer: actually, I want the user to be able to give K arbitrary values. K can be set to be capped at 5, btw.
