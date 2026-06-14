/**
 * Carbon Shadow Twin — Main Application
 */

import { loadData, saveData, getTodayKey, getTodayEntry, upsertEntry, seedDemoData } from './storage.js';
import { calculateScore, getEmotionalMessage, getShadowVisuals } from './carbon-calculator.js';
import { renderShadowTwin, updateShadowTwin, updateLevelBadge, updateHeaderLevel } from './shadow-twin.js';
import { initAnalyzer, updateAnalyzerUI, getWeeklyAverage } from './analyzer.js';
import { getChatResponse, addChatMessage, showTypingIndicator } from './chatbot.js';
import { VoiceManager, parseVoiceInput } from './voice.js';
import { VoiceAssistant } from './voice-assistant.js';

class CarbonShadowApp {
  constructor() {
    this.data = loadData();
    this.formState = { travel: null, food: null, electricity: null };
    this.voice = new VoiceManager();
    this.previousTodayScore = null;

    this.init();
  }

  init() {
    if (this.data.entries.length === 0) {
      this.data = seedDemoData();
      this.data.entries.forEach(e => {
        const calc = calculateScore(e);
        e.score = calc.score;
        e.breakdown = calc.breakdown;
        e.level = calc.level.key;
      });
      saveData(this.data);
    }

    this.bindNavigation();
    this.bindInputForm();
    this.bindChat();
    this.bindVoice();
    this.renderHome();
    initAnalyzer(this.data);
    this.voiceAssistant = new VoiceAssistant(this);

    document.getElementById('homeSpeakShadow')?.addEventListener('click', () => {
      this.voiceAssistant.speakShadowBriefing();
    });

    document.getElementById('homeFullBriefing')?.addEventListener('click', () => {
      this.voiceAssistant.speakFullBriefing();
    });

    this.voiceAssistant.speakWelcomeBriefing();

    const today = getTodayEntry(this.data);
    if (today) {
      this.loadFormFromEntry(today);
      this.previousTodayScore = today.score;
    }
  }

