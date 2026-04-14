import cache
import sympy as sp
from sympy import continued_fraction_iterator, continued_fraction_convergents, N
from itertools import islice
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["cont-fraction"])

x = sp.Symbol("x")

PRESETS: dict = {
    "pi":      sp.pi,
    "e":       sp.E,
    "sqrt2":   sp.sqrt(2),
    "sqrt3":   sp.sqrt(3),
    "sqrt5":   sp.sqrt(5),
    "phi":     (1 + sp.sqrt(5)) / 2,
    "ln2":     sp.log(2),
    "gamma":   sp.EulerGamma,
    "apery":   sp.zeta(3),
    "plastic": sp.CRootOf(x**3 - x - 1, 0),
}

PRESET_NAMES: dict = {
    "pi":      "π (Pi)",
    "e":       "e (Euler's number)",
    "sqrt2":   "√2",
    "sqrt3":   "√3",
    "sqrt5":   "√5",
    "phi":     "φ (Golden Ratio)",
    "ln2":     "ln(2)",
    "gamma":   "γ (Euler-Mascheroni)",
    "apery":   "ζ(3) (Apéry's constant)",
    "plastic": "Plastic constant",
}


def compute_cf(number_key: str, depth: int) -> dict:
    expr = PRESETS[number_key]
    coefficients = list(islice(continued_fraction_iterator(expr), depth))
    convergents = []
    for i, (p, q) in enumerate(continued_fraction_convergents(coefficients)):
        convergents.append({
            "index": i,
            "p": str(p),
            "q": str(q),
            "decimal_approx": float(N(p / q, 15)),
        })
    true_value = float(N(expr, 15))
    return {
        "number": number_key,
        "display_name": PRESET_NAMES[number_key],
        "true_value": true_value,
        "coefficients": [int(c) for c in coefficients],
        "convergents": convergents,
    }


@router.get("/continued-fraction/presets")
def continued_fraction_presets():
    return [
        {"key": key, "display_name": PRESET_NAMES[key]}
        for key in PRESETS
    ]


@router.get("/continued-fraction")
def continued_fraction(
    number: str = Query(default="pi"),
    depth: int = Query(default=10, ge=1, le=50),
):
    if number not in PRESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown number '{number}'. Valid keys: {list(PRESETS.keys())}",
        )

    depth = max(1, min(depth, 50))
    key = f"cf:{number}:{depth}"
    data = cache.get(key)
    if data is not None:
        return data

    data = compute_cf(number, depth)
    cache.set(key, data)
    return data
