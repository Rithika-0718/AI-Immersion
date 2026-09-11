/**
 * DoseSpeak — Voice / Text-to-Speech (TTS) Module
 * Multi-language speech synthesis with elderly-friendly controls:
 * Listen, Pause, Resume, Stop, Replay
 */

const Voice = (() => {
  let currentUtterance = null;
  let isPlaying = false;
  let isPausedState = false;
  let lastSpokenText = '';
  let lastSpokenLang = 'ta';
  let lastCallbacks = null;

  // Language code to BCP-47 voice tag mapping
  const VOICE_LANG_MAP = {
    'ta': ['ta-IN', 'ta_IN', 'ta'],
    'hi': ['hi-IN', 'hi_IN', 'hi'],
    'te': ['te-IN', 'te_IN', 'te'],
    'kn': ['kn-IN', 'kn_IN', 'kn'],
    'ml': ['ml-IN', 'ml_IN', 'ml'],
    'en': ['en-IN', 'en-GB', 'en-US', 'en']
  };

  /**
   * Find best available voice for language code
   */
  function getVoiceForLang(langCode) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetTags = VOICE_LANG_MAP[langCode] || ['en-IN', 'en'];

    // 1. Try exact matches
    for (const tag of targetTags) {
      const found = voices.find(v => v.lang && (v.lang.toLowerCase() === tag.toLowerCase() || v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase()));
      if (found) return found;
    }

    // 2. Try prefix match (e.g. 'ta' in 'ta-LK' or 'ta-IN')
    const primary = targetTags[0].split('-')[0];
    const prefixMatch = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(primary.toLowerCase()));
    if (prefixMatch) return prefixMatch;

    // 3. Fallback to English voice if regional language voice is absent
    const fallbackEn = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    return fallbackEn || voices[0] || null;
  }

  /**
   * Check if speech synthesis is supported
   */
  function isSpeechSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Build clean spoken script from medicine factual instructions
   */
  function buildSpeechText(medicine, langCode, customInstructions = null) {
    if (customInstructions && typeof customInstructions === 'string' && customInstructions.trim()) {
      const medName = (medicine && medicine.name) || 'Medicine';
      return `${medName}. ${customInstructions}`;
    }

    if (!medicine || !medicine.instructions) return '';
    const inst = medicine.instructions[langCode] || medicine.instructions['en'] || {};

    const medName = inst.medicine || medicine.name || 'Medicine';
    const when = inst.when || '';
    const food = inst.food || '';
    const notes = inst.notes || '';
    const important = inst.important || '';

    if (langCode === 'ta') {
      return `${medName}. உட்கொள்ள வேண்டிய நேரம்: ${when}. உணவு பற்றிய தகவல்: ${food}. முக்கிய வழிமுறை: ${notes}. பாதுகாப்பு குறிப்பு: ${important}.`;
    } else if (langCode === 'hi') {
      return `${medName}. लेने का समय: ${when}. भोजन के निर्देश: ${food}. महत्वपूर्ण जानकारी: ${notes}. सुरक्षा सलाह: ${important}.`;
    } else if (langCode === 'te') {
      return `${medName}. తీసుకునే సమయం: ${when}. ఆహార సూచనలు: ${food}. ముఖ్యమైన సమాచారం: ${notes}. భద్రత: ${important}.`;
    } else if (langCode === 'kn') {
      return `${medName}. ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ: ${when}. ಆಹಾರದ ಸೂಚನೆಗಳು: ${food}. ಮುಖ್ಯ ಮಾಹಿತಿ: ${notes}. ಸುರಕ್ಷತೆ: ${important}.`;
    } else if (langCode === 'ml') {
      return `${medName}. കഴിക്കേണ്ട സമയം: ${when}. ഭക്ഷണ നിർദ്ദേശങ്ങൾ: ${food}. പ്രധാന വിവരങ്ങൾ: ${notes}. സുരക്ഷ: ${important}.`;
    } else {
      return `${medName}. When to take: ${when}. Food instructions: ${food}. Important information: ${notes}. Safety advisory: ${important}.`;
    }
  }

  /**
   * Speak text in chosen language
   */
  function speak(text, langCode, callbacks = {}) {
    stop();

    if (!isSpeechSupported()) {
      if (callbacks.onError) callbacks.onError('unavailable');
      return;
    }

    if (!text || text.trim().length === 0) {
      if (callbacks.onError) callbacks.onError('empty_text');
      return;
    }

    lastSpokenText = text;
    lastSpokenLang = langCode;
    lastCallbacks = callbacks;

    const voice = getVoiceForLang(langCode);
    const targetTag = (VOICE_LANG_MAP[langCode] && VOICE_LANG_MAP[langCode][0]) || 'en-IN';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice ? voice.lang : targetTag;
    if (voice) {
      utterance.voice = voice;
    }

    // Elderly-friendly cadence: slightly slower and very clear
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      isPlaying = true;
      isPausedState = false;
      if (callbacks.onStart) callbacks.onStart();
    };

    utterance.onpause = () => {
      isPausedState = true;
      if (callbacks.onPause) callbacks.onPause();
    };

    utterance.onresume = () => {
      isPausedState = false;
      if (callbacks.onResume) callbacks.onResume();
    };

    utterance.onend = () => {
      isPlaying = false;
      isPausedState = false;
      currentUtterance = null;
      if (callbacks.onEnd) callbacks.onEnd();
    };

    utterance.onerror = (e) => {
      isPlaying = false;
      isPausedState = false;
      currentUtterance = null;
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        if (callbacks.onError) callbacks.onError(e.error || 'playback_error');
      }
    };

    currentUtterance = utterance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      isPlaying = false;
      isPausedState = false;
      if (callbacks.onError) callbacks.onError(err.message || 'speak_failed');
    }
  }

  /**
   * Pause speech playback
   */
  function pause() {
    if (isSpeechSupported() && isPlaying && !isPausedState) {
      try {
        window.speechSynthesis.pause();
        isPausedState = true;
      } catch (e) {
        console.warn('Speech pause error:', e);
      }
    }
  }

  /**
   * Resume speech playback
   */
  function resume() {
    if (isSpeechSupported() && isPausedState) {
      try {
        window.speechSynthesis.resume();
        isPausedState = false;
      } catch (e) {
        console.warn('Speech resume error:', e);
      }
    }
  }

  /**
   * Replay last spoken instructions
   */
  function replay() {
    if (lastSpokenText) {
      speak(lastSpokenText, lastSpokenLang, lastCallbacks || {});
    }
  }

  /**
   * Stop voice playback
   */
  function stop() {
    if (isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Speech cancel error:', e);
      }
    }
    isPlaying = false;
    isPausedState = false;
    currentUtterance = null;
  }

  function getIsPlaying() {
    return isPlaying;
  }

  function getIsPaused() {
    return isPausedState;
  }

  /**
   * Preload voices in browser
   */
  function waitForVoices() {
    return new Promise((resolve) => {
      if (!isSpeechSupported()) return resolve([]);
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        return resolve(voices);
      }
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices() || []);
      };
      setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 1500);
    });
  }

  return {
    speak,
    pause,
    resume,
    replay,
    stop,
    buildSpeechText,
    getVoiceForLang,
    getIsPlaying,
    getIsPaused,
    waitForVoices,
    isSpeechSupported
  };
})();

if (typeof window !== 'undefined') {
  window.Voice = Voice;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Voice;
}
