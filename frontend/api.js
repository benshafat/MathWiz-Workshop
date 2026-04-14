const BASE_URL = 'http://localhost:8001';

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || JSON.stringify(err));
  }
  return res.json();
}

window.API = {
  fetchPrimeTree: (n) =>
    apiFetch(`${BASE_URL}/api/prime-tree/${n}`),

  fetchUlamSpiral: (size) =>
    apiFetch(`${BASE_URL}/api/ulam-spiral?size=${size}`),

  fetchCollatz: (n, { k = 1, mode = 'forward', depth = 20 } = {}) =>
    apiFetch(`${BASE_URL}/api/collatz/${n}?k=${k}&mode=${mode}&depth=${depth}`),

  fetchTotient: (limit = 10000) =>
    apiFetch(`${BASE_URL}/api/totient?limit=${limit}`),

  fetchContinuedFraction: (number = 'phi', depth = 10) =>
    apiFetch(`${BASE_URL}/api/continued-fraction?number=${number}&depth=${depth}`),

  fetchContinuedFractionPresets: () =>
    apiFetch(`${BASE_URL}/api/continued-fraction/presets`),

  fetchRecaman: (terms = 100) =>
    apiFetch(`${BASE_URL}/api/recaman?terms=${terms}`),

  fetchModularWeb: (n = 200, m = 2) =>
    apiFetch(`${BASE_URL}/api/modular-web?n=${n}&m=${m}`),
};
