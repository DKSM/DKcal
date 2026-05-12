// HTML template for the DKcal printable export.
// All CSS and data are inlined so the page prints without external dependencies.

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDateLong(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtDateShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtNum(n, decimals = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return (Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals))
    .toFixed(decimals).replace('.', ',');
}

function renderChartBars(days, maintenance, goalTarget) {
  // Build Y scale based on max kcal observed (or maintenance), with 4 grid ticks
  const observed = Math.max(...days.map(d => d.kcal || 0), 0);
  const max = Math.max(observed, maintenance || 0, 1500);
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];

  const maintLinePct = maintenance ? (maintenance / max) * 100 : null;
  const goalLinePct = goalTarget ? (goalTarget / max) * 100 : null;

  const bars = days.map(d => {
    const k = d.kcal || 0;
    const heightPct = max > 0 ? (k / max) * 100 : 0;
    let color = '#22c55e'; // under goal: green
    if (maintenance && k > maintenance) color = '#dc2626'; // over maintenance: red
    else if (goalTarget && k > goalTarget) color = '#fb923c'; // over goal but under maintenance
    else if (k === 0) color = '#d1d5db'; // no data: light gray
    const label = `${d.date.slice(5)} : ${Math.round(k)} kcal`;
    return `<div class="bar" title="${esc(label)}">
      <div class="bar-fill" style="height:${heightPct.toFixed(2)}%; background:${color};"></div>
    </div>`;
  }).join('');

  const stride = Math.max(1, Math.ceil(days.length / 10));
  const xLabels = days.map((d, i) =>
    `<div class="x-tick" style="visibility:${i % stride === 0 ? 'visible' : 'hidden'}">${d.date.slice(5)}</div>`
  ).join('');

  const yLabels = ticks.slice().reverse().map(t =>
    `<div class="y-tick">${Math.round(t)}</div>`
  ).join('');

  let overlays = '';
  if (maintLinePct != null) {
    overlays += `<div class="hline hline-maint" style="bottom:${maintLinePct.toFixed(2)}%" title="Maintien ${Math.round(maintenance)} kcal"></div>`;
  }
  if (goalLinePct != null && goalTarget !== maintenance) {
    overlays += `<div class="hline hline-goal" style="bottom:${goalLinePct.toFixed(2)}%" title="Objectif ${Math.round(goalTarget)} kcal"></div>`;
  }

  return `
    <div class="chart">
      <div class="chart-grid">
        <div class="chart-y-axis">${yLabels}</div>
        <div class="chart-plot">
          <div class="chart-gridlines">
            ${ticks.map(() => '<div class="gridline"></div>').join('')}
          </div>
          ${overlays}
          <div class="chart-bars">${bars}</div>
        </div>
      </div>
      <div class="chart-x-axis">
        <div class="chart-x-spacer"></div>
        <div class="chart-x-labels">${xLabels}</div>
      </div>
    </div>
  `;
}

