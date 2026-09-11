/**
 * DoseSpeak — Main Application Controller
 * Orchestrates live DrugDB autocomplete, OCR scan pipeline, multi-language TTS,
 * Prescription Confirmation, Simple View, Easy Mode, and Accessibility
 */

// ─── App State & Global Language ────────────────────────────────
let currentLanguage = 'en';

const State = {
  currentView: 'home',
  selectedMedicine: null,
  customInstructions: null,
  selectedLang: 'en',
  voiceStatus: 'idle', // idle | playing | paused | done | error
  uploadedImageSrc: null,
  isDemo: false,
  searchDebounceTimer: null
};

// ─── View Management ────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add('active');
    const section = document.getElementById('medicine-assistant');
    if (section && viewId !== 'home') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  State.currentView = viewId;
}

// ─── Language Management ────────────────────────────────────────
function setLanguage(code) {
  if (!code) return;
  currentLanguage = code;
  State.selectedLang = code;
  I18N.setLanguage(code);

  // Sync all dropdown selects across the entire app
  document.querySelectorAll('select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select').forEach(sel => {
    if (sel.value !== code) {
      sel.value = code;
    }
  });

  // If a medicine is currently displayed, re-render its instructions in the new language
  if (State.selectedMedicine) {
    renderMedicineInstructions(State.selectedMedicine, code, State.customInstructions);
  }

  // If voice is currently playing or paused, stop it so user can hear in the new language
  if (State.voiceStatus === 'playing' || State.voiceStatus === 'paused') {
    Voice.stop();
    resetVoicePlayer();
  }

  // Refresh recent searches display with updated labels
  renderRecentSearches();
}

// ─── Medicine Result Screen ─────────────────────────────────────
function showMedicineResult(medicine, isDemo = false) {
  if (!medicine) return;

  State.selectedMedicine = medicine;
  State.customInstructions = null;
  State.isDemo = isDemo;
  State.voiceStatus = 'idle';

  // Close custom instructions editor if open
  const customEditor = document.getElementById('custom-instructions-editor');
  const customInput = document.getElementById('custom-instructions-input');
  if (customEditor) customEditor.style.display = 'none';
  if (customInput) customInput.value = '';

  // Save to Recently Viewed history (if not demo)
  if (!isDemo) {
    MedicineData.addRecentlyViewed(medicine);
  }

  // Update header info card
  const nameEl = document.getElementById('result-medicine-name');
  const catEl = document.getElementById('result-medicine-category');
  const iconEl = document.getElementById('result-medicine-icon-el');
  const demoBadge = document.getElementById('result-demo-badge');

  if (nameEl) nameEl.textContent = medicine.name;
  if (catEl) catEl.textContent = medicine.category || 'Prescription Medicine';
  if (iconEl) iconEl.textContent = medicine.icon || '💊';
  if (demoBadge) demoBadge.style.display = isDemo ? 'inline-flex' : 'none';

  // Populate secondary facts
  const genericEl = document.getElementById('result-generic-name');
  const mfgEl = document.getElementById('result-manufacturer-name');
  if (genericEl) genericEl.textContent = medicine.generic || medicine.name;
  if (mfgEl) mfgEl.textContent = medicine.manufacturer || 'Licensed Indian Pharmaceutical Manufacturer';

  // Render instruction cards in current active language
  renderMedicineInstructions(medicine, State.selectedLang);

  // Ensure voice player is reset
  resetVoicePlayer();

  // Show result view
  showView('result');

  // Sync easy mode button state
  Accessibility.updateResultEasyBtn();
}

/**
 * Render factual instruction texts in the specified language
 */
