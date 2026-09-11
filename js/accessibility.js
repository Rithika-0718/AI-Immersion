/**
 * DoseSpeak — Accessibility & View Modes Module
 * Manages Easy Mode, Simple View, High Contrast, Large Text, Font Size Scaling, and keyboard focus
 */

const Accessibility = (() => {
  const KEYS = {
    easyMode:     'dosespeak_easy_mode',
    simpleView:   'dosespeak_simple_view',
    highContrast: 'dosespeak_high_contrast',
    largeText:    'dosespeak_large_text',
    fontSizeStep: 'dosespeak_font_size_step',
    language:     'dosespeak_language'
  };

  let currentFontStep = 0; // -1 (smaller), 0 (normal), 1 (large), 2 (extra large)

  /**
   * Load and apply all stored preferences
   */
  function load() {
    const easyMode     = localStorage.getItem(KEYS.easyMode) === 'true';
    const simpleView   = localStorage.getItem(KEYS.simpleView) === 'true';
    const highContrast = localStorage.getItem(KEYS.highContrast) === 'true';
    const largeText    = localStorage.getItem(KEYS.largeText) === 'true';
    const savedStep    = parseInt(localStorage.getItem(KEYS.fontSizeStep) || '0', 10);

    currentFontStep = isNaN(savedStep) ? 0 : savedStep;

    apply({ easyMode, simpleView, highContrast, largeText, fontStep: currentFontStep });
    return { easyMode, simpleView, highContrast, largeText, fontStep: currentFontStep };
  }

  function apply({ easyMode, simpleView, highContrast, largeText, fontStep }) {
    document.body.classList.toggle('easy-mode', !!easyMode);
    document.body.classList.toggle('simple-view-mode', !!simpleView);
    document.body.classList.toggle('high-contrast', !!highContrast);
    document.body.classList.toggle('large-text', !!largeText);
    applyFontStep(fontStep !== undefined ? fontStep : currentFontStep);
  }

  function applyFontStep(step) {
    currentFontStep = Math.max(-1, Math.min(2, step));
    localStorage.setItem(KEYS.fontSizeStep, currentFontStep.toString());

    document.body.classList.remove('font-step-minus', 'font-step-plus1', 'font-step-plus2');
    if (currentFontStep === -1) document.body.classList.add('font-step-minus');
    if (currentFontStep === 1)  document.body.classList.add('font-step-plus1');
    if (currentFontStep === 2)  document.body.classList.add('font-step-plus2');

    const displayEl = document.getElementById('font-size-display');
    if (displayEl) {
      displayEl.textContent = currentFontStep === 0 ? '100%' : currentFontStep === 1 ? '120%' : currentFontStep === 2 ? '140%' : '90%';
    }
  }

  function increaseFontSize() {
    applyFontStep(currentFontStep + 1);
  }

  function decreaseFontSize() {
    applyFontStep(currentFontStep - 1);
  }

  function resetFontSize() {
    applyFontStep(0);
  }

  function setEasyMode(val) {
    localStorage.setItem(KEYS.easyMode, val ? 'true' : 'false');
    document.body.classList.toggle('easy-mode', !!val);

    // Update panel checkbox
    const panelToggle = document.getElementById('a11y-easy-toggle');
    if (panelToggle) panelToggle.checked = !!val;

    // Update FAB text
    const fab = document.getElementById('easy-mode-fab');
    if (fab) {
      fab.innerHTML = val ? '👵 Easy Mode: ON' : '👵 Easy Mode';
      fab.classList.toggle('active', !!val);
    }

    // Update result view toggle button if present
    updateResultEasyBtn();
  }

  function setSimpleView(val) {
    localStorage.setItem(KEYS.simpleView, val ? 'true' : 'false');
    document.body.classList.toggle('simple-view-mode', !!val);

    const btn = document.getElementById('simple-view-toggle-btn');
    if (btn) {
      const isSimple = isSimpleView();
      btn.innerHTML = isSimple
        ? `📋 <span data-i18n="result.standardViewToggle">${I18N.t('result.standardViewToggle')}</span>`
        : `👵 <span data-i18n="result.simpleViewToggle">${I18N.t('result.simpleViewToggle')}</span>`;
      btn.classList.toggle('active', isSimple);
    }
  }

  function setHighContrast(val) {
    localStorage.setItem(KEYS.highContrast, val ? 'true' : 'false');
    document.body.classList.toggle('high-contrast', !!val);

    const panelToggle = document.getElementById('a11y-contrast-toggle');
    if (panelToggle) panelToggle.checked = !!val;
  }

  function setLargeText(val) {
    localStorage.setItem(KEYS.largeText, val ? 'true' : 'false');
    document.body.classList.toggle('large-text', !!val);

    const panelToggle = document.getElementById('a11y-text-toggle');
    if (panelToggle) panelToggle.checked = !!val;
  }

  function updateResultEasyBtn() {
    const btn = document.getElementById('easy-mode-toggle-result');
    if (btn) {
      const isEasy = isEasyMode();
      btn.textContent = isEasy ? 'Disable Easy Mode' : 'Enable Easy Mode';
      btn.classList.toggle('active', isEasy);
    }
  }

  function isEasyMode()     { return document.body.classList.contains('easy-mode'); }
  function isSimpleView()   { return document.body.classList.contains('simple-view-mode'); }
  function isHighContrast() { return document.body.classList.contains('high-contrast'); }
  function isLargeText()    { return document.body.classList.contains('large-text'); }
  function getFontStep()    { return currentFontStep; }

  return {
    load,
    apply,
    setEasyMode,
    setSimpleView,
    setHighContrast,
    setLargeText,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    isEasyMode,
    isSimpleView,
    isHighContrast,
    isLargeText,
    getFontStep,
    updateResultEasyBtn
  };
})();

if (typeof window !== 'undefined') {
  window.Accessibility = Accessibility;
}
