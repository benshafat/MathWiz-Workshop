# Recamán's Sequence — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Recamán's sequence: start at 0. At step n, subtract n from the current value if the result is positive and hasn't been visited; otherwise add n. The sequence jumps erratically, producing a beautiful arc diagram.

## Backend

### Endpoints

```
GET /api/recaman?terms=100
```

### Response Shape

**Sequence:**
```json
{
  "data": {
    "terms": 100,
    "sequence": [0, 1, 3, 6, 2, 7, 13, 20, 12, 21, ...],
    "arcs": [
      { "from": 0, "to": 1, "step": 1, "direction": "forward" },
      { "from": 1, "to": 3, "step": 2, "direction": "forward" },
      { "from": 3, "to": 6, "step": 3, "direction": "forward" },
      { "from": 6, "to": 2, "step": 4, "direction": "backward" },
      ...
    ]
  }
}
```

Each arc includes `from`, `to`, `step` (the n used), and `direction` (forward = added, backward = subtracted). The frontend uses this to draw semicircular arcs.

### Service Logic (`services/recaman.py`)

```python
def recaman(terms: int) -> tuple[list[int], list[dict]]:
    """Generate Recamán's sequence and arc metadata."""
    seq = [0]
    visited = {0}
    arcs = []
    for n in range(1, terms):
        prev = seq[-1]
        candidate = prev - n
        if candidate > 0 and candidate not in visited:
            seq.append(candidate)
            arcs.append({"from": prev, "to": candidate, "step": n, "direction": "backward"})
        else:
            seq.append(prev + n)
            arcs.append({"from": prev, "to": prev + n, "step": n, "direction": "forward"})
        visited.add(seq[-1])
    return seq, arcs
```

- Computation is O(n) and instant for n ≤ 100,000.
- No caching needed.

### Input Validation

- `terms`: 1–100,000.

## Frontend (`tools/RecamanSequence.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `terms` | Slider | 100 | 10 – 5,000 |
| Animation speed | Slider | 200 ms/arc | 20 – 1000 ms |
| Color mode | Dropdown | Step-based gradient | step gradient, direction (fwd/bwd), monochrome |

### Visualization: Arc Diagram

- **SVG** for ≤ 1000 terms, **Canvas** for more.
- Number line along the x-axis (horizontal).
- Each arc is a semicircle connecting `from` to `to`:
  - Forward arcs curve above the line.
  - Backward arcs curve below the line.
- Arc radius = |to − from| / 2; center at midpoint.
- Color: gradient from cool (early steps) to warm (late steps), or by direction.

### Animation

- Arcs draw one at a time, with the current position highlighted as a dot traveling along the number line.
- Each arc "grows" from start to end using an SVG path animation or D3 transition.
- A counter shows the current step number and sequence value.

## Implementation Steps

1. Implement `services/recaman.py` with tests (verify first 20 terms against OEIS A005132).
2. Create `routers/recaman.py`.
3. Build `tools/RecamanSequence.tsx` — static arc diagram.
4. Add animation (sequential arc drawing).
5. Add color modes.

## Open Questions

1. **Number line scaling:** For large term counts, the sequence reaches very large values (term 1000 can exceed 100,000). The arc diagram becomes extremely wide. Should we:
   - Use a logarithmic x-axis? (Distorts arc shapes.)
   - Allow horizontal scroll/pan?
   - Auto-fit and let the user zoom?
2. **"First missing" indicator:** Recamán's sequence is conjectured to hit every positive integer eventually, but it misses many early on. Should we highlight which small integers haven't appeared yet? (e.g., 4 doesn't appear until step 225,424.)
3. **SVG performance:** Even 500 arcs with large radii can slow SVG rendering. Should we default to canvas earlier, or use SVG `<path>` elements with simplified arcs?