function renderMedicineInstructions(medicine, langCode, customInst = null) {
  if (!medicine || !medicine.instructions) return;

  const inst = medicine.instructions[langCode] || medicine.instructions['en'] || {};

  const nameDisplay = document.getElementById('instr-medicine-name');
  const whenEl = document.getElementById('instr-when');
  const foodEl = document.getElementById('instr-food');
  const notesEl = document.getElementById('instr-notes');
  const importantEl = document.getElementById('instr-important');

  if (nameDisplay) nameDisplay.textContent = inst.medicine || medicine.name;

  if (customInst && typeof customInst === 'string' && customInst.trim()) {
    if (whenEl) whenEl.textContent = customInst;
    if (foodEl) foodEl.textContent = 'Follow prescription instructions provided by your doctor or pharmacist.';
    if (notesEl) notesEl.textContent = 'Take verified prescribed dosage only. Do not alter dose without consultation.';
  } else {
    if (whenEl) whenEl.textContent = inst.when || 'Follow your prescription.';
    if (foodEl) foodEl.textContent = inst.food || 'Take as advised with water.';
    if (notesEl) notesEl.textContent = inst.notes || 'Follow your physician guidelines.';
  }

  if (importantEl) importantEl.textContent = inst.important || 'Store in a cool, dry place.';

  // Update voice button text
  const voiceLabel = document.getElementById('voice-label');
  if (voiceLabel) {
    voiceLabel.textContent = I18N.t('voice.listenBtn', langCode);
  }
}

// ─── Voice / Text-to-Speech Player ──────────────────────────────
function initVoicePlayer() {
  const playBtn = document.getElementById('voice-play-btn');
  const pauseBtn = document.getElementById('voice-pause-btn');
  const resumeBtn = document.getElementById('voice-resume-btn');
  const stopBtn = document.getElementById('voice-stop-btn');
  const replayBtn = document.getElementById('voice-replay-btn');
  const statusEl = document.getElementById('voice-status');
  const waveEl = document.getElementById('sound-wave');
  const unavailEl = document.getElementById('voice-unavailable');

  if (!playBtn) return;

  // 1. Main Play / Toggle Button
  playBtn.addEventListener('click', () => {
    if (State.voiceStatus === 'playing') {
      Voice.pause();
      State.voiceStatus = 'paused';
      playBtn.innerHTML = '▶';
      if (waveEl) waveEl.classList.remove('active');
      if (statusEl) statusEl.textContent = I18N.t('voice.paused', State.selectedLang);
      return;
    }

    if (State.voiceStatus === 'paused') {
      Voice.resume();
      State.voiceStatus = 'playing';
      playBtn.innerHTML = '⏸';
      if (waveEl) waveEl.classList.add('active');
      if (statusEl) statusEl.textContent = I18N.t('voice.playing', State.selectedLang);
      return;
    }

    startVoicePlayback();
  });

  // 2. Pause Button
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (State.voiceStatus === 'playing') {
        Voice.pause();
        State.voiceStatus = 'paused';
        playBtn.innerHTML = '▶';
        if (waveEl) waveEl.classList.remove('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.paused', State.selectedLang);
      }
    });
  }

  // 3. Resume Button
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      if (State.voiceStatus === 'paused') {
        Voice.resume();
        State.voiceStatus = 'playing';
        playBtn.innerHTML = '⏸';
        if (waveEl) waveEl.classList.add('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.playing', State.selectedLang);
      } else if (State.voiceStatus === 'idle' || State.voiceStatus === 'done') {
        startVoicePlayback();
      }
    });
  }

  // 4. Stop Button
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      Voice.stop();
      resetVoicePlayer();
    });
  }

  // 5. Replay Button
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      startVoicePlayback();
    });
  }

  function startVoicePlayback() {
    if (!State.selectedMedicine) return;

    const speechText = Voice.buildSpeechText(State.selectedMedicine, State.selectedLang, State.customInstructions);

    Voice.speak(speechText, State.selectedLang, {
      onStart: () => {
        State.voiceStatus = 'playing';
        playBtn.innerHTML = '⏸';
        playBtn.classList.add('playing');
        if (waveEl) waveEl.classList.add('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.playing', State.selectedLang);
        if (unavailEl) unavailEl.classList.remove('visible');
      },
      onPause: () => {
        State.voiceStatus = 'paused';
        playBtn.innerHTML = '▶';
        if (waveEl) waveEl.classList.remove('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.paused', State.selectedLang);
      },
      onResume: () => {
        State.voiceStatus = 'playing';
        playBtn.innerHTML = '⏸';
        if (waveEl) waveEl.classList.add('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.playing', State.selectedLang);
      },
      onEnd: () => {
        State.voiceStatus = 'done';
        playBtn.innerHTML = '✓';
        playBtn.classList.remove('playing');
        if (waveEl) waveEl.classList.remove('active');
        if (statusEl) statusEl.textContent = I18N.t('voice.done', State.selectedLang);
        setTimeout(resetVoicePlayer, 4000);
      },
      onError: () => {
        State.voiceStatus = 'error';
        resetVoicePlayer();
        if (unavailEl) {
          unavailEl.classList.add('visible');
          unavailEl.textContent = I18N.t('voice.unavailable', State.selectedLang);
        }
      }
    });
  }
}

