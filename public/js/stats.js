import { createElement, todayStr, addDays, showToast } from './utils.js';
import { api } from './api.js';
import { openModal } from './modal.js';
import { adjustCal } from './profile.js';

let chartInstances = [];

export function openStatsModal() {
  openModal('Statistiques', (body, handle) => {
    handle.onClose = () => {
      chartInstances.forEach(c => c.destroy());
      chartInstances = [];
    };

    // Period selector
    const periodDiv = createElement('div', { className: 'period-selector' });
    const periods = [
      { label: '7j', days: 7 },
      { label: '30j', days: 30 },
      { label: '90j', days: 90 },
      { label: '1 an', days: 365 },
      { label: 'Custom', days: 0 },
    ];

    let activePeriod = 30;
    let minKcal = 50;
    const periodBtns = {};

    for (const p of periods) {
      const btn = createElement('button', {
        className: `period-btn${p.days === activePeriod ? ' active' : ''}`,
        textContent: p.label,
        onClick: () => {
          if (p.days === 0) {
            customRange.classList.add('active');
            return;
          }
          customRange.classList.remove('active');
          activePeriod = p.days;
          Object.values(periodBtns).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadStats(p.days);
        },
      });
      periodBtns[p.days] = btn;
      periodDiv.appendChild(btn);
    }

    // Toggle filtre jours incomplets
    const filterBtn = createElement('button', {
      className: 'period-btn filter-toggle active',
      innerHTML: '∅ <span>&lt; 50 kcal</span>',
      title: 'Exclure les jours en dessous de 50 kcal',
      onClick: () => {
        filterBtn.classList.toggle('active');
        minKcal = filterBtn.classList.contains('active') ? 50 : 0;
        if (activePeriod > 0) {
          loadStats(activePeriod);
        } else {
          loadCustomStats(fromInput.value, toInput.value);
        }
      },
    });
    periodDiv.appendChild(filterBtn);

    body.appendChild(periodDiv);

    // Custom range
    const customRange = createElement('div', { className: 'custom-range' });
    const fromInput = createElement('input', { type: 'date', value: addDays(todayStr(), -30) });
    const toInput = createElement('input', { type: 'date', value: todayStr() });
    const goBtn = createElement('button', {
      className: 'btn btn-primary btn-sm', textContent: 'OK',
      onClick: () => {
        Object.values(periodBtns).forEach(b => b.classList.remove('active'));
        periodBtns[0]?.classList.add('active');
        loadCustomStats(fromInput.value, toInput.value);
      },
    });
    customRange.appendChild(fromInput);
    customRange.appendChild(createElement('span', { textContent: '-', style: 'color: var(--text-muted);' }));
    customRange.appendChild(toInput);
    customRange.appendChild(goBtn);
    body.appendChild(customRange);

    // Charts
    const chartsDiv = createElement('div', { className: 'charts-grid' });
    body.appendChild(chartsDiv);

    // Summary
    const summaryDiv = createElement('div', { className: 'stats-summary' });
    body.appendChild(summaryDiv);

    async function loadStats(days) {
      const to = todayStr();
      const from = addDays(to, -(days - 1));
      await fetchAndRender(from, to);
    }

    async function loadCustomStats(from, to) {
      await fetchAndRender(from, to);
    }

    async function fetchAndRender(from, to) {
      try {
        const stats = await api.get(`/api/stats?from=${from}&to=${to}&minKcal=${minKcal}`);
        renderCharts(chartsDiv, stats);
        renderSummary(summaryDiv, stats.summary);
      } catch (err) {
        showToast(err.message, true);
      }
    }

    loadStats(activePeriod);
  }, { wide: true });
}