function renderWeightChart(days) {
  const points = days.filter(d => d.weight != null);
  if (points.length < 2) return '';

  const weights = points.map(p => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const padding = range * 0.15;
  const yMin = min - padding;
  const yMax = max + padding;
  const yRange = yMax - yMin;

  // Map every day to an X position so the weight line aligns with the kcal chart
  const totalDays = days.length;
  const W = 100; // percent width
  const H = 100; // percent height

  const polyPoints = points.map(p => {
    const idx = days.findIndex(d => d.date === p.date);
    const x = (idx / (totalDays - 1)) * W;
    const y = H - ((p.weight - yMin) / yRange) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const dots = points.map(p => {
    const idx = days.findIndex(d => d.date === p.date);
    const x = (idx / (totalDays - 1)) * W;
    const y = H - ((p.weight - yMin) / yRange) * H;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.4" fill="#0ea5e9" />`;
  }).join('');

  return `
    <div class="chart-mini">
      <div class="chart-mini-y">
        <span>${fmtNum(yMax, 1)} kg</span>
        <span>${fmtNum(yMin, 1)} kg</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart-mini-svg">
        <polyline points="${polyPoints}" fill="none" stroke="#0ea5e9" stroke-width="0.6" />
        ${dots}
      </svg>
    </div>
  `;
}

module.exports = function renderExportPrint(data) {
  const { user, from, to, summary, days, profile, generated_at } = data;

  const maintenance = profile.maintenanceCalories || 0;
  const deficitPct = profile.deficitPct != null ? profile.deficitPct : 100;
  const goalTarget = maintenance && deficitPct < 100 ? Math.round(maintenance * deficitPct / 100) : 0;

  const title = `Rapport DKcal · ${from} → ${to}`;

  const totalEnergy = summary.avg_kcal
    ? summary.avg_kcal * 4 + summary.avg_protein * 4 + summary.avg_fat * 9 + summary.avg_carbs * 4
    : 0;
  // % of kcal coming from each macro (using kcal-equivalents)
  const proteinKcal = (summary.avg_protein || 0) * 4;
  const fatKcal = (summary.avg_fat || 0) * 9;
  const carbsKcal = (summary.avg_carbs || 0) * 4;
  const sumMacroKcal = proteinKcal + fatKcal + carbsKcal;
  const pPct = sumMacroKcal ? Math.round((proteinKcal / sumMacroKcal) * 100) : 0;
  const fPct = sumMacroKcal ? Math.round((fatKcal / sumMacroKcal) * 100) : 0;
  const cPct = sumMacroKcal ? Math.round((carbsKcal / sumMacroKcal) * 100) : 0;

  // Stat cards
  const summaryCards = [
    {
      label: 'Calories / jour (moy.)',
      value: `${fmtNum(summary.avg_kcal)} kcal`,
      warn: maintenance && summary.avg_kcal > maintenance,
      hint: maintenance ? `Maintien : ${maintenance} kcal` : '',
    },
    {
      label: 'Protéines / jour (moy.)',
      value: `${fmtNum(summary.avg_protein, 1)} g`,
      warn: false,
      hint: `${pPct}% des kcal`,
    },
    {
      label: 'Lipides / jour (moy.)',
      value: `${fmtNum(summary.avg_fat, 1)} g`,
      warn: false,
      hint: `${fPct}% des kcal`,
    },
    {
      label: 'Glucides / jour (moy.)',
      value: `${fmtNum(summary.avg_carbs, 1)} g`,
      warn: false,
      hint: `${cPct}% des kcal`,
    },
    {
      label: 'Jours suivis',
      value: `${summary.tracked_days} / ${summary.total_days}`,
      warn: false,
      hint: summary.tracked_days < summary.total_days ? `${summary.total_days - summary.tracked_days} jour(s) sans donnée` : '',
    },
    goalTarget
      ? {
        label: 'Jours sous objectif',
        value: `${summary.under_goal_days} / ${summary.tracked_days}`,
        warn: summary.tracked_days && summary.under_goal_days / summary.tracked_days < 0.5,
        hint: `Objectif : ${goalTarget} kcal (${deficitPct}%)`,
      }
      : {
        label: 'Jour le plus chargé',
        value: summary.max_kcal_day ? `${Math.round(summary.max_kcal_day.kcal)} kcal` : '—',
        warn: false,
        hint: summary.max_kcal_day ? fmtDateLong(summary.max_kcal_day.date) : '',
      },
  ];

  if (summary.weight_start != null && summary.weight_end != null) {
    const diff = summary.weight_end - summary.weight_start;
    const sign = diff > 0 ? '+' : '';
    summaryCards.push({
      label: 'Évolution du poids',
      value: `${sign}${fmtNum(diff, 1)} kg`,
      warn: false,
      hint: `${fmtNum(summary.weight_start, 1)} → ${fmtNum(summary.weight_end, 1)} kg`,
    });
  }

  const summaryHtml = summaryCards.map(c => `
    <div class="stat ${c.warn ? 'warn' : ''}">
      <div class="stat-label">${esc(c.label)}</div>
      <div class="stat-value">${esc(c.value)}</div>
      ${c.hint ? `<div class="stat-hint">${esc(c.hint)}</div>` : ''}
    </div>
  `).join('');

  const tableRows = days.map(d => {
    if (!d.tracked) {
      return `<tr class="is-empty">
        <td>${esc(fmtDateShort(d.date))}</td>
        <td colspan="5" class="td-empty">Aucune donnée</td>
        <td>${d.weight != null ? `${fmtNum(d.weight, 1)} kg` : '—'}</td>
      </tr>`;
    }
    const overMaint = maintenance && d.kcal > maintenance;
    const underGoal = goalTarget && d.kcal <= goalTarget;
    const cls = overMaint ? 'is-over' : (underGoal ? 'is-under' : '');
    let flag = '';
    if (overMaint) flag = `> maintien`;
    else if (goalTarget && underGoal) flag = `✓ obj`;
    else if (goalTarget && !underGoal) flag = `obj +${Math.round(d.kcal - goalTarget)}`;

    return `<tr class="${cls}">
      <td>${esc(fmtDateShort(d.date))}</td>
      <td><strong>${Math.round(d.kcal)}</strong></td>
      <td>${fmtNum(d.protein, 1)} g</td>
      <td>${fmtNum(d.fat, 1)} g</td>
      <td>${fmtNum(d.carbs, 1)} g</td>
      <td class="td-flag">${esc(flag)}</td>
      <td>${d.weight != null ? `${fmtNum(d.weight, 1)} kg` : '—'}</td>
    </tr>`;
  }).join('');

  const profileMeta = [];
  if (profile.sex) profileMeta.push(`<div><strong>Sexe :</strong> ${esc(profile.sex === 'male' ? 'Homme' : profile.sex === 'female' ? 'Femme' : profile.sex)}</div>`);
  if (profile.age) profileMeta.push(`<div><strong>Âge :</strong> ${esc(profile.age)} ans</div>`);
  if (profile.height) profileMeta.push(`<div><strong>Taille :</strong> ${esc(profile.height)} cm</div>`);
  if (profile.weight) profileMeta.push(`<div><strong>Poids actuel :</strong> ${esc(profile.weight)} kg</div>`);
  if (profile.activityLevel) profileMeta.push(`<div><strong>Activité :</strong> ${esc(profile.activityLevel)}</div>`);
  if (maintenance) profileMeta.push(`<div><strong>Maintien :</strong> ${maintenance} kcal/j</div>`);
  if (goalTarget) profileMeta.push(`<div><strong>Objectif :</strong> ${goalTarget} kcal/j (déficit ${100 - deficitPct}%)</div>`);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #f4f4f6; }
    body {
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: #111;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      padding: 20px 0 60px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      background: white;
      margin: 0 auto;
      padding: 16mm 18mm;
      box-shadow: 0 2px 16px rgba(0,0,0,0.12);
    }

    /* Toolbar */
    .toolbar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 10; }
    .btn-print {
      background: #111; color: white; border: none; padding: 10px 18px;
      border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: inline-flex; align-items: center; gap: 8px; transition: transform 0.15s;
    }
    .btn-print:hover { transform: translateY(-1px); }
    .btn-print svg { width: 16px; height: 16px; }
    .btn-back {
      background: white; color: #111; border: 1px solid #ddd; padding: 10px 14px;
      border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
      font-family: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Header */
    .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 18px; }
    .header h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 8px; }
    .meta { display: flex; gap: 24px; flex-wrap: wrap; font-size: 12px; color: #444; }
    .meta strong { color: #111; }

    /* Profile bar */
    .profile-bar {
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 16px;
      font-size: 11px; color: #444; margin-bottom: 18px;
    }
    .profile-bar strong { color: #111; }

    /* Stats grid */
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }
    .stat { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
    .stat.warn { border-color: #c9243f; background: #fff5f5; }
    .stat-label {
      font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em;
      color: #555; margin-bottom: 4px;
    }
    .stat-value {
      font-size: 18px; font-weight: 700; color: #111;
      font-family: 'JetBrains Mono', monospace;
    }
    .stat.warn .stat-value { color: #c9243f; }
    .stat-hint { font-size: 10px; color: #666; margin-top: 3px; font-style: italic; }
    .stat.warn .stat-hint { color: #c9243f; }

    /* Section title */
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: #222; border-bottom: 1px solid #ccc;
      padding-bottom: 4px; margin-bottom: 10px;
    }

    /* Macro repartition bar */
    .macro-bar {
      display: flex; height: 18px; border-radius: 4px; overflow: hidden;
      margin-bottom: 6px; border: 1px solid #ddd;
    }
    .macro-bar div { display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600; color: white; }
    .macro-bar .p { background: #4facfe; }
    .macro-bar .f { background: #f59e0b; }
    .macro-bar .c { background: #22c55e; }
    .macro-legend { display: flex; gap: 14px; font-size: 10.5px; color: #555; }
    .macro-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

    /* Chart */
    .chart { width: 100%; font-size: 9px; }
    .chart-grid { display: flex; gap: 6px; align-items: stretch; height: 110px; }
    .chart-y-axis {
      display: flex; flex-direction: column; justify-content: space-between;
      align-items: flex-end; width: 30px; color: #777;
      font-family: 'JetBrains Mono', monospace;
    }
    .chart-plot {
      flex: 1; position: relative; border-left: 1px solid #ccc;
      border-bottom: 1px solid #ccc; padding: 0 1px;
    }
    .chart-gridlines {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      justify-content: space-between; pointer-events: none;
    }
    .gridline { height: 1px; background: #eee; }
    .chart-bars {
      position: relative; height: 100%; display: flex; align-items: flex-end;
      gap: 1px; z-index: 1;
    }
    .bar { flex: 1; height: 100%; display: flex; align-items: flex-end; min-width: 2px; }
    .bar-fill { width: 100%; min-height: 1px; border-radius: 1px 1px 0 0; }
    .hline {
      position: absolute; left: 0; right: 0; height: 0;
      border-top: 1px dashed; z-index: 2;
    }
    .hline-maint { border-color: #c9243f; }
    .hline-goal { border-color: #16a34a; }
    .chart-x-axis { display: flex; gap: 6px; margin-top: 4px; }
    .chart-x-spacer { width: 30px; flex-shrink: 0; }
    .chart-x-labels { flex: 1; display: flex; gap: 1px; }
    .x-tick {
      flex: 1; text-align: center; font-size: 8px; color: #777;
      font-family: 'JetBrains Mono', monospace; white-space: nowrap;
    }
    .chart-hlegend {
      display: flex; gap: 16px; margin-top: 8px; font-size: 10px; color: #555;
      padding-left: 36px;
    }
    .chart-hlegend .lk { display: inline-block; width: 16px; border-top: 1px dashed; vertical-align: 3px; margin-right: 4px; }

    /* Weight chart */
    .chart-mini {
      position: relative; height: 60px; display: flex; align-items: stretch;
      gap: 6px; padding-left: 30px;
    }
    .chart-mini-y {
      position: absolute; left: 0; top: 0; bottom: 0; width: 30px;
      display: flex; flex-direction: column; justify-content: space-between;
      align-items: flex-end; font-size: 8px; color: #777;
      font-family: 'JetBrains Mono', monospace;
    }
    .chart-mini-svg {
      flex: 1; width: 100%; height: 100%;
      border-left: 1px solid #ccc; border-bottom: 1px solid #ccc;
    }

    /* Legend */
    .legend ul { font-size: 11px; line-height: 1.55; padding-left: 18px; }
    .legend li { list-style: disc; margin-bottom: 3px; color: #333; }
    .legend strong { color: #111; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid #eee; }
    th {
      background: #f5f5f5; font-weight: 600; color: #111;
      text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.04em;
    }
    tbody tr.is-under td { color: #166534; background: #f0fdf4; }
    tbody tr.is-over td { color: #b91c1c; background: #fef2f2; }
    tbody tr.is-empty td { color: #999; }
    .td-empty { font-style: italic; }
    .td-flag { font-weight: 600; white-space: nowrap; }

    /* Footer */
    .footer {
      margin-top: 22px; padding-top: 10px; border-top: 1px solid #ccc;
      font-size: 10px; color: #666; font-style: italic;
    }

    /* Print */
    @media print {
      @page { size: A4; margin: 14mm 16mm; }
      html, body { background: white; padding: 0; }
      .toolbar { display: none !important; }
      .page {
        width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none;
      }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      .stat, .header, .chart, .chart-mini { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-back" onclick="window.close()" type="button">Fermer</button>
    <button class="btn-print" onclick="window.print()" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimer / Enregistrer en PDF
    </button>
  </div>

  <div class="page">
    <header class="header">
      <h1>Suivi nutritionnel — ${esc(user.username)}</h1>
      <div class="meta">
        <div><strong>Période :</strong> ${esc(fmtDateLong(from))} – ${esc(fmtDateLong(to))}</div>
        <div><strong>Édité le :</strong> ${esc(new Date(generated_at).toLocaleDateString('fr-FR'))}</div>
      </div>
    </header>

    ${profileMeta.length ? `<div class="profile-bar">${profileMeta.join('')}</div>` : ''}

    <div class="summary">${summaryHtml}</div>

    ${sumMacroKcal ? `
    <section class="section">
      <h2 class="section-title">Répartition des macros (moyenne sur la période)</h2>
      <div class="macro-bar">
        ${pPct > 0 ? `<div class="p" style="width:${pPct}%">P ${pPct}%</div>` : ''}
        ${fPct > 0 ? `<div class="f" style="width:${fPct}%">L ${fPct}%</div>` : ''}
        ${cPct > 0 ? `<div class="c" style="width:${cPct}%">G ${cPct}%</div>` : ''}
      </div>
      <div class="macro-legend">
        <span><span class="dot" style="background:#4facfe"></span>Protéines · ${fmtNum(summary.avg_protein, 1)} g/j (${pPct}%)</span>
        <span><span class="dot" style="background:#f59e0b"></span>Lipides · ${fmtNum(summary.avg_fat, 1)} g/j (${fPct}%)</span>
        <span><span class="dot" style="background:#22c55e"></span>Glucides · ${fmtNum(summary.avg_carbs, 1)} g/j (${cPct}%)</span>
      </div>
    </section>
    ` : ''}

    <section class="section">
      <h2 class="section-title">Tendance journalière (kcal)</h2>
      ${renderChartBars(days, maintenance, goalTarget)}
      ${(maintenance || goalTarget) ? `
        <div class="chart-hlegend">
          ${goalTarget ? `<span><span class="lk" style="border-color:#16a34a"></span>Objectif ${goalTarget} kcal</span>` : ''}
          ${maintenance ? `<span><span class="lk" style="border-color:#c9243f"></span>Maintien ${maintenance} kcal</span>` : ''}
        </div>
      ` : ''}
    </section>

    ${summary.weight_start != null && summary.weight_end != null ? `
    <section class="section">
      <h2 class="section-title">Évolution du poids</h2>
      ${renderWeightChart(days)}
    </section>
    ` : ''}

    <section class="section">
      <h2 class="section-title">Détail journalier</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Kcal</th>
            <th>Protéines</th>
            <th>Lipides</th>
            <th>Glucides</th>
            <th></th>
            <th>Poids</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>

    <footer class="footer">
      Document généré par DKcal.
    </footer>
  </div>
</body>
</html>`;
};