function resetVoicePlayer() {
  State.voiceStatus = 'idle';
  const playBtn = document.getElementById('voice-play-btn');
  const statusEl = document.getElementById('voice-status');
  const waveEl = document.getElementById('sound-wave');

  if (playBtn) {
    playBtn.innerHTML = '🔊';
    playBtn.classList.remove('playing');
  }
  if (waveEl) waveEl.classList.remove('active');
  if (statusEl) statusEl.textContent = '';
}

// ─── Custom Prescription Instructions Handler ───────────────────
function initCustomInstructions() {
  const toggleBtn = document.getElementById('toggle-custom-instructions-btn');
  const editor = document.getElementById('custom-instructions-editor');
  const input = document.getElementById('custom-instructions-input');
  const saveBtn = document.getElementById('btn-save-custom-inst');
  const cancelBtn = document.getElementById('btn-cancel-custom-inst');

  if (toggleBtn && editor) {
    toggleBtn.addEventListener('click', () => {
      const isVisible = editor.style.display !== 'none';
      editor.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && input) {
        input.focus();
      }
    });
  }

  // Quick preset chips
  document.querySelectorAll('.preset-inst-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) {
        input.value = chip.dataset.inst || '';
        input.focus();
      }
    });
  });

  // Save custom instructions
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const customVal = (input && input.value.trim()) || '';
      if (customVal) {
        State.customInstructions = customVal;
        if (State.selectedMedicine) {
          renderMedicineInstructions(State.selectedMedicine, State.selectedLang, customVal);
        }
        if (editor) editor.style.display = 'none';
        showToast('✓ ' + I18N.t('confirm.saveBtn', State.selectedLang));
      }
    });
  }

  // Cancel custom instructions
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      State.customInstructions = null;
      if (input) input.value = '';
      if (State.selectedMedicine) {
        renderMedicineInstructions(State.selectedMedicine, State.selectedLang, null);
      }
      if (editor) editor.style.display = 'none';
      showToast(I18N.t('confirm.useDefault', State.selectedLang));
    });
  }
}

// ─── Search & Live DrugDB Autocomplete ──────────────────────────
function initSearch() {
  const input = document.getElementById('medicine-search-input');
  const listEl = document.getElementById('autocomplete-list');
  let highlightedIndex = -1;

  if (!input || !listEl) return;

  // Real-time debounced input handler (350ms)
  input.addEventListener('input', () => {
    const q = input.value.trim();

    if (State.searchDebounceTimer) {
      clearTimeout(State.searchDebounceTimer);
    }

    if (q.length < 2) {
      closeAutocomplete(listEl);
      return;
    }

    // Show localized loading state
    renderAutocompleteLoading(listEl);

    State.searchDebounceTimer = setTimeout(async () => {
      try {
        const results = await DrugDB.search(q);
        renderAutocompleteResults(results, listEl, q);
        highlightedIndex = -1;
      } catch (e) {
        renderAutocompleteError(listEl, q);
      }
    }, 350);
  });

  // Keyboard navigation inside suggestions
  input.addEventListener('keydown', (e) => {
    const items = listEl.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      updateAutocompleteHighlight(items, highlightedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      updateAutocompleteHighlight(items, highlightedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        items[highlightedIndex].click();
      }
    } else if (e.key === 'Escape') {
      closeAutocomplete(listEl);
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !listEl.contains(e.target)) {
      closeAutocomplete(listEl);
    }
  });

  // Render recently viewed on search screen
  renderRecentSearches();
}

