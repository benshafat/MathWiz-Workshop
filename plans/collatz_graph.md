# Collatz Convergence Graph — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Given up to 5 starting integers, compute each Collatz trajectory (applying n/2 or 3n+1 until reaching 1) and merge all of them into a single directed graph. The result reveals which paths are unique to one number, where two or more paths first converge onto the same node, and the long shared tail they all ride down to 1. Merge nodes — where trajectories first meet — are the visual payoff.

## Backend

### Endpoint

```
GET /api/collatz/graph?ns=27,97,6,18,54
```

- `ns`: comma-separated list of 1–5 positive integers, each ≥ 1 and ≤ 10,000 (cap keeps graph manageable).

### Response Shape

```json
{
  "data": {
    "inputs": [27, 6, 18],
    "nodes": [
      { "value": 27,  "origins": [27],     "step_from": { "27": 0 } },
      { "value": 82,  "origins": [27],     "step_from": { "27": 1 } },
      { "value": 6,   "origins": [6],      "step_from": { "6": 0  } },
      { "value": 3,   "origins": [6, 18],  "step_from": { "6": 1, "18": 1 } },
      { "value": 18,  "origins": [18],     "step_from": { "18": 0 } },
      { "value": 9,   "origins": [18],     "step_from": { "18": 1 } },
      { "value": 16,  "origins": [27, 6, 18], "step_from": { "27": 7, "6": 5, "18": 6 } },
      { "value": 1,   "origins": [27, 6, 18], "step_from": { "27": 111, "6": 8, "18": 20 } }
    ],
    "edges": [
      { "from": 27, "to": 82  },
      { "from": 6,  "to": 3   },
      { "from": 18, "to": 9   },
      { "from": 3,  "to": 10  },
      { "from": 16, "to": 8   }
    ],
    "paths": {
      "27": [27, 82, 41, 124, 62, 31, 94, 47, 142, 71, 214, 107, 322, 161, 484, 242, 121, 364, 182, 91, 274, 137, 412, 206, 103, 310, 155, 466, 233, 700, 350, 175, 526, 263, 790, 395, 1186, 593, 1780, 890, 445, 1336, 668, 334, 167, 502, 251, 754, 377, 1132, 566, 283, 850, 425, 1276, 638, 319, 958, 479, 1438, 719, 2158, 1079, 3238, 1619, 4858, 2429, 7288, 3644, 1822, 911, 2734, 1367, 4102, 2051, 6154, 3077, 9232, 4616, 2308, 1154, 577, 1732, 866, 433, 1300, 650, 325, 976, 488, 244, 122, 61, 184, 92, 46, 23, 70, 35, 106, 53, 160, 80, 40, 20, 10, 5, 16, 8, 4, 2, 1],
      "6":  [6, 3, 10, 5, 16, 8, 4, 2, 1],
      "18": [18, 9, 28, 14, 7, 22, 11, 34, 17, 52, 26, 13, 40, 20, 10, 5, 16, 8, 4, 2, 1]
    },
    "first_merge": {
      "pair": [6, 18],
      "value": 3,
      "at_steps": { "6": 1, "18": 2 }
    },
    "global_merge_value": 16,
    "global_merge_steps": { "27": 104, "6": 4, "18": 14 }
  },
  "meta": { "computeTimeMs": 1.2 }
}
```

Key fields:
- `nodes[i].origins`: which input numbers pass through this node.
- `nodes[i].step_from`: step index at which each origin reaches this node (0 = it is the start).
- `first_merge`: the earliest pair of inputs that converge, and where.
- `global_merge_value`: the first node that **all** inputs share (if it exists within the computed range).
- `global_merge_steps`: step at which each input arrives at `global_merge_value`.

### Service Logic (`services/collatz_graph.py`)

```python
def collatz_trajectory(n: int) -> list[int]:
    """Full sequence from n down to 1 (inclusive)."""

def build_graph(inputs: list[int]) -> dict:
    """
    1. Compute trajectory for each input.
    2. Union all values into a node set; each node records which inputs visit it
       and at what step.
    3. Build edge set: for each consecutive pair in each trajectory, add the
       directed edge (deduplicating — same edge may appear in multiple paths).
    4. Find first_merge: earliest step at which any two trajectories share a node.
    5. Find global_merge_value: first node in the node set visited by all inputs.
    """
```

No SQLite caching needed — trajectories for n ≤ 10,000 are computed in microseconds.

### Input Validation

- `ns`: 1–5 values, each 1–10,000.
- Duplicate values are silently deduplicated (treat as one path).
- Returns HTTP 400 if any value is out of range or more than 5 are provided.

## Frontend (`tools/CollatzGraph.tsx`)


### Parameters

| Param | Control | Default |
|-------|---------|---------|
| Up to 5 integers | Five numeric inputs (only show filled ones) | `[27, 6, 18]` |

