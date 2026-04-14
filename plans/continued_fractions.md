# Continued Fraction Expansions — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Represent real numbers as continued fractions `[a₀; a₁, a₂, ...]` and visualize the sequence of rational convergents that progressively approximate the true value. The golden ratio, with all coefficients equal to 1, is the "most irrational" number — its convergents approach most slowly. Visualize convergents on a number line and optionally on a Stern-Brocot tree.

## Backend

### Endpoints

```
GET /api/continued-fractions?value=pi&terms=20
GET /api/continued-fractions?value=sqrt2&terms=30
GET /api/continued-fractions?value=custom&custom=1.41421356&terms=15
```

### Supported Named Constants

`pi`, `e`, `sqrt2`, `sqrt3`, `golden_ratio`, `ln2`. For these, use exact symbolic computation (via `mpmath` or known CF patterns) rather than floating-point approximation.

### Response Shape

```json
{
  "data": {
    "value": "pi",
    "decimal": "3.14159265358979...",
    "coefficients": [3, 7, 15, 1, 292, 1, 1, 1, 2, ...],
    "convergents": [
      { "n": 0, "p": 3, "q": 1, "decimal": 3.0, "error": 0.14159 },
      { "n": 1, "p": 22, "q": 7, "decimal": 3.142857, "error": 0.00126 },
      { "n": 2, "p": 333, "q": 106, "decimal": 3.141509, "error": 0.0000836 },
      ...
    ]
  }
}
```

Each convergent includes p/q (the rational approximation), its decimal value, and the absolute error from the true value.

### Service Logic (`services/continued_fractions.py`)

```python
from mpmath import mp, mpf, pi as mp_pi, sqrt, phi, e as mp_e, log

NAMED = {
    "pi": lambda: mp_pi,
    "e": lambda: mp_e,
    "sqrt2": lambda: sqrt(2),
    "golden_ratio": lambda: phi,
    # ...
}

def cf_expansion(x: mpf, terms: int) -> list[int]:
    """Compute continued fraction coefficients."""
    coeffs = []
    for _ in range(terms):
        a = int(x)
        coeffs.append(a)
        frac = x - a
        if frac < mpf(1e-50):
            break
        x = 1 / frac
    return coeffs

def convergents(coeffs: list[int]) -> list[dict]:
    """Compute p/q convergents from CF coefficients."""
    p_prev, p_curr = 1, coeffs[0]
    q_prev, q_curr = 0, 1
    results = [{"n": 0, "p": p_curr, "q": q_curr}]
    for i in range(1, len(coeffs)):
        p_prev, p_curr = p_curr, coeffs[i] * p_curr + p_prev
        q_prev, q_curr = q_curr, coeffs[i] * q_curr + q_prev
        results.append({"n": i, "p": p_curr, "q": q_curr})
    return results
```

Use `mpmath` with 50+ digits of precision to avoid floating-point artifacts in the coefficients.

### Input Validation

- `terms`: 1–100.
- `custom` value: must be a valid decimal number, not an integer (CF of an integer is trivial).

## Frontend (`tools/ContinuedFractions.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| Value | Dropdown + custom input | π | named constants or custom |
| Terms | Slider | 20 | 1 – 50 |

### Visualization: Number Line View

- A horizontal number line (SVG) centered on the true value.
- Each convergent is a labeled tick mark that "snaps" toward the true value.
- Odd-indexed convergents approach from below, even from above — show this with color coding (blue above, red below).
- Animate: convergents appear one at a time, with each new one landing closer to the target. The error shrinks visibly.
- Zoom into the region near the true value as convergents get closer (progressive zoom).

### Visualization: Stern-Brocot Tree (Optional/Toggle)

- Render the top few levels of the Stern-Brocot tree as a binary tree (SVG, D3 tree layout).
- Highlight the path from 0/1 → 1/0 down to each convergent.
- The path encodes the CF coefficients: a₀ rights, a₁ lefts, a₂ rights, etc.

### Coefficient Bar Chart

- Below the main visualization, show a bar chart of the CF coefficients.
- Large coefficients (like 292 in π) mean the previous convergent was already very good. Highlight these visually.

## Implementation Steps

1. Implement `services/continued_fractions.py` with mpmath. Test against known CFs (π = [3;7,15,1,292,...], φ = [1;1,1,1,...]).
2. Create `routers/continued_fractions.py`.
3. Build `tools/ContinuedFractions.tsx` — number line visualization with D3.
4. Add animation (convergents appearing sequentially).
5. Add coefficient bar chart below.
6. Add Stern-Brocot tree view (toggle).
7. Add custom number input.

## Open Questions

1. **Custom irrational input:** How does the user enter an irrational number? They can only type a decimal approximation, which limits CF accuracy. Should we support symbolic expressions like `sqrt(5)` or `(1+sqrt(5))/2`? This would require a parser (sympy can handle it).
2. **Comparison mode:** Show two numbers' convergents side by side to compare approximation rates? E.g., π vs e. This adds a second series to the number line.
3. **Best rational approximations:** Should we distinguish between convergents and *best rational approximations* (which include semiconvergents)? Mathematically interesting but adds complexity.
4. **Stern-Brocot tree depth:** For large coefficients (like 292), the path requires 292 steps in one direction. The tree view would need to compress or skip these long runs. How to handle visually?
