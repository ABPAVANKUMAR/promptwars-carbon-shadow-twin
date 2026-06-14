import { getLast7Days, getTodayEntry } from './storage.js';
import {
  aggregateBreakdown,
  getBiggestSource,
  detectPatterns,
  generateSuggestions,
  getLevel
} from './carbon-calculator.js';

let weeklyChart = null;
let sourceChart = null;

export function initAnalyzer(data) {
  updateAnalyzerUI(data);
}

export function updateAnalyzerUI(data) {
  const days = getLast7Days(data);
  const entriesWithData = days.filter(d => d.entry).map(d => d.entry);
  const weekEntries = entriesWithData;

  updateWeeklySummary(days, weekEntries);
  updateBiggestSource(weekEntries);
  updatePatterns(weekEntries);
  updateSuggestions(weekEntries);
  renderWeeklyChart(days);
  renderSourceChart(weekEntries);
}

function updateWeeklySummary(days, entries) {
  const total = entries.reduce((s, e) => s + (e.score || 0), 0);
  const avg = entries.length ? (total / entries.length).toFixed(1) : '--';

  let bestDay = '--';
  let bestScore = Infinity;
  entries.forEach(e => {
    if (e.score < bestScore) {
      bestScore = e.score;
      bestDay = new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' });
    }
  });

  let trend = '--';
  if (entries.length >= 2) {
    const firstHalf = entries.slice(0, Math.floor(entries.length / 2));
    const secondHalf = entries.slice(Math.floor(entries.length / 2));
    const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / secondHalf.length;
    if (avgSecond < avgFirst - 1) trend = '📉 Improving';
    else if (avgSecond > avgFirst + 1) trend = '📈 Rising';
    else trend = '➡️ Stable';
  }

  document.getElementById('weeklyTotal').textContent = entries.length ? `${total.toFixed(1)} kg` : '-- kg';
  document.getElementById('weeklyDailyAvg').textContent = avg !== '--' ? `${avg} kg` : '--';
  document.getElementById('weeklyBest').textContent = bestDay;
  document.getElementById('weeklyTrend').textContent = trend;
}

function updateBiggestSource(entries) {
  const breakdown = aggregateBreakdown(entries);
  const biggest = getBiggestSource(breakdown);
  const iconEl = document.querySelector('#biggestSource .source-icon');
  const nameEl = document.querySelector('#biggestSource .source-name');
  const percentEl = document.querySelector('#biggestSource .source-percent');

  if (!biggest) {
    iconEl.textContent = '--';
    nameEl.textContent = 'Log data to analyze';
    percentEl.textContent = '--%';
    return;
  }

  iconEl.textContent = biggest.icon;
  nameEl.textContent = biggest.source;
  percentEl.textContent = `${biggest.percent}%`;
}

function updatePatterns(entries) {
  const list = document.getElementById('patternList');
  const patterns = detectPatterns(entries);

  if (!patterns.length) {
    list.innerHTML = '<li class="pattern-item empty">No patterns yet — log a few days!</li>';
    return;
  }

  list.innerHTML = patterns.map(p => `<li class="pattern-item">${p}</li>`).join('');
}

function updateSuggestions(entries) {
  const list = document.getElementById('suggestionList');
  const breakdown = aggregateBreakdown(entries);
  const biggest = getBiggestSource(breakdown);
  const suggestions = generateSuggestions(entries, biggest);

  list.innerHTML = suggestions.map(s => `<li class="suggestion-item">${s}</li>`).join('');
}

function renderWeeklyChart(days) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;

  const labels = days.map(d => d.label);
  const scores = days.map(d => d.entry?.score ?? 0);
  const colors = scores.map(s => {
    const level = getLevel(s);
    return level.key === 'clean' ? '#00ff88'
      : level.key === 'moderate' ? '#8899aa'
      : level.key === 'polluted' ? '#666666'
      : '#ff4444';
  });

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'kg CO₂',
        data: scores,
        backgroundColor: colors,
        borderColor: colors.map(c => c + '88'),
        borderWidth: 1,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 15, 10, 0.9)',
          titleColor: '#00ff88',
          bodyColor: '#e8f5e9',
          borderColor: 'rgba(0, 255, 136, 0.3)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 255, 136, 0.05)' },
          ticks: { color: '#8fbc8f' }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 255, 136, 0.08)' },
          ticks: { color: '#8fbc8f' },
          title: { display: true, text: 'kg CO₂', color: '#5a7a5a' }
        }
      }
    }
  });
}

function renderSourceChart(entries) {
  const canvas = document.getElementById('sourceChart');
  if (!canvas) return;

  const breakdown = aggregateBreakdown(entries);
  const total = breakdown.travel + breakdown.food + breakdown.electricity;

  if (sourceChart) sourceChart.destroy();

  if (total === 0) {
    sourceChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['No data'],
        datasets: [{ data: [1], backgroundColor: ['#1a4d2e'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  sourceChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Travel', 'Food', 'Electricity'],
      datasets: [{
        data: [breakdown.travel, breakdown.food, breakdown.electricity],
        backgroundColor: ['#00ff88', '#ffaa00', '#ff4444'],
        borderColor: ['#0a0f0a', '#0a0f0a', '#0a0f0a'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8fbc8f', padding: 16, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 15, 10, 0.9)',
          titleColor: '#00ff88',
          bodyColor: '#e8f5e9'
        }
      }
    }
  });
}

export function getWeeklyAverage(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);
  if (!entries.length) return null;
  return entries.reduce((s, e) => s + e.score, 0) / entries.length;
}