Each input has an "add" / "remove" button to grow/shrink the set (min 1, max 5).

### Visualization

**D3 force-directed graph** (SVG), same engine as PrimeTree but with a DAG-flavored layout:

- **Force setup:** link force pulls connected nodes together; a horizontal positional force ("depth gravity") pushes nodes left-to-right by their minimum distance to node 1, so paths flow naturally from left (starts) to right (end = 1). A small vertical collision force spreads parallel nodes apart.
- **Node appearance:**
  - **Start nodes** (the 5 inputs): larger circle, labeled with the input value, colored by their assigned color.
  - **Merge nodes** (visited by ≥ 2 inputs): medium circle with a white/bright ring, colored as a blend of the contributing input colors (if exactly 2) or accent white (if all).
  - **Intermediate nodes** (visited by exactly 1 input): small circle, colored by that input.
  - **Node 1** (terminal): always rendered as a special star or double-circle.
- **Edge appearance:**
  - Directed arrows (SVG marker).
  - Colored by the set of inputs that use this edge. If multiple inputs share an edge, stroke is split or uses a neutral accent color.
- **Labels:** always shown on start and merge nodes; hidden on intermediate nodes (to reduce clutter) but revealed on hover.
- **Color palette:** up to 5 distinct colors per input. Suggested: `#f87171` (red), `#60a5fa` (blue), `#34d399` (green), `#fbbf24` (yellow), `#c084fc` (purple).

### Interaction

- **Hover node:** tooltip shows value, step index for each origin that passes through it, and whether it is a merge node.
- **Hover edge:** tooltip shows which origin paths use this edge.
- **Click node:** highlight all paths that pass through it (dim unrelated edges/nodes).
- **"First merge" badge:** below the graph, a line reading e.g. "6 and 18 first meet at **3** (step 1 vs step 2)."
- **"Global merge" badge:** "All paths converge at **16**."

### Large-trajectory handling

Numbers near 10,000 can produce trajectories of 200+ steps, creating very dense graphs. Two mitigations:

1. **Node count cap:** if the union of all trajectories exceeds 300 nodes, display a warning and offer a "condensed" toggle.
2. **Condensed mode (optional enhancement):** collapse straight-chain segments (nodes with in-degree = out-degree = 1, visited by the same single origin) into a single edge labeled with the number of collapsed steps. Only branch/merge/start/end nodes remain as explicit circles.

## Wiring into the app

Two files must be updated for the tool to appear in the sidebar and be routable:

**`frontend/src/toolRegistry.ts`** — add a lazy import and a registry entry:
```ts
const CollatzGraph = lazy(() => import("./tools/CollatzGraph"));

// in toolRegistry array:
{
  id: "collatz-graph",
  name: "Collatz Convergence Graph",
  path: "collatz-graph",
  description: "Trace up to 5 Collatz paths and see where they merge",
  component: CollatzGraph,
  renderer: "svg",
},
```

**`backend/main.py`** — add `"collatz_graph"` to `_ROUTER_MODULES`:
```python
_ROUTER_MODULES = [
  "prime_tree",
  "ulam",
  "syracuse",
  "collatz_graph",   # ← add this
  ...
]
```

The sidebar and route generation are driven entirely by `toolRegistry`, so no other frontend changes are needed.

## Implementation Steps

1. Implement `services/collatz_graph.py`: `collatz_trajectory`, `build_graph`. Unit tests: known merge points, single input (degenerate graph = chain), duplicate inputs, global merge detection.
2. Create `routers/collatz_graph.py` with the `/api/collatz/graph` endpoint and query-string parsing for `ns`.
3. Wire into app: add entry to `toolRegistry.ts` and `_ROUTER_MODULES` in `main.py`.
4. Build `tools/CollatzGraph.tsx` with static layout (no force sim), just verifying data correctness.
5. Add D3 force simulation with depth gravity. Tune force parameters for a clean left-to-right DAG look.
6. Implement node/edge coloring by origin set.
7. Add hover tooltips and click-to-highlight.
8. Add "first merge" and "global merge" badges.
9. Add condensed mode toggle (if graph is large).

## Additional info

1. **Node 1 appears in every trajectory.** So, exclude 1, 2, 4 (the universal tail) from the merge detection and report the first "interesting" convergence instead.
2. **Step counting for merge:** two paths may pass through the same *value* at wildly different steps (e.g., 27 hits 16 at step 104, but 6 hits 16 at step 4). The visual should make this asymmetry clear — perhaps by placing the node closer to the input that reaches it first.
3. A force layout with positional anchoring is much simpler to implement and looks good in practice. We can use this for now. Future: Consider a library like `d3-dag` if the force approach looks messy.
4. **Cycles:** Collatz trajectories (under the unproven conjecture) never cycle for positive integers. We can safely assume termination for n ≤ 10,000.
