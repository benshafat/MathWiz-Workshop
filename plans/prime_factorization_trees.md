# Prime Factorization Trees — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Decompose any positive integer into its prime factors and render the factorization as an interactive branching tree. Support animation to show how nearby integers produce radically different tree shapes.

## Backend

### Endpoint

```
GET /api/prime-tree?n=360
GET /api/prime-tree/range?start=2&end=20   # batch, for animation mode
```

### Response Shape

```json
{
  "data": {
    "n": 360,
    "tree": {
      "value": 360,
      "children": [
        { "value": 2, "children": [] },
        {
          "value": 180,
          "children": [
            { "value": 2, "children": [] },
            {
              "value": 90,
              "children": [
                { "value": 2, "children": [] },
                {
                  "value": 45,
                  "children": [
                    { "value": 3, "children": [] },
                    {
                      "value": 15,
                      "children": [
                        { "value": 3, "children": [] },
                        { "value": 5, "children": [] }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

Leaf nodes are primes. Internal nodes are composite intermediate values. The tree represents the full recursive decomposition (not just the flat list of prime factors).

### Service Logic (`services/prime_tree.py`)

```python
def factorization_tree(n: int) -> dict:
    """Return nested dict representing the factorization tree."""
    if n <= 1:
        return {"value": n, "children": []}
    smallest = smallest_prime_factor(n)
    if smallest == n:  # n is prime
        return {"value": n, "children": []}
    return {
        "value": n,
        "children": [
            {"value": smallest, "children": []},
            factorization_tree(n // smallest)
        ]
    }
```

- `smallest_prime_factor`: trial division up to √n. For n up to ~10^9 this is instant.
- For very large numbers, optionally use sympy's `factorint`.
- No caching needed — computation is fast.

### Input Validation

- `n` must be a positive integer ≥ 2.
- `range` endpoint: `end - start ≤ 500` to prevent huge payloads.

## Frontend (`tools/PrimeTree.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `n` | Numeric input | 360 | 2 – 1,000,000 |
| Animate toggle | Checkbox | off | — |
| Animation speed | Slider | 500 ms | 100 – 2000 ms |

### Visualization

- **D3 tree layout** (`d3.tree()`) rendering into an SVG.
- Each node is a circle; leaf primes are colored (distinct color per prime), composites are gray.
- Edge labels show the factor.
- On hover, a node shows its value and the full sub-factorization.
- Tree auto-fits to the available area (`ToolShell` provides dimensions).

### Animation Mode

When enabled, increment `n` by 1 on a timer. Fetch the next tree and use D3's `enter/update/exit` with transitions to morph the tree shape smoothly. This visually demonstrates how tree structure changes between neighbors (e.g., 127 is prime → single node; 128 = 2^7 → deep chain).

### Smooth / Prime Indicator

- Badge below the tree: "Prime!" if n is prime, or "k-smooth" showing the largest prime factor.

## Implementation Steps

1. Implement `services/prime_tree.py` with unit tests.
2. Create `routers/prime_tree.py` with the two endpoints.
3. Build `tools/PrimeTree.tsx` with static rendering (no animation).
4. Add hover tooltips and node coloring.
5. Add animation mode.
6. Polish: transitions, responsive sizing, edge cases (n=2, large primes).

## Additional Info

1. **Tree orientation:** Top-down (root at top).
2. **Very large numbers:** Cap at 10^12 and explain why.
