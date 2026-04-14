# Totient Function Graph (Euler's φ) — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Plot Euler's totient function φ(n) for a range of integers. The scatter plot reveals rich structure: spikes at primes (φ(p) = p−1), low values at highly composite numbers, and visible "rays" corresponding to φ(n) = n·∏(1 − 1/p). Interactive hover shows the factorization and coprime count for each point.

## Backend

### Endpoints

```
GET /api/totient?start=1&end=10000
GET /api/totient/detail?n=360
```

### Response Shape

**Range:**
```json
{
  "data": {
    "start": 1,
    "end": 10000,
    "values": [1, 1, 2, 2, 4, 2, 6, 4, ...]
  }
}
```

Array index i → φ(start + i). Compact since values are just integers.

**Detail:**
```json
{
  "data": {
    "n": 360,
    "totient": 96,
    "ratio": 0.2667,
    "factors": { "2": 3, "3": 2, "5": 1 },
    "is_prime": false,
    "is_highly_composite": true
  }
}
```

### Service Logic (`services/totient.py`)

```python
def totient_sieve(limit: int) -> list[int]:
    """Compute φ(n) for all n in [0, limit] using a sieve."""
    phi = list(range(limit + 1))
    for p in range(2, limit + 1):
        if phi[p] == p:  # p is prime
            for multiple in range(p, limit + 1, p):
                phi[multiple] -= phi[multiple] // p
    return phi
```

- The sieve runs in O(n log log n), same complexity as Eratosthenes. For n = 10,000 it's instant; for n = 1,000,000 it takes ~100 ms.
- Cache sieve results in memory (or SQLite for persistence across restarts).

### Input Validation

- `end - start ≤ 100,000` per request.
- `start ≥ 1`, `end ≤ 1,000,000`.

## Frontend (`tools/TotientGraph.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `end` | Slider | 10,000 | 100 – 100,000 |
| Highlight | Dropdown | None | primes, highly_composite, perfect_totient |
| Show φ(n)/n | Toggle | off | — |

### Visualization

- **SVG scatter plot** via D3.
- X-axis: n. Y-axis: φ(n).
- Each point is a small circle. Color by category:
  - Blue: primes (φ(p) = p−1, forming the top diagonal).
  - Red: highly composite numbers.
  - Gray: everything else.
- When "Show φ(n)/n" is toggled, y-axis switches to the ratio, which reveals the "ray" structure more clearly (values cluster on lines y = ∏(1 − 1/p) for various prime sets).

### Interaction

- **Hover:** Tooltip shows n, φ(n), φ(n)/n, and prime factorization.
- **Brush select:** Drag a rectangle to zoom into a sub-range. Double-click to reset.
- **Highlight filter:** Dropdown adds colored emphasis to special subsets.

### Performance

For 100K points, SVG may lag. Options:
- Use `<circle>` elements with D3 but limit to visible viewport (virtual scrolling on x-axis).
- Switch to canvas for > 20K points (D3 can drive canvas draws too).
- Hybrid: canvas for the scatter, SVG overlay for axes and tooltip crosshairs.

## Implementation Steps

1. Implement `services/totient.py` with sieve + detail function. Test against known values.
2. Create `routers/totient.py`.
3. Build `tools/TotientGraph.tsx` — basic scatter plot with D3.
4. Add hover tooltips with detail fetched from `/api/totient/detail`.
5. Add φ(n)/n ratio toggle.
6. Add brush zoom and highlight filters.
7. Optimize rendering for large ranges (canvas fallback).

## Open Questions

1. **Related functions:** Should we also support plotting other multiplicative functions alongside φ? For example, σ(n) (sum of divisors) or μ(n) (Möbius function). This would generalize the tool but adds scope.
2. **Logarithmic y-axis option?** The linear scatter can feel crowded near the bottom. Log scale might reveal structure in the low-φ region.
3. **Point size:** Fixed size, or scale by some property (e.g., number of distinct prime factors)? Scaling adds information density but may clutter the view.