function renderCharts(container, stats) {
  container.innerHTML = '';
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  // Kcal chart
  chartInstances.push(createChart(container, 'Calories', stats.dates, [
    { label: 'kcal', data: stats.kcal.values.map(v => v != null ? adjustCal(v) : v), type: 'bar', backgroundColor: 'rgba(230, 126, 34, 0.6)', borderColor: '#e67e22', borderWidth: 1 },
    { label: 'Moy. 7j', data: stats.kcal.movingAvg.map(v => v != null ? adjustCal(v) : v), type: 'line', borderColor: '#f39c12', borderWidth: 2, pointRadius: 0, fill: false },
  ]));

  // Protein chart
  chartInstances.push(createChart(container, 'Protéines (g)', stats.dates, [
    { label: 'Protéines', data: stats.protein.values, type: 'bar', backgroundColor: 'rgba(52, 152, 219, 0.6)', borderColor: '#3498db', borderWidth: 1 },
    { label: 'Moy. 7j', data: stats.protein.movingAvg, type: 'line', borderColor: '#5dade2', borderWidth: 2, pointRadius: 0, fill: false },
  ]));

  // Fat chart
  if (stats.fat) {
    chartInstances.push(createChart(container, 'Lipides (g)', stats.dates, [
      { label: 'Lipides', data: stats.fat.values, type: 'bar', backgroundColor: 'rgba(241, 196, 15, 0.6)', borderColor: '#f1c40f', borderWidth: 1 },
      { label: 'Moy. 7j', data: stats.fat.movingAvg, type: 'line', borderColor: '#f9e154', borderWidth: 2, pointRadius: 0, fill: false },
    ]));
  }

  // Carbs chart
  if (stats.carbs) {
    chartInstances.push(createChart(container, 'Glucides (g)', stats.dates, [
      { label: 'Glucides', data: stats.carbs.values, type: 'bar', backgroundColor: 'rgba(46, 204, 113, 0.6)', borderColor: '#2ecc71', borderWidth: 1 },
      { label: 'Moy. 7j', data: stats.carbs.movingAvg, type: 'line', borderColor: '#58d68d', borderWidth: 2, pointRadius: 0, fill: false },
    ]));
  }

  // Macro ratio donut chart
  const avgP = stats.summary.avgProtein || 0;
  const avgF = stats.summary.avgFat || 0;
  const avgC = stats.summary.avgCarbs || 0;
  const pCal = avgP * 4;
  const fCal = avgF * 9;
  const cCal = avgC * 4;
  const totalMacroCal = pCal + fCal + cCal;
  if (totalMacroCal > 0) {
    const pPct = Math.round(pCal / totalMacroCal * 100);
    const fPct = Math.round(fCal / totalMacroCal * 100);
    const cPct = 100 - pPct - fPct;

    const donutWrapper = createElement('div', { className: 'chart-container chart-square' });
    donutWrapper.appendChild(createElement('div', { className: 'chart-title', textContent: 'Répartition macros (moy.)' }));
    const donutCanvas = createElement('canvas');
    donutWrapper.appendChild(donutCanvas);
    container.appendChild(donutWrapper);

    chartInstances.push(new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels: [`Protéines ${pPct}%`, `Lipides ${fPct}%`, `Glucides ${cPct}%`],
        datasets: [{
          data: [pCal, fCal, cCal],
          backgroundColor: ['rgba(52, 152, 219, 0.7)', 'rgba(241, 196, 15, 0.7)', 'rgba(46, 204, 113, 0.7)'],
          borderColor: ['#3498db', '#f1c40f', '#2ecc71'],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#a0a0a0', font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const kcal = Math.round(ctx.raw);
                const pct = Math.round(ctx.raw / totalMacroCal * 100);
                return ` ${ctx.label.split(' ')[0]}: ${kcal} kcal (${pct}%)`;
              },
            },
          },
        },
      },
    }));
  }

  // Weight chart (always shown for grid layout)
  const weightData = stats.weight.values;
  const weightDatasets = weightData.some(v => v != null) ? [
    { label: 'Poids', data: weightData, type: 'line', borderColor: '#27ae60', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#27ae60', spanGaps: false, fill: false },
    { label: 'Moy. 7j', data: stats.weight.movingAvg, type: 'line', borderColor: '#2ecc71', borderWidth: 2, pointRadius: 0, borderDash: [4, 4], fill: false },
    { label: 'Tendance', data: stats.weight.trend, type: 'line', borderColor: 'rgba(39, 174, 96, 0.4)', borderWidth: 1, pointRadius: 0, borderDash: [8, 4], fill: false },
  ] : [
    { label: 'Poids', data: weightData, type: 'line', borderColor: '#27ae60', borderWidth: 2, pointRadius: 0, fill: false },
  ];
  chartInstances.push(createChart(container, 'Poids (kg)', stats.dates, weightDatasets));
}

function createChart(container, title, labels, datasets) {
  const wrapper = createElement('div', { className: 'chart-container' });
  wrapper.appendChild(createElement('div', { className: 'chart-title', textContent: title }));
  const canvas = createElement('canvas');
  wrapper.appendChild(canvas);
  container.appendChild(wrapper);

  const shortLabels = labels.map(d => {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  });

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: shortLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#a0a0a0', font: { size: 11 } },
        },
      },
      scales: {
        x: {
          ticks: { color: '#666', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#666', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
    },
  });

  return chart;
}

function renderSummary(container, summary) {
  container.innerHTML = '';

  const cards = [
    { label: 'Moy. kcal', value: summary.avgKcal ? adjustCal(summary.avgKcal) : '-' },
    { label: 'Moy. prot.', value: summary.avgProtein ? `${summary.avgProtein}g` : '-' },
    { label: 'Moy. lip.', value: summary.avgFat ? `${summary.avgFat}g` : '-' },
    { label: 'Moy. gluc.', value: summary.avgCarbs ? `${summary.avgCarbs}g` : '-' },
    { label: 'Jours suivis', value: summary.daysTracked || '0' },
    { label: 'Poids min', value: summary.minWeight ? `${summary.minWeight}kg` : '-' },
    { label: 'Poids max', value: summary.maxWeight ? `${summary.maxWeight}kg` : '-' },
    { label: 'Delta poids', value: summary.weightDelta != null ? `${summary.weightDelta > 0 ? '+' : ''}${summary.weightDelta}kg` : '-' },
  ];

  for (const card of cards) {
    container.appendChild(createElement('div', { className: 'summary-card' }, [
      createElement('div', { className: 'summary-value', textContent: card.value }),
      createElement('div', { className: 'summary-label', textContent: card.label }),
    ]));
  }
}