  bindNavigation() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.nav));
    });
  }

  navigate(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelector(`#screen-${screen}`)?.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === screen);
    });

    if (screen === 'analyzer') {
      updateAnalyzerUI(this.data);
    }
  }

  bindInputForm() {
    const form = document.getElementById('dailyInputForm');

    document.querySelectorAll('.option-grid').forEach(grid => {
      const field = grid.dataset.field;
      grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.formState[field] = btn.dataset.value;
          this.updateScorePreview();
          this.checkFormComplete();
        });
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitDailyLog();
    });
  }

  loadFormFromEntry(entry) {
    this.formState = {
      travel: entry.travel,
      food: entry.food,
      electricity: entry.electricity
    };

    Object.entries(this.formState).forEach(([field, value]) => {
      if (!value) return;
      const grid = document.querySelector(`.option-grid[data-field="${field}"]`);
      grid?.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === value);
      });
    });

    this.updateScorePreview();
    this.checkFormComplete();
  }

  updateScorePreview() {
    const { travel, food, electricity } = this.formState;
    const preview = document.getElementById('scorePreview');
    if (!travel || !food || !electricity) {
      preview.querySelector('.preview-value').textContent = '-- kg CO₂';
      return;
    }
    const { score } = calculateScore(this.formState);
    preview.querySelector('.preview-value').textContent = `${score} kg CO₂`;
  }

  checkFormComplete() {
    const complete = this.formState.travel && this.formState.food && this.formState.electricity;
    document.getElementById('submitDayBtn').disabled = !complete;
  }

  submitDailyLog() {
    const calc = calculateScore(this.formState);
    const todayKey = getTodayKey();
    const existing = getTodayEntry(this.data);
    const prevScore = existing?.score ?? null;

    const entry = {
      date: todayKey,
      ...this.formState,
      score: calc.score,
      breakdown: calc.breakdown,
      level: calc.level.key
    };

    this.data = upsertEntry(this.data, entry);
    this.previousTodayScore = prevScore;

    const message = getEmotionalMessage(calc.level, prevScore, calc.score, true);
    this.renderHome(calc, message);
    updateAnalyzerUI(this.data);

    this.showToast(`Shadow updated: ${calc.score} kg CO₂ — ${calc.level.name} ${calc.level.emoji}`);
    this.voiceAssistant?.onShadowUpdated(calc.score);
    this.navigate('home');
  }

  renderHome(calc = null, customMessage = null) {
    const today = getTodayEntry(this.data);
    const score = calc?.score ?? today?.score ?? 0;
    const level = calc?.level ?? (today ? calculateScore(today).level : { key: 'clean', name: 'Clean', emoji: '🌿', class: 'level-clean' });

    const container = document.getElementById('shadowTwin');
    if (!container.querySelector('.shadow-twin')) {
      renderShadowTwin(container, score);
    } else {
      updateShadowTwin(container, score, !!calc);
    }

    updateLevelBadge(document.getElementById('levelBadge'), level);
    updateHeaderLevel(document.getElementById('headerLevel'), level, score);

    document.getElementById('headerScore').querySelector('.stat-value').textContent =
      today ? `${today.score} kg` : '--';

    document.getElementById('todayScore').textContent = today ? today.score : '--';
    document.getElementById('streakDays').textContent = this.data.streak || 0;

    const weeklyAvg = getWeeklyAverage(this.data);
    document.getElementById('weeklyAvg').textContent =
      weeklyAvg !== null ? weeklyAvg.toFixed(1) : '--';

    const messageEl = document.getElementById('shadowMessage');
    if (customMessage) {
      messageEl.textContent = customMessage;
    } else if (today) {
      messageEl.textContent = getEmotionalMessage(level, null, score);
    } else {
      messageEl.textContent = 'Your shadow awaits your choices… Log your first day!';
    }

    const banner = document.getElementById('emotionBanner');
    if (today) {
      const banners = [
        'Every choice ripples through your shadow twin.',
        'Your digital self reflects your real-world impact.',
        'Connect deeper — your shadow feels what you do.'
      ];
      banner.querySelector('p').textContent = banners[Math.floor(Math.random() * banners.length)];
    }

    this.voiceAssistant?.updateOrbFromScore();

    const stage = document.querySelector('.shadow-stage');
    const visuals = getShadowVisuals(score);
    stage?.classList.toggle('stage-light', visuals.pollution < 0.25);
    stage?.classList.toggle('stage-dark', visuals.pollution > 0.55);
  }

  bindChat() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const messages = document.getElementById('chatMessages');

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.handleChatMessage(text);
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });

    document.querySelectorAll('.quick-prompt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleChatMessage(btn.dataset.prompt);
      });
    });

    document.getElementById('ttsToggle').addEventListener('click', (e) => {
      const enabled = this.voice.toggleTTS();
      e.currentTarget.classList.toggle('active', enabled);
      e.currentTarget.classList.toggle('muted', !enabled);
      e.currentTarget.textContent = enabled ? '🔊' : '🔇';
    });
  }

  handleChatMessage(text) {
    const messages = document.getElementById('chatMessages');
    addChatMessage(messages, text, true);

    const typing = showTypingIndicator(messages);

    setTimeout(() => {
      typing.remove();
      const response = getChatResponse(text, this.data);
      addChatMessage(messages, response, false);
      if (this.voice.ttsEnabled) {
        this.voice.speak(response);
      }
    }, 600 + Math.random() * 400);
  }

  bindVoice() {
    const voiceBtn = document.getElementById('voiceInputBtn');
    const statusEl = document.getElementById('voiceInputStatus');
    const chatVoiceBtn = document.getElementById('voiceChatBtn');

    voiceBtn?.addEventListener('click', () => {
      const started = this.voice.startListening(
        (transcript) => {
          voiceBtn.classList.remove('listening');
          this.applyVoiceToForm(transcript);
        },
        (status) => {
          statusEl.textContent = status;
          voiceBtn.classList.toggle('listening', this.voice.isListening);
        }
      );
      if (started) voiceBtn.classList.add('listening');
    });

    chatVoiceBtn?.addEventListener('click', () => {
      this.voice.startListening(
        (transcript) => {
          chatVoiceBtn.classList.remove('listening');
          document.getElementById('chatInput').value = transcript;
          this.handleChatMessage(transcript);
        },
        () => {
          chatVoiceBtn.classList.toggle('listening', this.voice.isListening);
        }
      );
      chatVoiceBtn.classList.add('listening');
    });

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }

  applyVoiceToForm(transcript) {
    const parsed = parseVoiceInput(transcript);
    let applied = [];

    Object.entries(parsed).forEach(([field, value]) => {
      this.formState[field] = value;
      const grid = document.querySelector(`.option-grid[data-field="${field}"]`);
      grid?.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === value);
      });
      applied.push(field);
    });

    this.updateScorePreview();
    this.checkFormComplete();

    if (applied.length) {
      this.showToast(`Voice parsed: ${applied.join(', ')} ✓`);
    } else if (!this.voiceAssistant?.isOpen) {
      this.showToast('Try: "car, vegetarian, low electricity"');
    }

    return applied;
  }

  showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.carbonApp = new CarbonShadowApp();
});

export default CarbonShadowApp;
