/**
 * Shadow Voice Engine — spoken briefings for all app topics
 * Shadow speaks in first person; Eco Assistant narrates analytics
 */

import { getTodayEntry, getLast7Days } from './storage.js';
import {
  getLevel,
  getShadowVisuals,
  getEmotionalMessage,
  aggregateBreakdown,
  getBiggestSource,
  detectPatterns,
  generateSuggestions,
  CARBON_VALUES
} from './carbon-calculator.js';
import { getWeeklyAverage } from './analyzer.js';

export const VOICE_TOPICS = [
  { id: 'shadow', label: 'Shadow Twin', cmd: 'tell me about my shadow' },
  { id: 'weekly', label: 'Weekly Report', cmd: 'weekly carbon report' },
  { id: 'patterns', label: 'Patterns', cmd: 'detect my patterns' },
  { id: 'suggestions', label: 'Suggestions', cmd: 'give me suggestions' },
  { id: 'pollution', label: 'Pollution Source', cmd: 'biggest pollution source' },
  { id: 'gamification', label: 'Streak & Levels', cmd: 'my streak and level' },
  { id: 'input', label: 'How to Log', cmd: 'how do I log my day' },
  { id: 'coach', label: 'Green Coach', cmd: 'eco coaching tips' },
  { id: 'full', label: 'Full Briefing', cmd: 'full shadow briefing' }
];

/** Remove emoji/symbols for cleaner TTS */
export function stripForSpeech(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shadow twin speaks emotionally in first person */
export function buildShadowEmotionalVoice(data) {
  const today = getTodayEntry(data);
  if (!today) {
    return {
      speaker: 'shadow',
      text: 'Hello… I am your Shadow Twin. I have not felt your choices today yet. Please log your travel, food, and electricity so I can show you who you are becoming.'
    };
  }

  const level = getLevel(today.score);
  const visuals = getShadowVisuals(today.score);
  const emotion = stripForSpeech(getEmotionalMessage(level, null, today.score));

  let appearance;
  if (visuals.pollution < 0.25) {
    appearance = 'I am light, glowing, and full of life. Your low pollution keeps me bright and healthy.';
  } else if (visuals.pollution < 0.55) {
    appearance = 'I appear grey and balanced — neither bright nor fully dark. There is room to improve.';
  } else if (visuals.pollution < 0.8) {
    appearance = 'I feel heavy and dark. Smoke surrounds me because your carbon impact is high today.';
  } else {
    appearance = 'I am crumbling under red-black pollution. I can barely breathe. Please help me recover.';
  }

  return {
    speaker: 'shadow',
    text: `${emotion} ${appearance} Your carbon score is ${today.score} kilograms. I am at ${level.name} level.`
  };
}

/** Full shadow + analytics voice briefing */
export function buildFullShadowBriefing(data) {
  const parts = [];
  parts.push(buildShadowEmotionalVoice(data));
  parts.push({ speaker: 'eco', text: buildWeeklyVoiceReport(data) });
  parts.push({ speaker: 'eco', text: buildPollutionSourceVoice(data) });
  parts.push({ speaker: 'eco', text: buildPatternVoice(data) });
  parts.push({ speaker: 'eco', text: buildSuggestionVoice(data) });
  parts.push({ speaker: 'eco', text: buildGamificationVoice(data) });
  return parts;
}

export function buildWeeklyVoiceReport(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);

  if (!entries.length) {
    return 'Weekly report: no data yet. Log daily to unlock your carbon analyzer.';
  }

  const total = entries.reduce((s, e) => s + e.score, 0);
  const avg = (total / entries.length).toFixed(1);
  let best = { score: Infinity, day: '' };
  entries.forEach(e => {
    if (e.score < best.score) {
      best = { score: e.score, day: new Date(e.date).toLocaleDateString('en-US', { weekday: 'long' }) };
    }
  });

  let trend = 'stable';
  if (entries.length >= 2) {
    const half = Math.floor(entries.length / 2);
    const firstAvg = entries.slice(0, half).reduce((s, e) => s + e.score, 0) / half;
    const secondAvg = entries.slice(half).reduce((s, e) => s + e.score, 0) / (entries.length - half);
    if (secondAvg < firstAvg - 1) trend = 'improving';
    else if (secondAvg > firstAvg + 1) trend = 'rising';
  }

  return `Weekly carbon report: total ${total.toFixed(1)} kilograms this week. Daily average ${avg}. Best day was ${best.day} at ${best.score} kilograms. Your trend is ${trend}.`;
}

