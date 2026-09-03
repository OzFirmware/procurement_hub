import { esc } from '../ui.js';

// Small, dependency-free chart primitives. Bars are plain HTML/CSS (real
// text, no SVG-label collisions to fight); the trend line is SVG since it
// genuinely needs x/y geometry. Both take pre-aggregated {label, value}-ish
// rows — the metrics.js layer owns filtering/currency/aggregation, these
// just draw. Single-series bars use one hue (magnitude, not identity); pass
// `colorOf` only for a chart that's inherently categorical (status).

// rows: [{label, value, sub?}]. valueFmt formats the number for display;
// colorOf(row) picks a bar color, defaults to the brand hue for every row
// (a ranked magnitude list has one series, not one per bar).
export function barListHtml(rows, { valueFmt = String, colorOf } = {}) {
  if (!rows.length) return '<div class="chart-empty">Not enough data yet.</div>';
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="barlist">${rows.map(r => {
    const pct = Math.max(r.value / max * 100, r.value > 0 ? 2 : 0);
    const color = colorOf ? colorOf(r) : 'var(--brand)';
    const title = `${r.label}: ${valueFmt(r.value)}${r.sub ? ' · ' + r.sub : ''}`;
    return `<div class="barrow" title="${esc(title)}">
      <span class="barlabel">${esc(r.label)}</span>
      <span class="bartrack"><span class="barfill" style="width:${pct.toFixed(1)}%;background:${color}"></span></span>
      <span class="barval">${esc(valueFmt(r.value))}</span>
    </div>`;
  }).join('')}</div>`;
}

// points: [{month:'2026-06', value}], already sorted ascending by month.
export function lineChartSvg(points, { valueFmt = String, width = 640, height = 170 } = {}) {
  if (points.length < 2) return '<div class="chart-empty">Not enough months yet to plot a trend.</div>';
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const innerW = width - pad.l - pad.r, innerH = height - pad.t - pad.b;
  const maxY = Math.max(...points.map(p => p.value), 1);
  const xStep = innerW / (points.length - 1);
  const x = i => pad.l + i * xStep;
  const y = v => pad.t + innerH - (v / maxY) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)} ${pad.t + innerH} L${x(0).toFixed(1)} ${pad.t + innerH} Z`;
  const gridLines = [0, 0.5, 1].map(f =>
    `<line x1="${pad.l}" x2="${width - pad.r}" y1="${(pad.t + innerH * (1 - f)).toFixed(1)}" y2="${(pad.t + innerH * (1 - f)).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`
  ).join('');
  // label every Nth month so labels never overlap, always including the last
  const labelEvery = Math.ceil(points.length / 6) || 1;
  const labels = points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1)
    ? `<text x="${x(i).toFixed(1)}" y="${height - 6}" font-size="9.5" fill="var(--mut)" text-anchor="middle">${esc(p.month.slice(2))}</text>`
    : '').join('');
  const dots = points.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3" fill="var(--brand)" stroke="var(--panel)" stroke-width="1.5"><title>${esc(p.month)}: ${esc(valueFmt(p.value))}</title></circle>`
  ).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-line" role="img" aria-label="Monthly trend" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    <path d="${area}" fill="var(--brand-soft)" stroke="none"/>
    <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${labels}
  </svg>`;
}