function renderAutocompleteLoading(listEl) {
  listEl.innerHTML = `
    <div class="autocomplete-status">
      <div class="spinner-sm"></div>
      <span>${I18N.t('search.loading')}</span>
    </div>
  `;
  listEl.classList.add('open');
}

function renderAutocompleteError(listEl, query = '') {
  listEl.innerHTML = `
    <div class="autocomplete-status error" style="display:flex; flex-direction:column; gap:8px;">
      <span>⚠️ ${I18N.t('search.apiError')}</span>
      <button class="btn btn-secondary btn-sm" id="btn-retry-search" style="margin:0 auto;" type="button">
        ↻ ${I18N.t('search.retryBtn')}
      </button>
    </div>
  `;
  listEl.classList.add('open');

  const retryBtn = document.getElementById('btn-retry-search');
  if (retryBtn) {
    retryBtn.onclick = async () => {
      renderAutocompleteLoading(listEl);
      try {
        const results = await DrugDB.search(query);
        renderAutocompleteResults(results, listEl, query);
      } catch (err) {
        renderAutocompleteError(listEl, query);
      }
    };
  }
}

function renderAutocompleteResults(results, listEl, query) {
  if (!results || results.length === 0) {
    listEl.innerHTML = `
      <div class="autocomplete-status empty">
        <span>🔍 ${I18N.t('search.noResults')}</span>
      </div>
    `;
    listEl.classList.add('open');
    return;
  }

  // Render up to 20 suggestions with rich metadata
  listEl.innerHTML = results.slice(0, 20).map((med, idx) => `
    <div class="autocomplete-item" data-index="${idx}" role="option" tabindex="0">
      <span class="autocomplete-item-icon">${med.icon || '💊'}</span>
      <div class="autocomplete-item-details">
        <div class="autocomplete-item-name">${highlightMatch(med.name, query)}</div>
        <div class="autocomplete-item-meta">
          <span class="autocomplete-item-generic">${med.generic || med.category}</span>
          ${med.manufacturer ? `<span class="autocomplete-item-mfg">• ${med.manufacturer}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  listEl.classList.add('open');

  // Attach click events
  listEl.querySelectorAll('.autocomplete-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const selected = results[idx];
      if (selected) {
        const input = document.getElementById('medicine-search-input');
        if (input) input.value = selected.name;
        closeAutocomplete(listEl);
        showMedicineResult(selected, false);
      }
    });
  });
}

function updateAutocompleteHighlight(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === index);
    if (i === index) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

