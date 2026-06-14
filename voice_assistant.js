/**
 * Eco Voice Assistant — shadow voice output + all requirement topics
 */

import { parseVoiceInput } from './voice.js';
import { getChatResponse } from './chatbot.js';
import { getTodayEntry } from './storage.js';
import { getLevel, getShadowVisuals } from './carbon-calculator.js';
import {
  buildShadowEmotionalVoice,
  buildFullShadowBriefing,
  buildTopicsMenuVoice,
  getTopicByCommand,
  stripForSpeech,
  VOICE_TOPICS
} from './shadow-voice.js';

const NAV_COMMANDS = [
  { patterns: ['go home', 'main screen'], action: 'home' },
  { patterns: ['open log', 'log screen', 'track my day'], action: 'input' },
  { patterns: ['open analyze', 'open analyzer', 'show analyzer'], action: 'analyzer' },
  { patterns: ['open coach', 'open chat', 'green coach screen'], action: 'chat' }
];

export class VoiceAssistant {
  constructor(app) {
    this.app = app;
    this.panel = document.getElementById('voiceAssistantPanel');
    this.fab = document.getElementById('voiceAssistantFab');
    this.transcriptEl = document.getElementById('vaTranscript');
    this.responseEl = document.getElementById('vaResponse');
    this.waveformEl = document.getElementById('vaWaveform');
    this.statusEl = document.getElementById('vaStatus');
    this.orbEl = document.getElementById('vaOrb');
    this.speakerBadge = document.getElementById('vaSpeakerBadge');
    this.isOpen = false;
    this.hasGreeted = sessionStorage.getItem('va_greeted') === '1';

    this.app.voice.onSpeakStart = (speaker) => this.setSpeakerBadge(speaker);
    this.app.voice.onSpeakEnd = () => this.setSpeakerBadge(null);

    this.bindUI();
    this.renderTopicButtons();
    this.updateOrbFromScore();
  }

  bindUI() {
    this.fab?.addEventListener('click', () => this.toggle());
    document.getElementById('vaCloseBtn')?.addEventListener('click', () => this.close());
    document.getElementById('vaMicBtn')?.addEventListener('click', () => this.startListening());
    document.getElementById('vaShadowSpeakBtn')?.addEventListener('click', () => this.speakShadowBriefing());
    document.getElementById('vaFullBriefingBtn')?.addEventListener('click', () => this.speakFullBriefing());

    document.querySelectorAll('.va-quick-cmd').forEach(btn => {
      btn.addEventListener('click', () => this.handleCommand(btn.dataset.cmd, true));
    });
  }