export function buildPollutionSourceVoice(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);
  const breakdown = aggregateBreakdown(entries);
  const biggest = getBiggestSource(breakdown);

  if (!biggest) {
    return 'Pollution analysis: log more days to find your biggest carbon source.';
  }

  const names = { travel: 'travel and commuting', food: 'food and diet', electricity: 'electricity use' };
  return `Your biggest pollution source is ${names[biggest.source] || biggest.source}, causing ${biggest.percent} percent of your weekly emissions.`;
}

export function buildPatternVoice(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);
  const patterns = detectPatterns(entries);

  if (!patterns.length) {
    return 'Pattern detection: no strong habits found yet. Keep logging to reveal your behavior patterns.';
  }

  const spoken = patterns.slice(0, 2).map(p => stripForSpeech(p)).join(' Also, ');
  return `Behavior patterns detected: ${spoken}`;
}

export function buildSuggestionVoice(data) {
  const days = getLast7Days(data);
  const entries = days.filter(d => d.entry).map(d => d.entry);
  const breakdown = aggregateBreakdown(entries);
  const biggest = getBiggestSource(breakdown);
  const suggestions = generateSuggestions(entries, biggest);

  const top = suggestions.slice(0, 2).map(s => stripForSpeech(s)).join(' Next suggestion: ');
  return `Personalized eco tips: ${top}`;
}

export function buildGamificationVoice(data) {
  const today = getTodayEntry(data);
  const streak = data.streak || 0;
  const weeklyAvg = getWeeklyAverage(data);

  let levelText = 'You have not reached a level yet today.';
  if (today) {
    const level = getLevel(today.score);
    levelText = `Today's shadow level is ${level.name}.`;
  }

  const streakText = streak > 1
    ? `You are on a ${streak} day logging streak. Keep it up for lasting change.`
    : streak === 1
      ? 'You started a new streak today. Log again tomorrow to build momentum.'
      : 'Start a streak by logging daily.';

  const avgText = weeklyAvg !== null
    ? `Your weekly average is ${weeklyAvg.toFixed(1)} kilograms.`
    : '';

  return `Gamification update: ${levelText} ${streakText} ${avgText}`.trim();
}

export function buildInputGuideVoice() {
  return `To log your day, choose travel: bike is 0.5 kilograms, bus 3, car 8. Food: vegetarian 2 kilograms, non-veg 6. Electricity: low 1, medium 3, high 7. You can say "log bike vegetarian low electricity" or use the Log screen.`;
}

export function buildCoachIntroVoice() {
  return 'I am your Green Coach. Ask how to reduce carbon, best travel options, vegetarian tips, or say "give me suggestions" for personalized advice based on your data.';
}

export function buildTopicsMenuVoice() {
  const list = VOICE_TOPICS.map(t => t.label).join(', ');
  return `I can speak about: ${list}. Try saying "full shadow briefing", "weekly carbon report", or "tell me about my shadow".`;
}

export function getTopicByCommand(lower) {
  const map = [
    { patterns: ['full briefing', 'full report', 'complete report', 'tell me everything', 'brief me'], fn: (d) => buildFullShadowBriefing(d) },
    { patterns: ['weekly report', 'weekly carbon', 'this week', 'week report'], fn: (d) => ({ speaker: 'eco', text: buildWeeklyVoiceReport(d) }) },
    { patterns: ['pattern', 'habits', 'behavior', 'detect'], fn: (d) => ({ speaker: 'eco', text: buildPatternVoice(d) }) },
    { patterns: ['suggestion', 'recommend', 'tips', 'advice', 'how to improve'], fn: (d) => ({ speaker: 'eco', text: buildSuggestionVoice(d) }) },
    { patterns: ['biggest pollution', 'pollution source', 'main source', 'top pollut'], fn: (d) => ({ speaker: 'eco', text: buildPollutionSourceVoice(d) }) },
    { patterns: ['streak', 'gamification', 'level progress', 'my level', 'daily streak'], fn: (d) => ({ speaker: 'eco', text: buildGamificationVoice(d) }) },
    { patterns: ['how to log', 'how do i log', 'log my day', 'input guide', 'travel food electricity'], fn: () => ({ speaker: 'eco', text: buildInputGuideVoice() }) },
    { patterns: ['green coach', 'eco coach', 'coaching tips'], fn: () => ({ speaker: 'eco', text: buildCoachIntroVoice() }) },
    { patterns: ['what topics', 'what can you', 'help topics', 'commands', 'what do you do'], fn: () => ({ speaker: 'eco', text: buildTopicsMenuVoice() }) },
    { patterns: ['shadow speak', 'shadow voice', 'hear shadow', 'shadow briefing', 'about my shadow', 'shadow twin'], fn: (d) => buildShadowEmotionalVoice(d) }
  ];

  for (const item of map) {
    if (item.patterns.some(p => lower.includes(p))) {
      return item.fn;
    }
  }
  return null;
}
