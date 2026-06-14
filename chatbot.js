/**
 * Green Coach — rule-based AI chatbot
 */

import { CARBON_VALUES, getLevel, getBiggestSource, aggregateBreakdown } from './carbon-calculator.js';
import { getTodayEntry, getLast7Days } from './storage.js';

const RESPONSES = {
  reduce: [
    'Start with your biggest emitter! Swap car → bus saves ~5 kg/day. Try Meatless Monday for food. Unplug devices at night for electricity.',
    'Top 3 quick wins: (1) Bike short trips, (2) Eat more plants, (3) Lower AC/heat. Small changes compound into big impact! 🌿',
    'Your shadow twin responds to daily choices. Focus on one category this week — travel usually has the highest impact for most people.'
  ],
  travel: [
    'Ranking: 🚲 Bike (0.5 kg) > 🚌 Bus (3 kg) > 🚗 Car (8 kg). For trips under 3 km, biking is ideal. Combine errands to reduce total trips.',
    'Best travel option depends on distance: <2 km → walk/bike, 2-10 km → bus/metro, long distance → carpool beats solo driving.',
    'Try "Transit Tuesday" — one car-free day per week cuts ~30 kg CO₂/month!'
  ],
  food: [
    'Plant-based meals average 2 kg vs 6 kg for meat-heavy diets. Try swapping lunch to veg 3×/week — easy 12 kg/month savings!',
    'Local & seasonal produce reduces transport emissions. Batch-cook to avoid food waste — wasted food = wasted carbon.',
    'You don\'t need to go fully vegan. Flexitarian (mostly plants) cuts food footprint by ~50%.'
  ],
  electricity: [
    'Low usage tips: LED bulbs, unplug chargers, wash cold, air-dry clothes. Smart thermostat saves 10-15% on heating/cooling.',
    'Peak hours matter — shift laundry/dishwasher to off-peak. Enable eco-mode on all appliances.',
    'Standby power ("vampire load") can be 10% of home energy. Power strips with switches help!'
  ],
  shadow: [
    'Your shadow twin is a living mirror of your carbon choices. Clean = glowing green, Danger = red smoky form. Log daily to watch it evolve!',
    'The shadow speaks emotionally because data alone doesn\'t motivate — connection does. Every log updates its appearance in real-time.',
    'Gamification works: maintain streaks, beat your weekly average, and watch your twin transform from polluted to pristine!'
  ],
  greeting: [
    'Hey eco-warrior! 🌿 I\'m your Green Coach. Ask about travel, food, electricity, or how to shrink your footprint!',
    'Welcome back! Ready to make your shadow twin glow today?',
    'Hello! I analyze your patterns and give personalized tips. What would you like to know?'
  ],
  default: [
    'Great question! Based on typical patterns, focus on reducing car usage and high electricity days. Want specifics on travel, food, or energy?',
    'I\'m here to help! Try asking "How to reduce carbon?" or "Best travel option?" for tailored advice.',
    'Every choice matters. Log your day on the Input screen, then check the Analyzer for personalized insights!'
  ]
};

export function getChatResponse(message, appData) {
  const lower = message.toLowerCase().trim();

  if (matches(lower, ['hello', 'hi', 'hey', 'start'])) {
    return pick(RESPONSES.greeting);
  }

  if (matches(lower, ['reduce', 'lower', 'decrease', 'less carbon', 'footprint', 'emission'])) {
    return personalizeReduce(appData) || pick(RESPONSES.reduce);
  }

  if (matches(lower, ['travel', 'commute', 'car', 'bus', 'bike', 'transport'])) {
    return personalizeTravel(appData) || pick(RESPONSES.travel);
  }

  if (matches(lower, ['food', 'eat', 'veg', 'meat', 'diet', 'vegetarian'])) {
    return personalizeFood(appData) || pick(RESPONSES.food);
  }

  if (matches(lower, ['electric', 'power', 'energy', 'electricity'])) {
    return personalizeElectricity(appData) || pick(RESPONSES.electricity);
  }

  if (matches(lower, ['shadow', 'twin', 'avatar', 'how am i', 'status', 'doing'])) {
    return personalizeShadow(appData) || pick(RESPONSES.shadow);
  }

  if (matches(lower, ['thank', 'thanks', 'ty'])) {
    return 'You\'re welcome! Together we\'ll make your shadow glow brighter every day 🌿';
  }

  if (matches(lower, ['help', 'what can'])) {
    return 'I can help with: reducing carbon, best travel/food/energy choices, shadow twin status, and weekly insights. Just ask naturally!';
  }

  return pick(RESPONSES.default);
}

function matches(text, keywords) {
  return keywords.some(k => text.includes(k));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function personalizeReduce(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);
  if (!entries.length) return null;

  const breakdown = aggregateBreakdown(entries);
  const biggest = getBiggestSource(breakdown);
  if (!biggest) return null;

  const tips = {
    travel: `Your #1 source is travel (${biggest.percent}%). Switch 2 car days to bus — saves ~10 kg/week!`,
    food: `Food is your top emitter (${biggest.percent}%). Try 3 plant-based days this week.`,
    electricity: `Electricity leads at ${biggest.percent}%. Lower usage + unplug idle devices for quick wins.`
  };
  return tips[biggest.source] || null;
}

function personalizeTravel(data) {
  const today = getTodayEntry(data);
  if (today?.travel === 'car') {
    return 'You logged car today (8 kg). Tomorrow, try bus (3 kg) or bike (0.5 kg) — your shadow will thank you! 🚲';
  }
  const days = getLast7Days(data);
  const carDays = days.filter(d => d.entry?.travel === 'car').length;
  if (carDays >= 3) {
    return `You've used the car ${carDays} days this week. Challenge: 2 car-free days remaining — bus or bike?`;
  }
  return null;
}

function personalizeFood(data) {
  const today = getTodayEntry(data);
  if (today?.food === 'nonveg') {
    return 'Non-veg today adds 6 kg. Tomorrow\'s veg meal (2 kg) would lighten your shadow by 4 kg! 🥗';
  }
  return null;
}

function personalizeElectricity(data) {
  const today = getTodayEntry(data);
  if (today?.electricity === 'high') {
    return 'High electricity today (7 kg). Tonight: unplug devices, lower thermostat 1°C — drops to ~3 kg tomorrow.';
  }
  return null;
}

function personalizeShadow(data) {
  const today = getTodayEntry(data);
  if (!today) {
    return 'Your shadow is waiting! Log today\'s choices on the Input screen to see its current form.';
  }

  const level = getLevel(today.score);
  const messages = {
    clean: `Your shadow is glowing ${level.emoji} Clean at ${today.score} kg today! You're an eco champion.`,
    moderate: `Shadow status: ${level.emoji} Moderate (${today.score} kg). A few swaps could push you to Clean!`,
    polluted: `Your shadow looks ${level.emoji} Polluted at ${today.score} kg. Let's work on travel & food choices.`,
    danger: `Alert: ${level.emoji} Danger level at ${today.score} kg! Immediate action needed — check the Analyzer for tips.`
  };
  return messages[level.key] || null;
}

export function addChatMessage(container, text, isUser = false) {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
  msg.innerHTML = `
    <div class="msg-avatar">${isUser ? '👤' : '🌿'}</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

export function showTypingIndicator(container) {
  const el = document.createElement('div');
  el.className = 'chat-msg bot typing';
  el.innerHTML = `
    <div class="msg-avatar">🌿</div>
    <div class="msg-bubble">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