function closeAutocomplete(listEl) {
  if (listEl) {
    listEl.classList.remove('open');
    listEl.innerHTML = '';
  }
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Recently Viewed History ────────────────────────────────────
function renderRecentSearches() {
  const container = document.getElementById('recent-searches-list');
  const wrap = document.getElementById('recent-searches-wrap');
  if (!container || !wrap) return;

  const recent = MedicineData.getRecentlyViewed();
  if (recent.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  container.innerHTML = recent.map(m => `
    <button class="recent-chip" data-id="${m.id}" data-name="${m.name}" type="button">
      <span class="recent-chip-icon">${m.icon || '💊'}</span>
      <span class="recent-chip-name">${m.name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.recent-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const name = chip.dataset.name;
      const id = chip.dataset.id;
      const preset = MedicineData.getPresetById(id);
      if (preset) {
        showMedicineResult(preset, false);
        return;
      }
      const results = await DrugDB.search(name);
      if (results && results.length > 0) {
        showMedicineResult(results[0], false);
      }
    });
  });

  // Clear history button
  const clearBtn = document.getElementById('clear-history-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      MedicineData.clearRecentlyViewed();
      renderRecentSearches();
      showToast(I18N.t('search.clearHistory'));
    };
  }
}

// ─── Scan Flow & OCR ────────────────────────────────────────────
function initScan() {
  const fileInput = document.getElementById('scan-file-input');
  const cameraBtn = document.getElementById('scan-camera-btn');
  const uploadBtn = document.getElementById('scan-upload-btn');
  const uploadArea = document.getElementById('scan-upload-area');
  const processBtn = document.getElementById('scan-process-btn');
  const changeBtn = document.getElementById('scan-change-btn');
  const preview = document.getElementById('image-preview');
  const previewWrap = document.getElementById('image-preview-wrap');

  if (!fileInput) return;

  // Open Camera
  if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
      fileInput.setAttribute('capture', 'environment');
      fileInput.click();
    });
  }

  // Upload Photo
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
    });
  }

  // Drag & drop on upload area
  if (uploadArea) {
    uploadArea.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragging');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragging');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragging');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleSelectedImage(file, preview, previewWrap, processBtn, uploadArea, changeBtn);
      }
    });
  }

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleSelectedImage(file, preview, previewWrap, processBtn, uploadArea, changeBtn);
    }
  });

  // Change photo button
  if (changeBtn) {
    changeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetScanView();
      fileInput.click();
    });
  }

  // Process / Read button
  if (processBtn) {
    processBtn.addEventListener('click', () => {
      if (State.uploadedImageSrc) {
        processUploadedImage(State.uploadedImageSrc);
      }
    });
  }
}

function handleSelectedImage(file, preview, previewWrap, processBtn, uploadArea, changeBtn) {
  const reader = new FileReader();
  reader.onload = (e) => {
    State.uploadedImageSrc = e.target.result;
    if (preview) preview.src = e.target.result;
    if (previewWrap) previewWrap.classList.add('visible');
    if (uploadArea) uploadArea.style.display = 'none';
    if (processBtn) processBtn.style.display = 'block';
    if (changeBtn) changeBtn.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

async function processUploadedImage(src) {
  showView('processing');
  const statusTitle = document.getElementById('processing-status-title');
  const statusSubtitle = document.getElementById('processing-status-subtitle');

  if (statusTitle) statusTitle.textContent = I18N.t('processing.title');
  if (statusSubtitle) statusSubtitle.textContent = I18N.t('processing.subtitle');

  const result = await OCR.processImage(src, {
    onStatus: (status) => {
      if (statusTitle) {
        statusTitle.textContent = status === 'reading'
          ? I18N.t('processing.title')
          : I18N.t('how.step2.title');
      }
    }
  });

  if (result.success && result.medicine) {
    showMedicineResult(result.medicine, result.isDemo);
  } else {
    showView('scan-error');
  }
}

function resetScanView() {
  State.uploadedImageSrc = null;
  const previewWrap = document.getElementById('image-preview-wrap');
  const uploadArea = document.getElementById('scan-upload-area');
  const processBtn = document.getElementById('scan-process-btn');
  const changeBtn = document.getElementById('scan-change-btn');
  const preview = document.getElementById('image-preview');

  if (previewWrap) previewWrap.classList.remove('visible');
  if (uploadArea) uploadArea.style.display = '';
  if (processBtn) processBtn.style.display = 'none';
  if (changeBtn) changeBtn.style.display = 'none';
  if (preview) preview.src = '';
}

// ─── Prototype Demo Mode ────────────────────────────────────────
function initDemoMode() {
  const demoBtns = document.querySelectorAll('#demo-mode-btn, .trigger-demo-mode');

  demoBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const section = document.getElementById('medicine-assistant');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

      showView('processing');
      const statusTitle = document.getElementById('processing-status-title');
      if (statusTitle) statusTitle.textContent = I18N.t('processing.title', 'ta');

      await OCR.runDemoFlow({
        onStatus: (status) => {
          if (statusTitle) {
            statusTitle.textContent = status === 'reading'
              ? 'மருந்து அட்டையை வாசிக்கிறது...'
              : 'பாராசிட்டமால் 500 மி.கி. அடையாளம் காணப்பட்டது!';
          }
        },
        onComplete: (demoMed) => {
          // Switch to Tamil for presentation demonstration
          setLanguage('ta');
          showMedicineResult(demoMed, true);
          showToast(I18N.t('demo.toast', 'ta'));
        }
      });
    });
  });
}

// ─── Header & Accessibility Controls ────────────────────────────
function initHeaderAndAccessibility() {
  const header = document.querySelector('.header');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const a11yToggle = document.getElementById('a11y-panel-toggle');
  const a11yPanel = document.getElementById('a11y-panel');

  // Sticky header shadow on scroll
  window.addEventListener('scroll', () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Mobile menu toggle
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close on nav link click
    mobileMenu.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Accessibility dialog panel
  if (a11yToggle && a11yPanel) {
    a11yToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = a11yPanel.classList.toggle('open');
      a11yToggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!a11yPanel.contains(e.target) && !a11yToggle.contains(e.target)) {
        a11yPanel.classList.remove('open');
        a11yToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Panel toggles
    const easyToggle = document.getElementById('a11y-easy-toggle');
    const contrastToggle = document.getElementById('a11y-contrast-toggle');
    const textToggle = document.getElementById('a11y-text-toggle');
    const fontInc = document.getElementById('a11y-font-inc');
    const fontDec = document.getElementById('a11y-font-dec');
    const fontReset = document.getElementById('a11y-font-reset');

    if (easyToggle) easyToggle.onchange = () => Accessibility.setEasyMode(easyToggle.checked);
    if (contrastToggle) contrastToggle.onchange = () => Accessibility.setHighContrast(contrastToggle.checked);
    if (textToggle) textToggle.onchange = () => Accessibility.setLargeText(textToggle.checked);
    if (fontInc) fontInc.onclick = () => Accessibility.increaseFontSize();
    if (fontDec) fontDec.onclick = () => Accessibility.decreaseFontSize();
    if (fontReset) fontReset.onclick = () => Accessibility.resetFontSize();
  }

  // Easy Mode Floating Action Button (FAB)
  const fab = document.getElementById('easy-mode-fab');
  if (fab) {
    fab.addEventListener('click', () => {
      const newState = !Accessibility.isEasyMode();
      Accessibility.setEasyMode(newState);
      showToast(newState ? '👵 Easy Mode: ON' : 'Easy Mode: OFF');
    });
  }

  // Language selector cycling on header button
  const headerLangBtn = document.getElementById('header-lang-btn');
  if (headerLangBtn) {
    headerLangBtn.addEventListener('click', () => {
      const langs = I18N.languages;
      const idx = langs.findIndex(l => l.code === State.selectedLang);
      const nextLang = langs[(idx + 1) % langs.length];
      setLanguage(nextLang.code);
      showToast(`🌐 Language: ${nextLang.native}`);
    });
  }

  // Start DoseSpeak Header button
  const startBtn = document.getElementById('header-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const section = document.getElementById('medicine-assistant');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ─── Navigation & Button Handlers ───────────────────────────────
function initNavigationHandlers() {
  // Hero CTA buttons
  const heroCta = document.getElementById('hero-cta-btn');
  if (heroCta) {
    heroCta.addEventListener('click', () => {
      const section = document.getElementById('medicine-assistant');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Option Cards on Assistant Home
  const optionScan = document.getElementById('option-scan');
  const optionSearch = document.getElementById('option-search');
  const optionScanBtn = document.getElementById('option-scan-btn');
  const optionSearchBtn = document.getElementById('option-search-btn');

  if (optionScan) optionScan.onclick = () => { showView('scan'); resetScanView(); };
  if (optionSearch) optionSearch.onclick = () => { showView('search'); renderRecentSearches(); };
  if (optionScanBtn) optionScanBtn.onclick = (e) => { e.stopPropagation(); showView('scan'); resetScanView(); };
  if (optionSearchBtn) optionSearchBtn.onclick = (e) => { e.stopPropagation(); showView('search'); renderRecentSearches(); };

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      Voice.stop();
      resetVoicePlayer();
      showView(btn.dataset.back || 'home');
    });
  });

  // Start Over button in Result view
  const startOverBtn = document.getElementById('result-start-over-btn');
  if (startOverBtn) {
    startOverBtn.addEventListener('click', () => {
      Voice.stop();
      resetVoicePlayer();
      showView('home');
    });
  }

  // Simple View Toggle button in Result view
  const simpleViewBtn = document.getElementById('simple-view-toggle-btn');
  if (simpleViewBtn) {
    simpleViewBtn.addEventListener('click', () => {
      Accessibility.setSimpleView(!Accessibility.isSimpleView());
    });
  }

  // Result Easy Mode Toggle button
  const resultEasyBtn = document.getElementById('easy-mode-toggle-result');
  if (resultEasyBtn) {
    resultEasyBtn.addEventListener('click', () => {
      Accessibility.setEasyMode(!Accessibility.isEasyMode());
    });
  }

  // Scan Error Recovery buttons
  const tryAgainBtn = document.getElementById('scan-error-try-again');
  const manualBtn = document.getElementById('scan-error-manual');
  if (tryAgainBtn) tryAgainBtn.onclick = () => { showView('scan'); resetScanView(); };
  if (manualBtn) manualBtn.onclick = () => { showView('search'); renderRecentSearches(); };

  // Common medicine quick-search buttons
  document.querySelectorAll('[data-preset-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetId = btn.dataset.presetId;
      const preset = MedicineData.getPresetById(presetId);
      if (preset) {
        showMedicineResult(preset, false);
      }
    });
  });

  // Language select dropdowns (header, a11y panel, mobile menu, result aside)
  document.querySelectorAll('select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  });

  // Language buttons (footer, quick links, picker buttons)
  document.querySelectorAll('.lang-btn[data-lang], .lang-picker-item[data-lang], .footer-lang-link[data-lang]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = btn.dataset.lang;
      setLanguage(code);
    });
  });
}

// ─── FAQ Accordions ─────────────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const qBtn = item.querySelector('.faq-question');
    if (qBtn) {
      qBtn.addEventListener('click', () => {
        const isCurrentlyOpen = item.classList.contains('open');
        // Close other items
        document.querySelectorAll('.faq-item').forEach(i => {
          i.classList.remove('open');
          const b = i.querySelector('.faq-question');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
        // Toggle current item
        if (!isCurrentlyOpen) {
          item.classList.add('open');
          qBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });
}

// ─── Chart Bar Animation ─────────────────────────────────────────
function initChartBars() {
  const bars = document.querySelectorAll('.chart-bar-fill-elderly, .chart-bar-fill-younger');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.style.width = el.dataset.width || '0%';
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    bars.forEach(b => {
      b.style.width = '0%';
      observer.observe(b);
    });
  } else {
    bars.forEach(b => b.style.width = b.dataset.width || '0%');
  }
}

// ─── Scroll Reveal ───────────────────────────────────────────────
function initScrollReveal() {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }
}

// ─── Toast Notifications ─────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ─── Application Initialization ─────────────────────────────────
async function initApp() {
  // 1. Initialize Accessibility settings
  const a11y = Accessibility.load();

  // 2. Initialize i18n with English as default
  I18N.init('en');
  currentLanguage = I18N.currentLang;
  State.selectedLang = currentLanguage;

  // Sync all select dropdowns immediately
  document.querySelectorAll('select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select').forEach(sel => {
    sel.value = currentLanguage;
  });

  // 3. Sync UI toggles
  const easyToggle = document.getElementById('a11y-easy-toggle');
  const contrastToggle = document.getElementById('a11y-contrast-toggle');
  const textToggle = document.getElementById('a11y-text-toggle');
  if (easyToggle) easyToggle.checked = a11y.easyMode;
  if (contrastToggle) contrastToggle.checked = a11y.highContrast;
  if (textToggle) textToggle.checked = a11y.largeText;

  // 4. Initialize Core Modules
  initHeaderAndAccessibility();
  initNavigationHandlers();
  initSearch();
  initCustomInstructions();
  initScan();
  initVoicePlayer();
  initFAQ();
  initChartBars();
  initScrollReveal();
  initDemoMode();

  // 5. Preload speech voices & OCR worker non-blockingly
  Voice.waitForVoices().catch(() => {});
  if (typeof Tesseract !== 'undefined') {
    OCR.init().catch(() => {});
  }

  // 6. Set initial view
  showView('home');
}

// Global attachments for interoperability
if (typeof window !== 'undefined') {
  window.currentLanguage = currentLanguage;
  window.setLanguage = setLanguage;
  window.State = State;
  window.showMedicineResult = showMedicineResult;
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
