/**
 * Voice features — Speech-to-Text & Text-to-Speech
 */

export class VoiceManager {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.isSpeaking = false;
    this.ttsEnabled = true;
    this.onResult = null;
    this.onStatus = null;
    this.onSpeakStart = null;
    this.onSpeakEnd = null;
    this._queue = [];
    this._queueRunning = false;

    this.initRecognition();
    this.loadVoices();
  }

  loadVoices() {
    if (!this.synthesis) return;
    this.synthesis.getVoices();
    this.synthesis.onvoiceschanged = () => this.synthesis.getVoices();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.emitStatus('Listening…');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emitStatus('');
    };

    this.recognition.onerror = (e) => {
      this.isListening = false;
      this.emitStatus(e.error === 'not-allowed' ? 'Microphone access denied' : 'Voice error — try again');
    };

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');

      this.emitStatus(transcript);

      if (event.results[event.results.length - 1].isFinal && this.onResult) {
        this.onResult(transcript.trim());
      }
    };
  }

  startListening(onResult, onStatus) {
    if (!this.recognition) {
      this.emitStatus('Voice not supported in this browser');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
      return false;
    }

    this.onResult = onResult;
    this.onStatus = onStatus;
    this.recognition.start();
    return true;
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  emitStatus(msg) {
    if (this.onStatus) this.onStatus(msg);
  }

  pickVoice(preferMale = false) {
    const voices = this.synthesis?.getVoices() || [];
    if (preferMale) {
      return voices.find(v => v.lang.startsWith('en') && /male|david|mark|daniel/i.test(v.name))
        || voices.find(v => v.lang.startsWith('en'));
    }
    return voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || /female|zira|samantha/i.test(v.name)))
      || voices.find(v => v.lang.startsWith('en'));
  }

  speak(text, options = {}) {
    if (!this.ttsEnabled || !this.synthesis || !text) return Promise.resolve();

    return new Promise((resolve) => {
      this.synthesis.cancel();
      this._queue = [];
      this._queueRunning = false;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = options.pitch ?? 1.1;
      utterance.volume = options.volume ?? 1;
      utterance.voice = options.voice || this.pickVoice(options.preferMale);

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.onSpeakStart?.(options.speaker || 'eco');
      };
      utterance.onend = () => {
        this.isSpeaking = false;
        this.onSpeakEnd?.();
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  /** Shadow Twin voice — slower, deeper, emotional */
  speakAsShadow(text) {
    return this.speak(text, {
      speaker: 'shadow',
      pitch: 0.75,
      rate: 0.82,
      volume: 1,
      preferMale: true
    });
  }

  /** Eco Assistant voice — friendly coach */
  speakAsEco(text) {
    return this.speak(text, {
      speaker: 'eco',
      pitch: 1.12,
      rate: 0.92,
      volume: 1
    });
  }

  speakShadowMessage(message) {
    return this.speakAsShadow(message);
  }

  /** Speak multiple segments — shadow + eco alternating */
  async speakBriefing(segments) {
    if (!this.ttsEnabled || !this.synthesis) return;

    this.stop();
    this._queue = Array.isArray(segments) ? segments : [segments];
    this._queueRunning = true;

    for (const segment of this._queue) {
      if (!this._queueRunning) break;
      const item = segment.speaker
        ? segment
        : { speaker: 'eco', text: segment.text || segment };

      const text = item.text;
      if (!text) continue;

      if (item.speaker === 'shadow') {
        await this.speakAsShadow(text);
      } else {
        await this.speakAsEco(text);
      }

      await this.pause(400);
    }

    this._queueRunning = false;
    this.onSpeakEnd?.();
  }

  pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  stop() {
    this._queueRunning = false;
    this._queue = [];
    this.synthesis?.cancel();
    this.isSpeaking = false;
  }

  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    if (!this.ttsEnabled) this.stop();
    return this.ttsEnabled;
  }

  isSupported() {
    return !!(this.recognition || this.synthesis);
  }
}

export function parseVoiceInput(transcript) {
  const lower = transcript.toLowerCase();
  const result = {};

  if (/\b(bike|bicycle|cycling|cycle|biked)\b/.test(lower)) result.travel = 'bike';
  else if (/\b(bus|transit|public transport|metro|train)\b/.test(lower)) result.travel = 'bus';
  else if (/\b(car|drive|driving|taxi|uber|drove)\b/.test(lower)) result.travel = 'car';

  if (/\b(veg|vegetarian|plant|salad|vegan|veggie)\b/.test(lower)) result.food = 'veg';
  else if (/\b(non.?veg|meat|chicken|beef|non vegetarian|nonveg)\b/.test(lower)) result.food = 'nonveg';

  if (/\b(low|minimal|little)\b/.test(lower) && /\b(electric|power|energy|usage)\b/.test(lower)) {
    result.electricity = 'low';
  } else if (/\b(high|heavy|lots|a lot)\b/.test(lower) && /\b(electric|power|energy|usage)\b/.test(lower)) {
    result.electricity = 'high';
  } else if (/\b(medium|moderate|average|normal)\b/.test(lower) && /\b(electric|power|energy|usage)\b/.test(lower)) {
    result.electricity = 'medium';
  } else if (/\belectricity low\b/.test(lower) || /\blow electricity\b/.test(lower)) {
    result.electricity = 'low';
  } else if (/\belectricity high\b/.test(lower) || /\bhigh electricity\b/.test(lower)) {
    result.electricity = 'high';
  } else if (/\belectricity medium\b/.test(lower) || /\bmedium electricity\b/.test(lower)) {
    result.electricity = 'medium';
  }

  return result;
}
