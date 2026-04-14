window.Views = window.Views || {};

window.Views.recaman = {
  _debounceTimer: null,

  async mount(container) {
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <label>
        Terms:
        <input type="range" id="rec-terms-slider" min="10" max="300" step="10" value="100" style="width:200px" />
        <span id="rec-terms-display">100</span>
      </label>
    `;
    container.appendChild(controls);

    const chartDiv = document.createElement('div');
    chartDiv.id = 'rec-chart';
    container.appendChild(chartDiv);

    const slider  = controls.querySelector('#rec-terms-slider');
    const display = controls.querySelector('#rec-terms-display');
    const self    = this;

    slider.addEventListener('input', function() {
      display.textContent = slider.value;
      clearTimeout(self._debounceTimer);
      self._debounceTimer = setTimeout(async function() {
        try {
          const data = await window.API.fetchRecaman(parseInt(slider.value, 10));
          window.Views.recaman.render(data, chartDiv);
        } catch (err) {
          chartDiv.textContent = 'Error: ' + (err.message || err);
        }
      }, 250);
    });

    // Initial fetch
    const data = await window.API.fetchRecaman(100);
    window.Views.recaman.render(data, chartDiv);
  },

  render(data, container) {
    container.innerHTML = '';

    // Expected: { arcs: [{from, to, direction, step}], max_value, sequence }
    const arcs      = data.arcs || [];
    const maxValue  = data.max_value || 0;
    const sequence  = data.sequence || [];

    if (!arcs.length && !maxValue) {
      container.textContent = 'No data received.';
      return;
    }

    const margin   = { top: 20, right: 20, bottom: 30, left: 20 };
    const totalW   = (container.clientWidth || 900);
    // Split SVG height evenly: above-line half + baseline + below-line half
    const halfH    = 180;
    const totalH   = halfH * 2 + 40; // room for number line in the middle
    const yBase    = halfH + 20;      // y-coordinate of the number line

    const width    = totalW - margin.left - margin.right;

    const xScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([margin.left, margin.left + width]);

    const svg = d3.create('svg')
      .attr('width', '100%')
      .attr('height', totalH)
      .style('background', '#0f172a')
      .style('display', 'block');

    // Number line
    svg.append('line')
      .attr('x1', xScale(0)).attr('x2', xScale(maxValue))
      .attr('y1', yBase).attr('y2', yBase)
      .attr('stroke', '#475569').attr('stroke-width', 1.5);

    // Arc path helper (semi-ellipse)
    function arcPath(fromVal, toVal, above) {
      const x1 = xScale(fromVal);
      const x2 = xScale(toVal);
      const r  = Math.abs(x2 - x1) / 2;
      // sweep-flag: 1 draws clockwise (below), 0 counter-clockwise (above)
      const sweep = above ? 1 : 0;
      return 'M' + x1 + ',' + yBase +
             ' A' + r + ',' + r + ',0,0,' + sweep + ',' + x2 + ',' + yBase;
    }

    // Draw arcs — backward arcs go above line, forward arcs go below
    svg.selectAll('.rec-arc')
      .data(arcs)
      .join('path')
      .attr('class', 'rec-arc')
      .attr('fill', 'none')
      .attr('stroke', function(d) {
        return d.direction === 'backward' ? '#2dd4bf' : '#f87171';
      })
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.75)
      .attr('d', function(d) {
        const above = d.direction === 'backward';
        return arcPath(d.from, d.to, above);
      });

    // Visited value dots on the number line
    const visited = new Set();
    if (sequence.length) {
      sequence.forEach(function(v) { visited.add(v); });
    } else {
      arcs.forEach(function(a) { visited.add(a.from); visited.add(a.to); });
    }

    svg.selectAll('.rec-dot')
      .data(Array.from(visited))
      .join('circle')
      .attr('class', 'rec-dot')
      .attr('cx', function(v) { return xScale(v); })
      .attr('cy', yBase)
      .attr('r', 2.5)
      .attr('fill', '#f8fafc')
      .attr('opacity', 0.85);

    // Legend
    const legend = svg.append('g').attr('transform', 'translate(' + (margin.left + 10) + ',12)');
    legend.append('line').attr('x1', 0).attr('x2', 24).attr('y1', 8).attr('y2', 8)
      .attr('stroke', '#2dd4bf').attr('stroke-width', 2);
    legend.append('text').attr('x', 30).attr('y', 12)
      .attr('fill', '#94a3b8').attr('font-size', 12).text('backward step');
    legend.append('line').attr('x1', 140).attr('x2', 164).attr('y1', 8).attr('y2', 8)
      .attr('stroke', '#f87171').attr('stroke-width', 2);
    legend.append('text').attr('x', 170).attr('y', 12)
      .attr('fill', '#94a3b8').attr('font-size', 12).text('forward step');

    // X-axis tick marks (sparse)
    const tickCount = Math.min(10, Math.floor(maxValue / 10));
    const tickStep  = Math.ceil(maxValue / tickCount / 10) * 10;
    const ticks     = d3.range(0, maxValue + 1, tickStep);
    svg.selectAll('.rec-tick')
      .data(ticks)
      .join('g')
      .attr('class', 'rec-tick')
      .attr('transform', function(v) { return 'translate(' + xScale(v) + ',' + yBase + ')'; })
      .call(function(sel) {
        sel.append('line').attr('y1', 0).attr('y2', 6).attr('stroke', '#475569');
        sel.append('text').attr('y', 18).attr('text-anchor', 'middle')
          .attr('fill', '#64748b').attr('font-size', 10).text(function(v) { return v; });
      });

    container.appendChild(svg.node());
  }
};
