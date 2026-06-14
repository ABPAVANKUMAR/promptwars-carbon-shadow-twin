/**
 * Local storage layer for carbon footprint history
 */

const STORAGE_KEY = 'carbon_shadow_twin_data';

const defaultData = () => ({
  entries: [],
  streak: 0,
  lastLogDate: null,
  settings: {
    ttsEnabled: true
  }
});

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const data = JSON.parse(raw);
    return { ...defaultData(), ...data };
  } catch {
    return defaultData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function getEntryForDate(data, dateKey) {
  return data.entries.find(e => e.date === dateKey) || null;
}

export function getTodayEntry(data) {
  return getEntryForDate(data, getTodayKey());
}

export function upsertEntry(data, entry) {
  const idx = data.entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) {
    data.entries[idx] = entry;
  } else {
    data.entries.push(entry);
  }
  data.entries.sort((a, b) => a.date.localeCompare(b.date));
  updateStreak(data, entry);
  saveData(data);
  return data;
}

function updateStreak(data, entry) {
  const today = getTodayKey();
  if (entry.date !== today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];

  if (data.lastLogDate === yesterdayKey) {
    data.streak += 1;
  } else if (data.lastLogDate !== today) {
    data.streak = 1;
  }
  data.lastLogDate = today;
}

export function getLast7Days(data) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const entry = getEntryForDate(data, key);
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      entry
    });
  }
  return days;
}

export function seedDemoData() {
  const data = defaultData();
  const options = {
    travel: ['bike', 'bus', 'car'],
    food: ['veg', 'nonveg'],
    electricity: ['low', 'medium', 'high']
  };

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    data.entries.push({
      date: key,
      travel: options.travel[Math.floor(Math.random() * 3)],
      food: options.food[Math.random() > 0.5 ? 0 : 1],
      electricity: options.electricity[Math.floor(Math.random() * 3)],
      score: 0,
      breakdown: {}
    });
  }

  data.streak = 3;
  data.lastLogDate = getTodayKey();
  return data;
}
