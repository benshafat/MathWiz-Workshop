import cache
from fastapi import APIRouter, HTTPException
from sympy import factorint, isprime

router = APIRouter(prefix="/api", tags=["prime-tree"])


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
    if n < 3 or n > 10**12:
        raise HTTPException(status_code=422, detail="n must be between 3 and 10^12")

    key = f"prime_tree:{n}"
    data = cache.get(key)
    if data is not None:
        return data

    data = {
        "n_minus_1": build_tree(n - 1),
        "n": build_tree(n),
        "n_plus_1": build_tree(n + 1),
    }
    cache.set(key, data)
    return data
