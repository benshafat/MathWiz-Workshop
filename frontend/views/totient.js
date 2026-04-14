window.Views = window.Views || {};

window.Views.totient = {
  _debounceTimer: null,

  async mount(container) {
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <label>
        Limit:
        <input type="range" id="tot-limit-slider" min="100" max="10000" step="100" value="10000" style="width:200px" />
        <span id="tot-limit-display">10000</span>
      </label>
    `;
    container.appendChild(controls);

    const chartDiv = document.createElement('div');
    chartDiv.id = 'tot-chart';
    container.appendChild(chartDiv);

    const slider  = controls.querySelector('#tot-limit-slider');
    const display = controls.querySelector('#tot-limit-display');

    const self = this;

    slider.addEventListener('input', function() {
      display.textContent = slider.value;
      clearTimeout(self._debounceTimer);
      self._debounceTimer = setTimeout(async function() {
        try {
          const data = await window.API.fetchTotient(parseInt(slider.value, 10));
          window.Views.totient.render(data, chartDiv);
        } catch (err) {
          chartDiv.textContent = 'Error: ' + (err.message || err);
        }
      }, 300);
    });

    // Initial fetch
    const data = await window.API.fetchTotient(10000);
    window.Views.totient.render(data, chartDiv);
  },

  render(data, container) {
    container.innerHTML = '';

    // data: array of {n, phi}
    const points = (Array.isArray(data) ? data : (data.values || data.data || []));
    if (!points.length) { container.textContent = 'No data.'; return; }

    const limit = points[points.length - 1].n || points.length;

    // Enrich client-side
    points.forEach(function(d) {
      d.isPrime = (d.phi === d.n - 1 && d.n > 1);
      d.ratio   = d.phi / d.n;
    });

    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const totalW = (container.clientWidth || 900);
    const totalH = 480;
    const width  = totalW - margin.left - margin.right;
    const height = totalH - margin.top  - margin.bottom;

    const xScale = d3.scaleLinear().domain([1, limit]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, limit]).range([height, 0]);

    const svg = d3.create('svg')
      .attr('width', '100%')
      .attr('height', totalH)
      .style('background', '#0f172a')
      .style('display', 'block');

    const g = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Axes
    g.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(xScale).ticks(8))
      .call(function(ax) {
        ax.selectAll('text').attr('fill', '#94a3b8');
        ax.selectAll('line,path').attr('stroke', '#475569');
      });

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(8))
      .call(function(ax) {
        ax.selectAll('text').attr('fill', '#94a3b8');
        ax.selectAll('line,path').attr('stroke', '#475569');
      });

    // Axis labels
    g.append('text')
      .attr('x', width / 2).attr('y', height + 42)
      .attr('text-anchor', 'middle').attr('fill', '#94a3b8').attr('font-size', 13)
      .text('n');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -45)
      .attr('text-anchor', 'middle').attr('fill', '#94a3b8').attr('font-size', 13)
      .text('\u03c6(n)');

    // Dots — render in three layers (slate, indigo, orange) for correct visual priority
    function dotColor(d) {
      if (d.isPrime)      return '#f97316';
      if (d.ratio < 0.35) return '#818cf8';
      return '#94a3b8';
    }

    // Draw all dots
    g.selectAll('.tot-dot')
      .data(points)
      .join('circle')
      .attr('class', 'tot-dot')
      .attr('r', 1.5)
      .attr('cx', function(d) { return xScale(d.n); })
      .attr('cy', function(d) { return yScale(d.phi); })
      .attr('fill', function(d) { return dotColor(d); })
      .attr('opacity', 0.7);

    // Invisible wider hit targets for tooltip
    var tooltip = document.getElementById('tot-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'tot-tooltip';
      Object.assign(tooltip.style, {
        position: 'fixed', background: '#1e293b', color: '#f8fafc',
        border: '1px solid #475569', padding: '8px 12px', borderRadius: '6px',
        fontSize: '13px', pointerEvents: 'none', display: 'none', zIndex: '9999'
      });
      document.body.appendChild(tooltip);
    }

    // Overlay rect to capture mouse for nearest-point tooltip
    const overlay = g.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    // Build x-indexed lookup for fast nearest search
    const byN = {};
    points.forEach(function(d) { byN[d.n] = d; });

    overlay.on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      const nVal = Math.round(xScale.invert(mx));
      const d    = byN[nVal];
      if (!d) { tooltip.style.display = 'none'; return; }
      tooltip.innerHTML =
        '<strong>n = ' + d.n + '</strong><br>' +
        '\u03c6(n) = ' + d.phi + '<br>' +
        '\u03c6(n)/n = ' + d.ratio.toFixed(4) +
        (d.isPrime ? '<br><em style="color:#f97316">prime</em>' : '');
      tooltip.style.display = 'block';
      tooltip.style.left = (event.clientX + 14) + 'px';
      tooltip.style.top  = (event.clientY - 10) + 'px';
    }).on('mouseleave', function() {
      tooltip.style.display = 'none';
    });

    container.appendChild(svg.node());
  }
};
