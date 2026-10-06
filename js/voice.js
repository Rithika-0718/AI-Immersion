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
  let lastSpokenLang = 'en';
  let lastCallbacks = null;


  /**
   * Language code to BCP-47 voice tag mapping
   */
  const VOICE_LANG_MAP = {
    en: ['en-IN', 'en-GB', 'en-US', 'en'],
    ta: ['ta-IN', 'ta-LK', 'ta'],
    hi: ['hi-IN', 'hi'],
    te: ['te-IN', 'te'],
    kn: ['kn-IN', 'kn'],
    ml: ['ml-IN', 'ml']
  };


  /**
   * Normalize language code
   * Example:
   * ta-IN → ta
   * en-US → en
   */
  function normalizeLangCode(langCode) {
    if (!langCode) return 'en';

    const code = String(langCode)
      .toLowerCase()
      .replace('_', '-');

    const primary = code.split('-')[0];

    return VOICE_LANG_MAP[primary] ? primary : 'en';
  }


  /**
   * Find the best available voice for the selected language
   */
  function getVoiceForLang(langCode) {

    if (!isSpeechSupported()) {
      return null;
    }

    const normalizedLang = normalizeLangCode(langCode);

    const voices = window.speechSynthesis.getVoices();

    if (!voices || voices.length === 0) {
      return null;
    }

    const targetTags =
      VOICE_LANG_MAP[normalizedLang] ||
      VOICE_LANG_MAP.en;


    // 1. Exact language match
    for (const tag of targetTags) {

      const found = voices.find(voice => {

        if (!voice.lang) return false;

        const voiceLang = voice.lang
          .replace('_', '-')
          .toLowerCase();

        return voiceLang === tag.toLowerCase();
      });

      if (found) {
        return found;
      }
    }


    // 2. Primary-language match
    const primaryLanguage = normalizedLang.toLowerCase();

    const prefixMatch = voices.find(voice => {

      if (!voice.lang) return false;

      const voiceLang = voice.lang
        .replace('_', '-')
        .toLowerCase();

      return voiceLang === primaryLanguage ||
        voiceLang.startsWith(primaryLanguage + '-');
    });

    if (prefixMatch) {
      return prefixMatch;
    }


    // No matching regional/native voice
    return null;
  }


  /**
   * Check whether browser speech synthesis is supported
   */
  function isSpeechSupported() {

    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    );
  }


  /**
   * Build clean spoken script from medicine instructions
   */
  function buildSpeechText(
    medicine,
    langCode,
    customInstructions = null
  ) {

    const normalizedLang = normalizeLangCode(langCode);


    // Custom instruction text
    if (
      customInstructions &&
      typeof customInstructions === 'string' &&
      customInstructions.trim()
    ) {

      const medName =
        (medicine && medicine.name) ||
        'Medicine';

      return `${medName}. ${customInstructions}`;
    }


    // No medicine/instructions
    if (
      !medicine ||
      !medicine.instructions
    ) {
      return '';
    }


    const inst =
      medicine.instructions[normalizedLang] ||
      medicine.instructions.en ||
      {};


    const medName =
      inst.medicine ||
      medicine.name ||
      'Medicine';

    const when = inst.when || '';
    const food = inst.food || '';
    const notes = inst.notes || '';
    const important = inst.important || '';


    // Tamil
    if (normalizedLang === 'ta') {

      return (
        `${medName}. ` +
        `உட்கொள்ள வேண்டிய நேரம்: ${when}. ` +
        `உணவு பற்றிய தகவல்: ${food}. ` +
        `முக்கிய வழிமுறை: ${notes}. ` +
        `பாதுகாப்பு குறிப்பு: ${important}.`
      );
    }


    // Hindi
    if (normalizedLang === 'hi') {

      return (
        `${medName}. ` +
        `लेने का समय: ${when}. ` +
        `भोजन के निर्देश: ${food}. ` +
        `महत्वपूर्ण जानकारी: ${notes}. ` +
        `सुरक्षा सलाह: ${important}.`
      );
    }


    // Telugu
    if (normalizedLang === 'te') {

      return (
        `${medName}. ` +
        `తీసుకునే సమయం: ${when}. ` +
        `ఆహార సూచనలు: ${food}. ` +
        `ముఖ్యమైన సమాచారం: ${notes}. ` +
        `భద్రత: ${important}.`
      );
    }


    // Kannada
    if (normalizedLang === 'kn') {

      return (
        `${medName}. ` +
        `ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ: ${when}. ` +
        `ಆಹಾರದ ಸೂಚನೆಗಳು: ${food}. ` +
        `ಮುಖ್ಯ ಮಾಹಿತಿ: ${notes}. ` +
        `ಸುರಕ್ಷತೆ: ${important}.`
      );
    }


    // Malayalam
    if (normalizedLang === 'ml') {

      return (
        `${medName}. ` +
        `കഴിക്കേണ്ട സമയം: ${when}. ` +
        `ഭക്ഷണ നിർദ്ദേശങ്ങൾ: ${food}. ` +
        `പ്രധാന വിവരങ്ങൾ: ${notes}. ` +
        `സുരക്ഷ: ${important}.`
      );
    }


    // English
    return (
      `${medName}. ` +
      `When to take: ${when}. ` +
      `Food instructions: ${food}. ` +
      `Important information: ${notes}. ` +
      `Safety advisory: ${important}.`
    );
  }


  /**
   * Speak text in selected language
   */
  function speak(text, langCode, callbacks = {}) {

    stop();


    if (!isSpeechSupported()) {

      if (callbacks.onError) {
        callbacks.onError('unavailable');
      }

      return;
    }


    if (
      !text ||
      typeof text !== 'string' ||
      text.trim().length === 0
    ) {

      if (callbacks.onError) {
        callbacks.onError('empty_text');
      }

      return;
    }


    const normalizedLang =
      normalizeLangCode(langCode);


    lastSpokenText = text;
    lastSpokenLang = normalizedLang;
    lastCallbacks = callbacks;


    const voice =
      getVoiceForLang(normalizedLang);


    const targetTag =
      (
        VOICE_LANG_MAP[normalizedLang] &&
        VOICE_LANG_MAP[normalizedLang][0]
      ) || 'en-IN';


    const utterance =
      new SpeechSynthesisUtterance(text);


    /*
     * If a matching voice exists, use it.
     * Otherwise use the requested language tag.
     *
     * This avoids silently using an unrelated language voice.
     */
    if (voice) {

      utterance.voice = voice;
      utterance.lang = voice.lang;

    } else {

      utterance.lang = targetTag;
    }


    // Elderly-friendly speech settings
    utterance.rate = 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;


    /**
     * Speech started
     */
    utterance.onstart = () => {

      isPlaying = true;
      isPausedState = false;

      if (callbacks.onStart) {
        callbacks.onStart();
      }
    };


    /**
     * Speech paused
     */
    utterance.onpause = () => {

      isPausedState = true;

      if (callbacks.onPause) {
        callbacks.onPause();
      }
    };


    /**
     * Speech resumed
     */
    utterance.onresume = () => {

      isPausedState = false;

      if (callbacks.onResume) {
        callbacks.onResume();
      }
    };


    /**
     * Speech completed
     */
    utterance.onend = () => {

      isPlaying = false;
      isPausedState = false;
      currentUtterance = null;

      if (callbacks.onEnd) {
        callbacks.onEnd();
      }
    };


    /**
     * Speech error
     */
    utterance.onerror = (event) => {

      isPlaying = false;
      isPausedState = false;
      currentUtterance = null;


      // Ignore expected cancellation/interruption events
      if (
        event.error !== 'interrupted' &&
        event.error !== 'canceled'
      ) {

        if (callbacks.onError) {

          callbacks.onError(
            event.error || 'playback_error'
          );
        }
      }
    };


    currentUtterance = utterance;


    try {

      window.speechSynthesis.speak(
        utterance
      );

    } catch (err) {

      isPlaying = false;
      isPausedState = false;
      currentUtterance = null;

      if (callbacks.onError) {

        callbacks.onError(
          err.message || 'speak_failed'
        );
      }
    }
  }


  /**
   * Pause speech playback
   */
  function pause() {

    if (
      isSpeechSupported() &&
      isPlaying &&
      !isPausedState
    ) {

      try {

        window.speechSynthesis.pause();
        isPausedState = true;

      } catch (e) {

        console.warn(
          'Speech pause error:',
          e
        );
      }
    }
  }


  /**
   * Resume speech playback
   */
  function resume() {

    if (
      isSpeechSupported() &&
      isPausedState
    ) {

      try {

        window.speechSynthesis.resume();
        isPausedState = false;

      } catch (e) {

        console.warn(
          'Speech resume error:',
          e
        );
      }
    }
  }


  /**
   * Replay the last spoken instructions
   */
  function replay() {

    if (lastSpokenText) {

      speak(
        lastSpokenText,
        lastSpokenLang,
        lastCallbacks || {}
      );
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

        console.warn(
          'Speech cancel error:',
          e
        );
      }
    }

    isPlaying = false;
    isPausedState = false;
    currentUtterance = null;
  }


  /**
   * Get current playback state
   */
  function getIsPlaying() {
    return isPlaying;
  }


  /**
   * Get current pause state
   */
  function getIsPaused() {
    return isPausedState;
  }


  /**
   * Preload available browser voices
   */
  function waitForVoices() {

    return new Promise((resolve) => {

      if (!isSpeechSupported()) {
        resolve([]);
        return;
      }


      const voices =
        window.speechSynthesis.getVoices();


      if (
        voices &&
        voices.length > 0
      ) {

        resolve(voices);
        return;
      }


      let resolved = false;


      const finish = () => {

        if (resolved) return;

        resolved = true;

        resolve(
          window.speechSynthesis.getVoices() || []
        );
      };


      window.speechSynthesis.onvoiceschanged =
        finish;


      setTimeout(
        finish,
        1500
      );
    });
  }


  /**
   * Public API
   */
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


/**
 * Browser export
 */
if (typeof window !== 'undefined') {
  window.Voice = Voice;
}


/**
 * CommonJS export
 */
if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports = Voice;
}
