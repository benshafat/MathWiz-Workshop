window.Views = window.Views || {};

window.Views.modularWeb = {
  _currentN: 200,
  _currentData: null,

  async mount(container) {
    const self = this;

    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <label>
        n:
        <input type="range" id="mw-n-slider" min="2" max="300" step="1" value="200" style="width:160px" />
        <span id="mw-n-display">200</span>
      </label>
      <label>
        m:
        <input type="range" id="mw-m-slider" min="1" max="199" step="1" value="2" style="width:160px" />
        <span id="mw-m-display">2</span>
      </label>
      <button id="mw-draw-btn">Draw</button>
    `;
    container.appendChild(controls);

    const chartDiv = document.createElement('div');
    chartDiv.id = 'mw-chart';
    container.appendChild(chartDiv);

    const nSlider   = controls.querySelector('#mw-n-slider');
    const mSlider   = controls.querySelector('#mw-m-slider');
    const nDisplay  = controls.querySelector('#mw-n-display');
    const mDisplay  = controls.querySelector('#mw-m-display');
    const drawBtn   = controls.querySelector('#mw-draw-btn');

    // Keep m slider max in sync with n
    function syncMSlider(n) {
      mSlider.max = n - 1;
      if (parseInt(mSlider.value, 10) >= n) mSlider.value = n - 1;
      mDisplay.textContent = mSlider.value;
    }

    nSlider.addEventListener('input', function() {
      nDisplay.textContent = nSlider.value;
      syncMSlider(parseInt(nSlider.value, 10));
    });

    mSlider.addEventListener('input', function() {
      mDisplay.textContent = mSlider.value;
      // Client-side redraw — no API call
      const n = parseInt(nSlider.value, 10);
      const m = parseInt(mSlider.value, 10);
      window.Views.modularWeb.render(computeLines(n, m), chartDiv);
    });

    drawBtn.addEventListener('click', async function() {
      const n = parseInt(nSlider.value, 10);
      const m = parseInt(mSlider.value, 10);
      syncMSlider(n);
      try {
        const data = await window.API.fetchModularWeb(n, m);
        self._currentN    = n;
        self._currentData = data;
        window.Views.modularWeb.render(data, chartDiv);
      } catch (err) {
        chartDiv.textContent = 'Error: ' + (err.message || err);
      }
    });

    // Initial fetch
    const initN = 200, initM = 2;
    nSlider.value = initN; nDisplay.textContent = initN;
    mSlider.value = initM; mDisplay.textContent = initM;
    syncMSlider(initN);

    const data = await window.API.fetchModularWeb(initN, initM);
    self._currentN    = initN;
    self._currentData = data;
    window.Views.modularWeb.render(data, chartDiv);
  },

  render(data, container) {
    container.innerHTML = '';

    // data: { n, m, lines: [{from, to}] }  (or client-computed)
    const n     = data.n;
    const lines = data.lines || [];

    const totalW = (container.clientWidth || 600);
    const size   = Math.min(totalW, 600);   // square
    const cx     = size / 2;
    const cy     = size / 2;
    const r      = size / 2 - 30;           // circle radius

    // Precompute point positions
    function pointPos(i) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    }

    const pts = [];
    for (var i = 0; i < n; i++) pts.push(pointPos(i));

    const svg = d3.create('svg')
      .attr('width', size)
      .attr('height', size)
      .style('background', '#0f172a')
      .style('display', 'block')
      .style('margin', '0 auto');

    // Thin circle outline
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', r)
      .attr('fill', 'none').attr('stroke', '#334155').attr('stroke-width', 1);

    // Connection lines
    svg.selectAll('.mw-line')
      .data(lines)
      .join('line')
      .attr('class', 'mw-line')
      .attr('x1', function(d) { return pts[d.from].x; })
      .attr('y1', function(d) { return pts[d.from].y; })
      .attr('x2', function(d) { return pts[d.to].x; })
      .attr('y2', function(d) { return pts[d.to].y; })
      .attr('stroke', 'rgba(249,115,22,0.3)')
      .attr('stroke-width', 0.8);

    // Points on the circle
    svg.selectAll('.mw-pt')
      .data(pts)
      .join('circle')
      .attr('class', 'mw-pt')
      .attr('cx', function(d) { return d.x; })
      .attr('cy', function(d) { return d.y; })
      .attr('r', n > 100 ? 1.5 : 2.5)
      .attr('fill', '#f8fafc')
      .attr('opacity', 0.7);

    // Label in centre
    svg.append('text')
      .attr('x', cx).attr('y', cy - 10)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#475569').attr('font-size', 14)
      .text('n = ' + n);

    svg.append('text')
      .attr('x', cx).attr('y', cy + 14)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#475569').attr('font-size', 14)
      .text('m = ' + data.m);

    container.appendChild(svg.node());
  }
};

// Pure client-side computation: k -> (k * m) mod n
function computeLines(n, m) {
  const lines = [];
  for (var k = 0; k < n; k++) {
    const to = (k * m) % n;
    if (to !== k) lines.push({ from: k, to: to });
  }
  return { n: n, m: m, lines: lines };
}
