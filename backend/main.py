from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import cache

from routers import (
    prime_tree, ulam_spiral, collatz, totient,
    cont_fraction, recaman, modular_web
)

def _warm_cache():
    try:
        from routers.ulam_spiral import compute_spiral
        for size in [10, 50, 150, 249]:
            key = f"ulam:{size}"
            if not cache.get(key):
                cache.set(key, compute_spiral(size))
    except Exception as e:
        print(f"[startup] ulam spiral pre-warm skipped: {e}")

    try:
        from routers.cont_fraction import compute_cf, PRESETS
        for number_key in PRESETS:
            key = f"cf:{number_key}:20"
            if not cache.get(key):
                cache.set(key, compute_cf(number_key, 20))
    except Exception as e:
        print(f"[startup] continued fraction pre-warm skipped: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    _warm_cache()
    yield

app = FastAPI(title="MathWiz API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prime_tree.router)
app.include_router(ulam_spiral.router)
app.include_router(collatz.router)
app.include_router(totient.router)
app.include_router(cont_fraction.router)
app.include_router(recaman.router)
app.include_router(modular_web.router)