  renderTopicButtons() {
    const container = document.getElementById('vaTopicGrid');
    if (!container) return;
    container.innerHTML = VOICE_TOPICS.map(t =>
      `<button type="button" class="va-topic-btn" data-cmd="${t.cmd}" title="${t.label}">${t.label}</button>`
    ).join('');
    container.querySelectorAll('.va-topic-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleCommand(btn.dataset.cmd, true));
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.panel?.classList.add('open');
    this.fab?.classList.add('active');
    this.updateOrbFromScore();

    if (!this.hasGreeted) {
      this.hasGreeted = true;
      sessionStorage.setItem('va_greeted', '1');
      const greeting = 'Hi! I am Eco, your voice assistant. Your Shadow Twin can speak too. Say "tell me about my shadow" or tap Full Briefing.';
      this.showResponse(greeting, 'eco');
      this.app.voice.speakAsEco(greeting);
    }

    this.startListening();
  }

  close() {
    this.isOpen = false;
    this.panel?.classList.remove('open');
    this.fab?.classList.remove('active');
    this.app.voice.stopListening();
    this.setListening(false);
  }

  startListening() {
    const started = this.app.voice.startListening(
      (transcript) => this.onFinalTranscript(transcript),
      (status) => this.onStatus(status)
    );
    if (started) this.setListening(true);
  }

  setListening(active) {
    this.fab?.classList.toggle('listening', active);
    this.panel?.classList.toggle('listening', active);
    document.getElementById('vaMicBtn')?.classList.toggle('listening', active);
    this.waveformEl?.classList.toggle('active', active);
  }

  setSpeakerBadge(speaker) {
    if (!this.speakerBadge) return;
    if (speaker === 'shadow') {
      this.speakerBadge.textContent = '🌑 Shadow Twin speaking…';
      this.speakerBadge.className = 'va-speaker-badge shadow-speaking';
    } else if (speaker === 'eco') {
      this.speakerBadge.textContent = '🌿 Eco Assistant speaking…';
      this.speakerBadge.className = 'va-speaker-badge eco-speaking';
    } else {
      this.speakerBadge.textContent = '';
      this.speakerBadge.className = 'va-speaker-badge';
    }
  }

  onStatus(status) {
    if (this.statusEl) this.statusEl.textContent = status || 'Tap mic or speak…';
    if (this.transcriptEl && status && !status.includes('Listening')) {
      this.transcriptEl.textContent = status;
    }
    this.setListening(this.app.voice.isListening);
  }

  onFinalTranscript(transcript) {
    this.setListening(false);
    if (this.transcriptEl) this.transcriptEl.textContent = `"${transcript}"`;
    this.handleCommand(transcript, false);
  }

  async handleCommand(text, forceSpeak = false) {
    const lower = text.toLowerCase().trim();
    const result = this.parseCommand(lower);

    this.showResponse(result.message, result.speaker || 'eco');

    if (result.action === 'navigate') {
      this.app.navigate(result.screen);
    }

    if (result.action === 'log') {
      this.app.navigate('input');
      this.app.applyVoiceToForm(result.transcript || text);
      if (result.autoSubmit) {
        setTimeout(() => {
          if (this.app.formState.travel && this.app.formState.food && this.app.formState.electricity) {
            this.app.submitDailyLog();
          }
        }, 400);
      }
    }

    if (result.action === 'submit') {
      this.app.navigate('input');
      if (this.app.formState.travel && this.app.formState.food && this.app.formState.electricity) {
        this.app.submitDailyLog();
      } else {
        const msg = 'Please log travel, food, and electricity first. Try: bike, vegetarian, low electricity.';
        this.showResponse(msg, 'eco');
        await this.app.voice.speakAsEco(msg);
        return;
      }
    }

    if (result.action === 'briefing') {
      await this.speakFullBriefing();
      return;
    }

    if (result.action === 'shadow-speak') {
      await this.speakShadowBriefing();
      return;
    }

    const shouldSpeak = forceSpeak || this.app.voice.ttsEnabled || result.alwaysSpeak;
    if (shouldSpeak && result.message) {
      if (result.speaker === 'shadow') {
        await this.app.voice.speakAsShadow(stripForSpeech(result.message));
      } else {
        await this.app.voice.speakAsEco(stripForSpeech(result.message));
      }
    }

    this.updateOrbFromScore();
  }

  parseCommand(lower) {
    for (const nav of NAV_COMMANDS) {
      if (nav.patterns.some(p => lower.includes(p))) {
        const labels = { home: 'home', input: 'log screen', analyzer: 'analyzer', chat: 'Green Coach' };
        return {
          action: 'navigate',
          screen: nav.action,
          message: `Opening ${labels[nav.action]}.`,
          speaker: 'eco'
        };
      }
    }

    if (/\b(submit|save|update shadow|confirm)\b/.test(lower)) {
      return { action: 'submit', message: 'Updating your shadow twin now.', speaker: 'eco' };
    }

    if (/\b(full briefing|full report|complete report|brief me)\b/.test(lower)) {
      return { action: 'briefing', message: 'Starting full voice briefing…', speaker: 'eco', alwaysSpeak: true };
    }

    if (/\b(how is my shadow|shadow status|my score|carbon score|how am i doing)\b/.test(lower)) {
      return this.getShadowStatus();
    }

    if (/\b(read shadow|speak shadow|shadow message|shadow speak|hear shadow)\b/.test(lower)) {
      return { action: 'shadow-speak', message: '', alwaysSpeak: true };
    }

    const topicFn = getTopicByCommand(lower);
    if (topicFn) {
      const output = topicFn(this.app.data);
      if (Array.isArray(output)) {
        return { action: 'briefing', message: 'Playing full voice briefing…', speaker: 'eco', alwaysSpeak: false };
      }
      return {
        action: 'speak',
        message: output.text,
        speaker: output.speaker || 'eco',
        alwaysSpeak: true
      };
    }

    const parsed = parseVoiceInput(lower);
    const fields = Object.keys(parsed);
    if (fields.length >= 2 || (/\b(log|took|used|ate|travel)\b/.test(lower) && fields.length >= 1)) {
      const parts = fields.map(f => parsed[f]);
      const autoSubmit = fields.length >= 3 || /\b(and submit|then submit|save it)\b/.test(lower);
      return {
        action: 'log',
        transcript: lower,
        autoSubmit,
        message: fields.length
          ? `Got it — ${parts.join(', ')}.${autoSubmit ? ' Updating your shadow.' : ' Check the log screen.'}`
          : 'Opening log screen — please confirm your choices.',
        speaker: 'eco'
      };
    }

    const chatReply = getChatResponse(lower, this.app.data);
    return { action: 'chat', message: chatReply, speaker: 'eco' };
  }

  getShadowStatus() {
    const voice = buildShadowEmotionalVoice(this.app.data);
    return {
      action: 'speak',
      message: voice.text,
      speaker: 'shadow',
      alwaysSpeak: true
    };
  }

  async speakShadowBriefing() {
    const voice = buildShadowEmotionalVoice(this.app.data);
    this.showResponse(voice.text, 'shadow');
    document.getElementById('shadowMessage').textContent = voice.text.split('.')[0] + '.';
    await this.app.voice.speakAsShadow(stripForSpeech(voice.text));
  }

  async speakFullBriefing() {
    const segments = buildFullShadowBriefing(this.app.data);
    const preview = segments.map(s => s.text).join(' ').slice(0, 120) + '…';
    this.showResponse(preview, 'shadow');
    this.app.navigate('home');
    await this.app.voice.speakBriefing(segments);
  }

  showResponse(text, speaker = 'eco') {
    if (!this.responseEl) return;
    this.responseEl.textContent = text;
    this.responseEl.classList.add('visible');
    this.responseEl.classList.toggle('from-shadow', speaker === 'shadow');
    this.responseEl.classList.toggle('from-eco', speaker !== 'shadow');
  }

  updateOrbFromScore() {
    if (!this.orbEl) return;
    const today = getTodayEntry(this.app.data);
    const score = today?.score ?? 0;
    const { pollution, level } = getShadowVisuals(score);

    this.orbEl.className = 'va-orb';
    this.orbEl.classList.add(`orb-${level.key}`);
    this.orbEl.style.setProperty('--orb-pollution', pollution);

    const labels = {
      clean: 'Light shadow',
      moderate: 'Balanced',
      polluted: 'Darkening',
      danger: 'Heavy shadow'
    };
    const statusLabel = document.getElementById('vaOrbLabel');
    if (statusLabel) statusLabel.textContent = labels[level.key] || 'Eco Assistant';
  }

  async onShadowUpdated(score) {
    this.updateOrbFromScore();
    const { pollution } = getShadowVisuals(score);
    let shadowLine;

    if (pollution > 0.65) {
      shadowLine = 'You are harming me today… I feel myself turning darker and heavier. Please choose greener tomorrow.';
    } else if (pollution < 0.25) {
      shadowLine = 'You improved me today! I feel lighter, brighter, and alive. Thank you for caring for our planet.';
    } else {
      shadowLine = 'I feel your choices shifting my form. Every decision changes who I become.';
    }

    this.showResponse(shadowLine, 'shadow');
    await this.app.voice.speakAsShadow(shadowLine);
  }

  /** Auto voice welcome on app load */
  async speakWelcomeBriefing() {
    if (sessionStorage.getItem('shadow_voice_welcome') === '1') return;
    sessionStorage.setItem('shadow_voice_welcome', '1');

    await this.pause(1500);
    const voice = buildShadowEmotionalVoice(this.app.data);
    this.showResponse(voice.text, 'shadow');
    if (this.isOpen) return;
    await this.app.voice.speakAsShadow(stripForSpeech(voice.text));
  }

  pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

