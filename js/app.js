```javascript
/**
 * DoseSpeak — Main Application Controller
 * Orchestrates:
 * - Live DrugDB autocomplete
 * - OCR scan pipeline
 * - Multi-language TTS
 * - Prescription confirmation
 * - Simple View
 * - Easy Mode
 * - Accessibility
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


// ─── Utility Helpers ────────────────────────────────────────────

function escapeHTML(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function normalizeLanguage(code) {
  if (!code) return 'en';

  const normalized = String(code)
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0];

  if (
    typeof I18N !== 'undefined' &&
    Array.isArray(I18N.languages)
  ) {
    const exists = I18N.languages.some(
      lang => lang.code === normalized
    );

    return exists ? normalized : 'en';
  }

  return normalized || 'en';
}


function getCurrentLanguage() {
  return normalizeLanguage(
    State.selectedLang || currentLanguage || 'en'
  );
}


// ─── View Management ────────────────────────────────────────────

function showView(viewId) {

  document
    .querySelectorAll('.view')
    .forEach(view => {
      view.classList.remove('active');
    });

  const target =
    document.getElementById(`view-${viewId}`);

  if (target) {

    target.classList.add('active');

    const section =
      document.getElementById('medicine-assistant');

    if (
      section &&
      viewId !== 'home'
    ) {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  State.currentView = viewId;
}


// ─── Language Management ────────────────────────────────────────

function setLanguage(code) {

  const normalizedCode =
    normalizeLanguage(code);

  currentLanguage = normalizedCode;
  State.selectedLang = normalizedCode;

  if (
    typeof I18N !== 'undefined' &&
    typeof I18N.setLanguage === 'function'
  ) {
    I18N.setLanguage(normalizedCode);
  }


  // Synchronize all language dropdowns
  document
    .querySelectorAll(
      'select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select'
    )
    .forEach(select => {
      if (select.value !== normalizedCode) {
        select.value = normalizedCode;
      }
    });


  // Re-render medicine information if a medicine is open
  if (State.selectedMedicine) {

    renderMedicineInstructions(
      State.selectedMedicine,
      normalizedCode,
      State.customInstructions
    );
  }


  // Stop current speech when language changes
  if (
    State.voiceStatus === 'playing' ||
    State.voiceStatus === 'paused'
  ) {
    Voice.stop();
    resetVoicePlayer();
  }


  // Refresh recent medicines
  renderRecentSearches();
}


// ─── Medicine Result Screen ─────────────────────────────────────

function showMedicineResult(
  medicine,
  isDemo = false
) {

  if (!medicine) return;

  State.selectedMedicine = medicine;
  State.customInstructions = null;
  State.isDemo = isDemo;
  State.voiceStatus = 'idle';


  // Close custom instructions editor
  const customEditor =
    document.getElementById(
      'custom-instructions-editor'
    );

  const customInput =
    document.getElementById(
      'custom-instructions-input'
    );

  if (customEditor) {
    customEditor.style.display = 'none';
  }

  if (customInput) {
    customInput.value = '';
  }


  // Save to Recently Viewed
  if (!isDemo) {
    MedicineData.addRecentlyViewed(
      medicine
    );
  }


  // Main medicine information
  const nameEl =
    document.getElementById(
      'result-medicine-name'
    );

  const catEl =
    document.getElementById(
      'result-medicine-category'
    );

  const iconEl =
    document.getElementById(
      'result-medicine-icon-el'
    );

  const demoBadge =
    document.getElementById(
      'result-demo-badge'
    );


  if (nameEl) {
    nameEl.textContent =
      medicine.name || 'Medicine';
  }

  if (catEl) {
    catEl.textContent =
      medicine.category ||
      'Medicine Information';
  }

  if (iconEl) {
    iconEl.textContent =
      medicine.icon || '💊';
  }

  if (demoBadge) {
    demoBadge.style.display =
      isDemo
        ? 'inline-flex'
        : 'none';
  }


  // Secondary information
  const genericEl =
    document.getElementById(
      'result-generic-name'
    );

  const mfgEl =
    document.getElementById(
      'result-manufacturer-name'
    );


  if (genericEl) {
    genericEl.textContent =
      medicine.generic ||
      medicine.name ||
      '—';
  }


  /*
   * Manufacturer is optional.
   * Never invent a manufacturer.
   */
  if (mfgEl) {

    if (medicine.manufacturer) {

      mfgEl.textContent =
        medicine.manufacturer;

    } else {

      mfgEl.textContent = '—';
    }
  }


  // Render instructions
  renderMedicineInstructions(
    medicine,
    State.selectedLang
  );


  // Reset voice
  resetVoicePlayer();


  // Show result
  showView('result');


  // Update Easy Mode button
  if (
    typeof Accessibility !== 'undefined' &&
    typeof Accessibility.updateResultEasyBtn === 'function'
  ) {
    Accessibility.updateResultEasyBtn();
  }
}


// ─── Medicine Instruction Rendering ─────────────────────────────

function renderMedicineInstructions(
  medicine,
  langCode,
  customInst = null
) {

  if (
    !medicine ||
    !medicine.instructions
  ) {
    return;
  }


  const normalizedLang =
    normalizeLanguage(langCode);


  const inst =
    medicine.instructions[normalizedLang] ||
    medicine.instructions.en ||
    {};


  const nameDisplay =
    document.getElementById(
      'instr-medicine-name'
    );

  const whenEl =
    document.getElementById(
      'instr-when'
    );

  const foodEl =
    document.getElementById(
      'instr-food'
    );

  const notesEl =
    document.getElementById(
      'instr-notes'
    );

  const importantEl =
    document.getElementById(
      'instr-important'
    );


  if (nameDisplay) {
    nameDisplay.textContent =
      inst.medicine ||
      medicine.name ||
      'Medicine';
  }


  /*
   * Custom prescription instructions
   *
   * These are user/doctor/pharmacist-provided
   * instructions and are NOT automatically translated.
   */
  if (
    customInst &&
    typeof customInst === 'string' &&
    customInst.trim()
  ) {

    if (whenEl) {
      whenEl.textContent =
        customInst.trim();
    }


    if (foodEl) {

      const customFood =
        getLocalizedText(
          normalizedLang,
          {
            en: 'Follow the prescription instructions provided by your doctor or pharmacist.',
            ta: 'உங்கள் மருத்துவர் அல்லது மருந்தாளுநர் வழங்கிய பரிந்துரைகளைப் பின்பற்றவும்.',
            hi: 'अपने डॉक्टर या फार्मासिस्ट द्वारा दी गई सलाह का पालन करें।',
            te: 'మీ డాక్టర్ లేదా ఫార్మసిస్ట్ ఇచ్చిన సూచనలను అనుసరించండి.',
            kn: 'ನಿಮ್ಮ ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ನೀಡಿದ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.',
            ml: 'നിങ്ങളുടെ ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നൽകിയ നിർദ്ദേശങ്ങൾ പാലിക്കുക.'
          }
        );

      foodEl.textContent = customFood;
    }


    if (notesEl) {

      const customNotes =
        getLocalizedText(
          normalizedLang,
          {
            en: 'Do not change the prescribed dose without consulting a healthcare professional.',
            ta: 'மருத்துவரை அணுகாமல் பரிந்துரைக்கப்பட்ட அளவை மாற்ற வேண்டாம்.',
            hi: 'स्वास्थ्य पेशेवर की सलाह के बिना निर्धारित खुराक न बदलें।',
            te: 'ఆరోగ్య నిపుణుడిని సంప్రదించకుండా సూచించిన మోతాదును మార్చకండి.',
            kn: 'ಆರೋಗ್ಯ ವೃತ್ತಿಪರರನ್ನು ಸಂಪರ್ಕಿಸದೆ ಸೂಚಿಸಿದ ಪ್ರಮಾಣವನ್ನು ಬದಲಾಯಿಸಬೇಡಿ.',
            ml: 'ആരോഗ്യ വിദഗ്ധനെ സമീപിക്കാതെ നിർദ്ദേശിച്ച ഡോസ് മാറ്റരുത്.'
          }
        );

      notesEl.textContent = customNotes;
    }

  } else {

    if (whenEl) {

      whenEl.textContent =
        inst.when ||
        getLocalizedText(
          normalizedLang,
          {
            en: 'Follow your prescription.',
            ta: 'உங்கள் மருத்துவர் கூறிய வழிமுறைகளைப் பின்பற்றவும்.',
            hi: 'अपने डॉक्टर द्वारा दी गई सलाह का पालन करें।',
            te: 'మీ డాక్టర్ సూచించిన విధానాన్ని అనుసరించండి.',
            kn: 'ನಿಮ್ಮ ವೈದ್ಯರು ಸೂಚಿಸಿದ ವಿಧಾನವನ್ನು ಅನುಸರಿಸಿ.',
            ml: 'നിങ്ങളുടെ ഡോക്ടർ നിർദ്ദേശിച്ച രീതി പാലിക്കുക.'
          }
        );
    }


    if (foodEl) {

      foodEl.textContent =
        inst.food ||
        getLocalizedText(
          normalizedLang,
          {
            en: 'Take only as directed by your doctor or pharmacist.',
            ta: 'மருத்துவர் அல்லது மருந்தாளுநர் கூறியபடி மட்டுமே எடுத்துக்கொள்ளவும்.',
            hi: 'केवल डॉक्टर या फार्मासिस्ट के निर्देशानुसार लें।',
            te: 'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన విధంగా మాత్రమే తీసుకోండి.',
            kn: 'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದಂತೆ ಮಾತ್ರ ತೆಗೆದುಕೊಳ್ಳಿ.',
            ml: 'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ചതുപോലെ മാത്രം കഴിക്കുക.'
          }
        );
    }


    if (notesEl) {

      notesEl.textContent =
        inst.notes ||
        getLocalizedText(
          normalizedLang,
          {
            en: 'Follow the instructions provided by your healthcare professional.',
            ta: 'உங்கள் மருத்துவர் அல்லது சுகாதார நிபுணர் வழங்கிய வழிமுறைகளைப் பின்பற்றவும்.',
            hi: 'अपने स्वास्थ्य पेशेवर द्वारा दिए गए निर्देशों का पालन करें।',
            te: 'మీ ఆరోగ్య నిపుణులు ఇచ్చిన సూచనలను అనుసరించండి.',
            kn: 'ನಿಮ್ಮ ಆರೋಗ್ಯ ವೃತ್ತಿಪರರು ನೀಡಿದ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.',
            ml: 'നിങ്ങളുടെ ആരോഗ്യ വിദഗ്ധൻ നൽകിയ നിർദ്ദേശങ്ങൾ പാലിക്കുക.'
          }
        );
    }
  }


  if (importantEl) {

    importantEl.textContent =
      inst.important ||
      getLocalizedText(
        normalizedLang,
        {
          en: 'Keep out of reach of children. Store according to the medicine package instructions.',
          ta: 'குழந்தைகளுக்கு எட்டாத இடத்தில் வைக்கவும். மருந்து தொகுப்பில் கூறியபடி சேமிக்கவும்.',
          hi: 'बच्चों की पहुंच से दूर रखें। दवा के पैकेज पर दिए निर्देशों के अनुसार रखें।',
          te: 'పిల్లలకు అందకుండా ఉంచండి. మందు ప్యాకేజీపై ఇచ్చిన సూచనల ప్రకారం నిల్వ చేయండి.',
          kn: 'ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದಂತೆ ಇಡಿ. ಔಷಧಿಯ ಪ್ಯಾಕೇಜ್‌ನಲ್ಲಿರುವ ಸೂಚನೆಗಳಂತೆ ಸಂಗ್ರಹಿಸಿ.',
          ml: 'കുട്ടികളിൽ നിന്ന് അകലെ സൂക്ഷിക്കുക. മരുന്നിന്റെ പാക്കേജിലെ നിർദ്ദേശങ്ങൾ അനുസരിച്ച് സംഭരിക്കുക.'
        }
      );
  }


  // Update voice button text
  const voiceLabel =
    document.getElementById(
      'voice-label'
    );

  if (
    voiceLabel &&
    typeof I18N !== 'undefined'
  ) {

    voiceLabel.textContent =
      I18N.t(
        'voice.listenBtn',
        normalizedLang
      );
  }
}


function getLocalizedText(
  langCode,
  translations
) {

  return (
    translations[langCode] ||
    translations.en ||
    ''
  );
}


// ─── Voice / Text-to-Speech Player ──────────────────────────────

function initVoicePlayer() {

  const playBtn =
    document.getElementById(
      'voice-play-btn'
    );

  const pauseBtn =
    document.getElementById(
      'voice-pause-btn'
    );

  const resumeBtn =
    document.getElementById(
      'voice-resume-btn'
    );

  const stopBtn =
    document.getElementById(
      'voice-stop-btn'
    );

  const replayBtn =
    document.getElementById(
      'voice-replay-btn'
    );

  const statusEl =
    document.getElementById(
      'voice-status'
    );

  const waveEl =
    document.getElementById(
      'sound-wave'
    );

  const unavailEl =
    document.getElementById(
      'voice-unavailable'
    );


  if (!playBtn) return;


  // Main Play / Pause / Resume button
  playBtn.addEventListener(
    'click',
    () => {

      if (
        State.voiceStatus === 'playing'
      ) {

        Voice.pause();

        State.voiceStatus = 'paused';

        playBtn.innerHTML = '▶';

        if (waveEl) {
          waveEl.classList.remove(
            'active'
          );
        }

        if (statusEl) {
          statusEl.textContent =
            I18N.t(
              'voice.paused',
              getCurrentLanguage()
            );
        }

        return;
      }


      if (
        State.voiceStatus === 'paused'
      ) {

        Voice.resume();

        State.voiceStatus = 'playing';

        playBtn.innerHTML = '⏸';

        if (waveEl) {
          waveEl.classList.add(
            'active'
          );
        }

        if (statusEl) {
          statusEl.textContent =
            I18N.t(
              'voice.playing',
              getCurrentLanguage()
            );
        }

        return;
      }


      startVoicePlayback();
    }
  );


  // Pause button
  if (pauseBtn) {

    pauseBtn.addEventListener(
      'click',
      () => {

        if (
          State.voiceStatus === 'playing'
        ) {

          Voice.pause();

          State.voiceStatus = 'paused';

          playBtn.innerHTML = '▶';

          if (waveEl) {
            waveEl.classList.remove(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.paused',
                getCurrentLanguage()
              );
          }
        }
      }
    );
  }


  // Resume button
  if (resumeBtn) {

    resumeBtn.addEventListener(
      'click',
      () => {

        if (
          State.voiceStatus === 'paused'
        ) {

          Voice.resume();

          State.voiceStatus = 'playing';

          playBtn.innerHTML = '⏸';

          if (waveEl) {
            waveEl.classList.add(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.playing',
                getCurrentLanguage()
              );
          }

        } else if (
          State.voiceStatus === 'idle' ||
          State.voiceStatus === 'done'
        ) {

          startVoicePlayback();
        }
      }
    );
  }


  // Stop button
  if (stopBtn) {

    stopBtn.addEventListener(
      'click',
      () => {

        Voice.stop();
        resetVoicePlayer();
      }
    );
  }


  // Replay button
  if (replayBtn) {

    replayBtn.addEventListener(
      'click',
      () => {

        startVoicePlayback();
      }
    );
  }


  function startVoicePlayback() {

    if (!State.selectedMedicine) {
      return;
    }


    const speechText =
      Voice.buildSpeechText(
        State.selectedMedicine,
        getCurrentLanguage(),
        State.customInstructions
      );


    if (!speechText) {

      State.voiceStatus = 'error';

      if (unavailEl) {

        unavailEl.classList.add(
          'visible'
        );

        unavailEl.textContent =
          I18N.t(
            'voice.unavailable',
            getCurrentLanguage()
          );
      }

      return;
    }


    Voice.speak(
      speechText,
      getCurrentLanguage(),
      {

        onStart: () => {

          State.voiceStatus = 'playing';

          playBtn.innerHTML = '⏸';

          playBtn.classList.add(
            'playing'
          );

          if (waveEl) {
            waveEl.classList.add(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.playing',
                getCurrentLanguage()
              );
          }

          if (unavailEl) {
            unavailEl.classList.remove(
              'visible'
            );
          }
        },


        onPause: () => {

          State.voiceStatus = 'paused';

          playBtn.innerHTML = '▶';

          if (waveEl) {
            waveEl.classList.remove(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.paused',
                getCurrentLanguage()
              );
          }
        },


        onResume: () => {

          State.voiceStatus = 'playing';

          playBtn.innerHTML = '⏸';

          if (waveEl) {
            waveEl.classList.add(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.playing',
                getCurrentLanguage()
              );
          }
        },


        onEnd: () => {

          State.voiceStatus = 'done';

          playBtn.innerHTML = '✓';

          playBtn.classList.remove(
            'playing'
          );

          if (waveEl) {
            waveEl.classList.remove(
              'active'
            );
          }

          if (statusEl) {
            statusEl.textContent =
              I18N.t(
                'voice.done',
                getCurrentLanguage()
              );
          }


          setTimeout(
            () => {

              if (
                State.voiceStatus === 'done'
              ) {
                resetVoicePlayer();
              }

            },
            4000
          );
        },


        onError: () => {

          State.voiceStatus = 'error';

          resetVoicePlayer();

          if (unavailEl) {

            unavailEl.classList.add(
              'visible'
            );

            unavailEl.textContent =
              I18N.t(
                'voice.unavailable',
                getCurrentLanguage()
              );
          }
        }
      }
    );
  }
}


function resetVoicePlayer() {

  State.voiceStatus = 'idle';

  const playBtn =
    document.getElementById(
      'voice-play-btn'
    );

  const statusEl =
    document.getElementById(
      'voice-status'
    );

  const waveEl =
    document.getElementById(
      'sound-wave'
    );


  if (playBtn) {

    playBtn.innerHTML = '🔊';

    playBtn.classList.remove(
      'playing'
    );
  }


  if (waveEl) {
    waveEl.classList.remove(
      'active'
    );
  }


  if (statusEl) {
    statusEl.textContent = '';
  }
}


// ─── Custom Prescription Instructions ───────────────────────────

function initCustomInstructions() {

  const toggleBtn =
    document.getElementById(
      'toggle-custom-instructions-btn'
    );

  const editor =
    document.getElementById(
      'custom-instructions-editor'
    );

  const input =
    document.getElementById(
      'custom-instructions-input'
    );

  const saveBtn =
    document.getElementById(
      'btn-save-custom-inst'
    );

  const cancelBtn =
    document.getElementById(
      'btn-cancel-custom-inst'
    );


  if (toggleBtn && editor) {

    toggleBtn.addEventListener(
      'click',
      () => {

        const isVisible =
          editor.style.display !== 'none';

        editor.style.display =
          isVisible
            ? 'none'
            : 'block';

        if (
          !isVisible &&
          input
        ) {
          input.focus();
        }
      }
    );
  }


  // Quick preset chips
  document
    .querySelectorAll(
      '.preset-inst-btn'
    )
    .forEach(chip => {

      chip.addEventListener(
        'click',
        () => {

          if (input) {

            input.value =
              chip.dataset.inst || '';

            input.focus();
          }
        }
      );
    });


  // Save custom instructions
  if (saveBtn) {

    saveBtn.addEventListener(
      'click',
      () => {

        const customVal =
          (
            input &&
            input.value.trim()
          ) || '';


        if (!customVal) {
          return;
        }


        State.customInstructions =
          customVal;


        if (State.selectedMedicine) {

          renderMedicineInstructions(
            State.selectedMedicine,
            getCurrentLanguage(),
            customVal
          );
        }


        if (editor) {
          editor.style.display =
            'none';
        }


        showToast(
          '✓ ' +
          I18N.t(
            'confirm.saveBtn',
            getCurrentLanguage()
          )
        );
      }
    );
  }


  // Cancel custom instructions
  if (cancelBtn) {

    cancelBtn.addEventListener(
      'click',
      () => {

        State.customInstructions = null;

        if (input) {
          input.value = '';
        }


        if (State.selectedMedicine) {

          renderMedicineInstructions(
            State.selectedMedicine,
            getCurrentLanguage(),
            null
          );
        }


        if (editor) {
          editor.style.display =
            'none';
        }


        showToast(
          I18N.t(
            'confirm.useDefault',
            getCurrentLanguage()
          )
        );
      }
    );
  }
}


// ─── Search & Live DrugDB Autocomplete ──────────────────────────

function initSearch() {

  const input =
    document.getElementById(
      'medicine-search-input'
    );

  const listEl =
    document.getElementById(
      'autocomplete-list'
    );

  let highlightedIndex = -1;


  if (!input || !listEl) {
    return;
  }


  // Debounced live search
  input.addEventListener(
    'input',
    () => {

      const q =
        input.value.trim();


      if (State.searchDebounceTimer) {

        clearTimeout(
          State.searchDebounceTimer
        );
      }


      if (q.length < 2) {

        closeAutocomplete(
          listEl
        );

        return;
      }


      renderAutocompleteLoading(
        listEl
      );


      State.searchDebounceTimer =
        setTimeout(
          async () => {

            try {

              const results =
                await DrugDB.search(q);

              renderAutocompleteResults(
                results,
                listEl,
                q
              );

              highlightedIndex = -1;

            } catch (e) {

              renderAutocompleteError(
                listEl,
                q
              );
            }

          },
          350
        );
    }
  );


  // Keyboard navigation
  input.addEventListener(
    'keydown',
    e => {

      const items =
        listEl.querySelectorAll(
          '.autocomplete-item'
        );


      if (items.length === 0) {
        return;
      }


      if (e.key === 'ArrowDown') {

        e.preventDefault();

        highlightedIndex =
          Math.min(
            highlightedIndex + 1,
            items.length - 1
          );

        updateAutocompleteHighlight(
          items,
          highlightedIndex
        );

      } else if (
        e.key === 'ArrowUp'
      ) {

        e.preventDefault();

        highlightedIndex =
          Math.max(
            highlightedIndex - 1,
            0
          );

        updateAutocompleteHighlight(
          items,
          highlightedIndex
        );

      } else if (
        e.key === 'Enter'
      ) {

        e.preventDefault();

        if (
          highlightedIndex >= 0 &&
          items[highlightedIndex]
        ) {

          items[
            highlightedIndex
          ].click();
        }

      } else if (
        e.key === 'Escape'
      ) {

        closeAutocomplete(
          listEl
        );
      }
    }
  );


  // Close autocomplete when clicking outside
  document.addEventListener(
    'click',
    e => {

      if (
        !input.contains(e.target) &&
        !listEl.contains(e.target)
      ) {

        closeAutocomplete(
          listEl
        );
      }
    }
  );


  renderRecentSearches();
}


function renderAutocompleteLoading(
  listEl
) {

  listEl.innerHTML = `
    <div class="autocomplete-status">
      <div class="spinner-sm"></div>
      <span>${escapeHTML(
        I18N.t(
          'search.loading',
          getCurrentLanguage()
        )
      )}</span>
    </div>
  `;

  listEl.classList.add(
    'open'
  );
}


function renderAutocompleteError(
  listEl,
  query = ''
) {

  listEl.innerHTML = `
    <div
      class="autocomplete-status error"
      style="display:flex; flex-direction:column; gap:8px;"
    >
      <span>⚠️ ${escapeHTML(
        I18N.t(
          'search.apiError',
          getCurrentLanguage()
        )
      )}</span>

      <button
        class="btn btn-secondary btn-sm"
        id="btn-retry-search"
        style="margin:0 auto;"
        type="button"
      >
        ↻ ${escapeHTML(
          I18N.t(
            'search.retryBtn',
            getCurrentLanguage()
          )
        )}
      </button>
    </div>
  `;

  listEl.classList.add(
    'open'
  );


  const retryBtn =
    document.getElementById(
      'btn-retry-search'
    );


  if (retryBtn) {

    retryBtn.onclick =
      async () => {

        renderAutocompleteLoading(
          listEl
        );

        try {

          const results =
            await DrugDB.search(
              query
            );

          renderAutocompleteResults(
            results,
            listEl,
            query
          );

        } catch (err) {

          renderAutocompleteError(
            listEl,
            query
          );
        }
      };
  }
}


function renderAutocompleteResults(
  results,
  listEl,
  query
) {

  if (
    !results ||
    results.length === 0
  ) {

    listEl.innerHTML = `
      <div class="autocomplete-status empty">
        <span>🔍 ${escapeHTML(
          I18N.t(
            'search.noResults',
            getCurrentLanguage()
          )
        )}</span>
      </div>
    `;

    listEl.classList.add(
      'open'
    );

    return;
  }


  listEl.innerHTML =
    results
      .slice(0, 20)
      .map(
        (med, idx) => `

          <div
            class="autocomplete-item"
            data-index="${idx}"
            role="option"
            tabindex="0"
          >

            <span class="autocomplete-item-icon">
              ${escapeHTML(
                med.icon || '💊'
              )}
            </span>

            <div class="autocomplete-item-details">

              <div class="autocomplete-item-name">
                ${highlightMatch(
                  med.name || 'Medicine',
                  query
                )}
              </div>

              <div class="autocomplete-item-meta">

                <span class="autocomplete-item-generic">
                  ${escapeHTML(
                    med.generic ||
                    med.category ||
                    ''
                  )}
                </span>

                ${
                  med.manufacturer
                    ? `
                      <span class="autocomplete-item-mfg">
                        • ${escapeHTML(
                          med.manufacturer
                        )}
                      </span>
                    `
                    : ''
                }

              </div>

            </div>

          </div>
        `
      )
      .join('');


  listEl.classList.add(
    'open'
  );


  // Attach selection events
  listEl
    .querySelectorAll(
      '.autocomplete-item'
    )
    .forEach(
      (item, idx) => {

        item.addEventListener(
          'click',
          () => {

            const selected =
              results[idx];

            if (!selected) {
              return;
            }


            const input =
              document.getElementById(
                'medicine-search-input'
              );

            if (input) {
              input.value =
                selected.name || '';
            }


            closeAutocomplete(
              listEl
            );


            showMedicineResult(
              selected,
              false
            );
          }
        );
      }
    );
}


function updateAutocompleteHighlight(
  items,
  index
) {

  items.forEach(
    (item, i) => {

      item.classList.toggle(
        'highlighted',
        i === index
      );

      if (i === index) {

        item.scrollIntoView({
          block: 'nearest'
        });
      }
    }
  );
}


function closeAutocomplete(
  listEl
) {

  if (listEl) {

    listEl.classList.remove(
      'open'
    );

    listEl.innerHTML = '';
  }
}


function highlightMatch(
  text,
  query
) {

  const safeText =
    escapeHTML(text || '');

  if (!query) {
    return safeText;
  }


  const safeQuery =
    escapeHTML(query);


  const regex =
    new RegExp(
      `(${escapeRegex(safeQuery)})`,
      'gi'
    );


  return safeText.replace(
    regex,
    '<strong>$1</strong>'
  );
}


function escapeRegex(
  string
) {

  return String(string).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}


// ─── Recently Viewed History ────────────────────────────────────

function renderRecentSearches() {

  const container =
    document.getElementById(
      'recent-searches-list'
    );

  const wrap =
    document.getElementById(
      'recent-searches-wrap'
    );


  if (!container || !wrap) {
    return;
  }


  const recent =
    MedicineData.getRecentlyViewed();


  if (recent.length === 0) {

    wrap.style.display =
      'none';

    return;
  }


  wrap.style.display =
    'block';


  container.innerHTML =
    recent
      .map(
        medicine => `

          <button
            class="recent-chip"
            data-id="${escapeHTML(
              medicine.id || ''
            )}"
            data-name="${escapeHTML(
              medicine.name || ''
            )}"
            type="button"
          >

            <span class="recent-chip-icon">
              ${escapeHTML(
                medicine.icon || '💊'
              )}
            </span>

            <span class="recent-chip-name">
              ${escapeHTML(
                medicine.name || 'Medicine'
              )}
            </span>

          </button>
        `
      )
      .join('');


  container
    .querySelectorAll(
      '.recent-chip'
    )
    .forEach(
      chip => {

        chip.addEventListener(
          'click',
          async () => {

            const name =
              chip.dataset.name;

            const id =
              chip.dataset.id;


            const preset =
              MedicineData.getPresetById(
                id
              );


            if (preset) {

              showMedicineResult(
                preset,
                false
              );

              return;
            }


            try {

              const results =
                await DrugDB.search(
                  name
                );


              if (
                results &&
                results.length > 0
              ) {

                showMedicineResult(
                  results[0],
                  false
                );
              }

            } catch (e) {

              showToast(
                I18N.t(
                  'search.apiError',
                  getCurrentLanguage()
                )
              );
            }
          }
        );
      }
    );


  // Clear history
  const clearBtn =
    document.getElementById(
      'clear-history-btn'
    );


  if (clearBtn) {

    clearBtn.onclick =
      () => {

        MedicineData.clearRecentlyViewed();

        renderRecentSearches();

        showToast(
          I18N.t(
            'search.clearHistory',
            getCurrentLanguage()
          )
        );
      };
  }
}


// ─── Scan Flow & OCR ────────────────────────────────────────────

function initScan() {

  const fileInput =
    document.getElementById(
      'scan-file-input'
    );

  const cameraBtn =
    document.getElementById(
      'scan-camera-btn'
    );

  const uploadBtn =
    document.getElementById(
      'scan-upload-btn'
    );

  const uploadArea =
    document.getElementById(
      'scan-upload-area'
    );

  const processBtn =
    document.getElementById(
      'scan-process-btn'
    );

  const changeBtn =
    document.getElementById(
      'scan-change-btn'
    );

  const preview =
    document.getElementById(
      'image-preview'
    );

  const previewWrap =
    document.getElementById(
      'image-preview-wrap'
    );


  if (!fileInput) {
    return;
  }


  // Camera
  if (cameraBtn) {

    cameraBtn.addEventListener(
      'click',
      () => {

        fileInput.setAttribute(
          'capture',
          'environment'
        );

        fileInput.click();
      }
    );
  }


  // Upload photo
  if (uploadBtn) {

    uploadBtn.addEventListener(
      'click',
      () => {

        fileInput.removeAttribute(
          'capture'
        );

        fileInput.click();
      }
    );
  }


  // Upload area
  if (uploadArea) {

    uploadArea.addEventListener(
      'click',
      () => {

        fileInput.removeAttribute(
          'capture'
        );

        fileInput.click();
      }
    );


    uploadArea.addEventListener(
      'dragover',
      e => {

        e.preventDefault();

        uploadArea.classList.add(
          'dragging'
        );
      }
    );


    uploadArea.addEventListener(
      'dragleave',
      () => {

        uploadArea.classList.remove(
          'dragging'
        );
      }
    );


    uploadArea.addEventListener(
      'drop',
      e => {

        e.preventDefault();

        uploadArea.classList.remove(
          'dragging'
        );


        const file =
          e.dataTransfer.files[0];


        if (
          file &&
          file.type.startsWith(
            'image/'
          )
        ) {

          handleSelectedImage(
            file,
            preview,
            previewWrap,
            processBtn,
            uploadArea,
            changeBtn
          );
        }
      }
    );
  }


  // File input
  fileInput.addEventListener(
    'change',
    e => {

      const file =
        e.target.files[0];


      if (file) {

        handleSelectedImage(
          file,
          preview,
          previewWrap,
          processBtn,
          uploadArea,
          changeBtn
        );
      }
    }
  );


  // Change photo
  if (changeBtn) {

    changeBtn.addEventListener(
      'click',
      e => {

        e.stopPropagation();

        resetScanView();

        fileInput.click();
      }
    );
  }


  // Process image
  if (processBtn) {

    processBtn.addEventListener(
      'click',
      () => {

        if (
          State.uploadedImageSrc
        ) {

          processUploadedImage(
            State.uploadedImageSrc
          );
        }
      }
    );
  }
}


function handleSelectedImage(
  file,
  preview,
  previewWrap,
  processBtn,
  uploadArea,
  changeBtn
) {

  if (
    !file.type.startsWith('image/')
  ) {
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    e => {

      State.uploadedImageSrc =
        e.target.result;


      if (preview) {
        preview.src =
          e.target.result;
      }


      if (previewWrap) {
        previewWrap.classList.add(
          'visible'
        );
      }


      if (uploadArea) {
        uploadArea.style.display =
          'none';
      }


      if (processBtn) {
        processBtn.style.display =
          'block';
      }


      if (changeBtn) {
        changeBtn.style.display =
          'inline-flex';
      }
    };


  reader.onerror =
    () => {

      State.uploadedImageSrc =
        null;

      showToast(
        'Unable to read the selected image.'
      );
    };


  reader.readAsDataURL(file);
}


async function processUploadedImage(
  src
) {

  showView(
    'processing'
  );


  const statusTitle =
    document.getElementById(
      'processing-status-title'
    );

  const statusSubtitle =
    document.getElementById(
      'processing-status-subtitle'
    );


  if (statusTitle) {

    statusTitle.textContent =
      I18N.t(
        'processing.title',
        getCurrentLanguage()
      );
  }


  if (statusSubtitle) {

    statusSubtitle.textContent =
      I18N.t(
        'processing.subtitle',
        getCurrentLanguage()
      );
  }


  try {

    const result =
      await OCR.processImage(
        src,
        {

          onStatus: status => {

            if (!statusTitle) {
              return;
            }


            if (
              status === 'reading'
            ) {

              statusTitle.textContent =
                I18N.t(
                  'processing.title',
                  getCurrentLanguage()
                );

            } else {

              statusTitle.textContent =
                I18N.t(
                  'how.step2.title',
                  getCurrentLanguage()
                );
            }
          }
        }
      );


    if (
      result &&
      result.success &&
      result.medicine
    ) {

      showMedicineResult(
        result.medicine,
        result.isDemo || false
      );

    } else {

      showView(
        'scan-error'
      );
    }

  } catch (error) {

    console.warn(
      'OCR processing failed:',
      error
    );

    showView(
      'scan-error'
    );
  }
}


function resetScanView() {

  State.uploadedImageSrc =
    null;


  const previewWrap =
    document.getElementById(
      'image-preview-wrap'
    );

  const uploadArea =
    document.getElementById(
      'scan-upload-area'
    );

  const processBtn =
    document.getElementById(
      'scan-process-btn'
    );

  const changeBtn =
    document.getElementById(
      'scan-change-btn'
    );

  const preview =
    document.getElementById(
      'image-preview'
    );


  if (previewWrap) {
    previewWrap.classList.remove(
      'visible'
    );
  }


  if (uploadArea) {
    uploadArea.style.display =
      '';
  }


  if (processBtn) {
    processBtn.style.display =
      'none';
  }


  if (changeBtn) {
    changeBtn.style.display =
      'none';
  }


  if (preview) {
    preview.src = '';
  }
}


// ─── Prototype Demo Mode ────────────────────────────────────────

function initDemoMode() {

  const demoBtns =
    document.querySelectorAll(
      '#demo-mode-btn, .trigger-demo-mode'
    );


  demoBtns.forEach(
    btn => {

      btn.addEventListener(
        'click',
        async () => {

          const section =
            document.getElementById(
              'medicine-assistant'
            );


          if (section) {

            section.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }


          showView(
            'processing'
          );


          const statusTitle =
            document.getElementById(
              'processing-status-title'
            );


          const lang =
            getCurrentLanguage();


          if (statusTitle) {

            statusTitle.textContent =
              I18N.t(
                'processing.title',
                lang
              );
          }


          await OCR.runDemoFlow({

            onStatus: status => {

              if (!statusTitle) {
                return;
              }


              if (
                status === 'reading'
              ) {

                statusTitle.textContent =
                  I18N.t(
                    'processing.title',
                    getCurrentLanguage()
                  );

              } else {

                statusTitle.textContent =
                  I18N.t(
                    'how.step2.title',
                    getCurrentLanguage()
                  );
              }
            },


            onComplete: demoMed => {

              /*
               * Demo mode now respects the
               * language selected by the user.
               *
               * It no longer forces Tamil.
               */
              showMedicineResult(
                demoMed,
                true
              );


              showToast(
                I18N.t(
                  'demo.toast',
                  getCurrentLanguage()
                )
              );
            }
          });
        }
      );
    }
  );
}


// ─── Header & Accessibility Controls ────────────────────────────

function initHeaderAndAccessibility() {

  const header =
    document.querySelector(
      '.header'
    );

  const hamburger =
    document.getElementById(
      'hamburger'
    );

  const mobileMenu =
    document.getElementById(
      'mobile-menu'
    );

  const a11yToggle =
    document.getElementById(
      'a11y-panel-toggle'
    );

  const a11yPanel =
    document.getElementById(
      'a11y-panel'
    );


  // Header shadow
  window.addEventListener(
    'scroll',
    () => {

      if (header) {

        header.classList.toggle(
          'scrolled',
          window.scrollY > 20
        );
      }
    }
  );


  // Mobile menu
  if (
    hamburger &&
    mobileMenu
  ) {

    hamburger.addEventListener(
      'click',
      () => {

        const isOpen =
          mobileMenu.classList.toggle(
            'open'
          );

        hamburger.classList.toggle(
          'open',
          isOpen
        );

        hamburger.setAttribute(
          'aria-expanded',
          String(isOpen)
        );
      }
    );


    mobileMenu
      .querySelectorAll(
        '.mobile-nav-link'
      )
      .forEach(
        link => {

          link.addEventListener(
            'click',
            () => {

              mobileMenu.classList.remove(
                'open'
              );

              hamburger.classList.remove(
                'open'
              );

              hamburger.setAttribute(
                'aria-expanded',
                'false'
              );
            }
          );
        }
      );
  }


  // Accessibility panel
  if (
    a11yToggle &&
    a11yPanel
  ) {

    a11yToggle.addEventListener(
      'click',
      e => {

        e.stopPropagation();

        const isOpen =
          a11yPanel.classList.toggle(
            'open'
          );

        a11yToggle.setAttribute(
          'aria-expanded',
          String(isOpen)
        );
      }
    );


    document.addEventListener(
      'click',
      e => {

        if (
          !a11yPanel.contains(
            e.target
          ) &&
          !a11yToggle.contains(
            e.target
          )
        ) {

          a11yPanel.classList.remove(
            'open'
          );

          a11yToggle.setAttribute(
            'aria-expanded',
            'false'
          );
        }
      }
    );


    // Accessibility toggles
    const easyToggle =
      document.getElementById(
        'a11y-easy-toggle'
      );

    const contrastToggle =
      document.getElementById(
        'a11y-contrast-toggle'
      );

    const textToggle =
      document.getElementById(
        'a11y-text-toggle'
      );

    const fontInc =
      document.getElementById(
        'a11y-font-inc'
      );

    const fontDec =
      document.getElementById(
        'a11y-font-dec'
      );

    const fontReset =
      document.getElementById(
        'a11y-font-reset'
      );


    if (easyToggle) {

      easyToggle.onchange =
        () =>
          Accessibility.setEasyMode(
            easyToggle.checked
          );
    }


    if (contrastToggle) {

      contrastToggle.onchange =
        () =>
          Accessibility.setHighContrast(
            contrastToggle.checked
          );
    }


    if (textToggle) {

      textToggle.onchange =
        () =>
          Accessibility.setLargeText(
            textToggle.checked
          );
    }


    if (fontInc) {

      fontInc.onclick =
        () =>
          Accessibility.increaseFontSize();
    }


    if (fontDec) {

      fontDec.onclick =
        () =>
          Accessibility.decreaseFontSize();
    }


    if (fontReset) {

      fontReset.onclick =
        () =>
          Accessibility.resetFontSize();
    }
  }


  // Easy Mode FAB
  const fab =
    document.getElementById(
      'easy-mode-fab'
    );


  if (fab) {

    fab.addEventListener(
      'click',
      () => {

        const newState =
          !Accessibility.isEasyMode();


        Accessibility.setEasyMode(
          newState
        );


        showToast(
          newState
            ? '👵 Easy Mode: ON'
            : 'Easy Mode: OFF'
        );
      }
    );
  }


  // Header language cycling
  const headerLangBtn =
    document.getElementById(
      'header-lang-btn'
    );


  if (headerLangBtn) {

    headerLangBtn.addEventListener(
      'click',
      () => {

        const langs =
          I18N.languages;

        const idx =
          langs.findIndex(
            lang =>
              lang.code ===
              getCurrentLanguage()
          );


        const nextLang =
          langs[
            (idx + 1) %
            langs.length
          ];


        setLanguage(
          nextLang.code
        );


        showToast(
          `🌐 Language: ${nextLang.native}`
        );
      }
    );
  }


  // Header Start button
  const startBtn =
    document.getElementById(
      'header-start-btn'
    );


  if (startBtn) {

    startBtn.addEventListener(
      'click',
      () => {

        const section =
          document.getElementById(
            'medicine-assistant'
          );


        if (section) {

          section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    );
  }
}


// ─── Navigation & Button Handlers ───────────────────────────────

function initNavigationHandlers() {

  // Hero CTA
  const heroCta =
    document.getElementById(
      'hero-cta-btn'
    );


  if (heroCta) {

    heroCta.addEventListener(
      'click',
      () => {

        const section =
          document.getElementById(
            'medicine-assistant'
          );


        if (section) {

          section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    );
  }


  // Assistant options
  const optionScan =
    document.getElementById(
      'option-scan'
    );

  const optionSearch =
    document.getElementById(
      'option-search'
    );

  const optionScanBtn =
    document.getElementById(
      'option-scan-btn'
    );

  const optionSearchBtn =
    document.getElementById(
      'option-search-btn'
    );


  if (optionScan) {

    optionScan.onclick =
      () => {

        showView('scan');

        resetScanView();
      };
  }


  if (optionSearch) {

    optionSearch.onclick =
      () => {

        showView('search');

        renderRecentSearches();
      };
  }


  if (optionScanBtn) {

    optionScanBtn.onclick =
      e => {

        e.stopPropagation();

        showView('scan');

        resetScanView();
      };
  }


  if (optionSearchBtn) {

    optionSearchBtn.onclick =
      e => {

        e.stopPropagation();

        showView('search');

        renderRecentSearches();
      };
  }


  // Back buttons
  document
    .querySelectorAll(
      '[data-back]'
    )
    .forEach(
      btn => {

        btn.addEventListener(
          'click',
          () => {

            Voice.stop();

            resetVoicePlayer();

            showView(
              btn.dataset.back ||
              'home'
            );
          }
        );
      }
    );


  // Start Over
  const startOverBtn =
    document.getElementById(
      'result-start-over-btn'
    );


  if (startOverBtn) {

    startOverBtn.addEventListener(
      'click',
      () => {

        Voice.stop();

        resetVoicePlayer();

        State.selectedMedicine =
          null;

        State.customInstructions =
          null;

        showView(
          'home'
        );
      }
    );
  }


  // Simple View
  const simpleViewBtn =
    document.getElementById(
      'simple-view-toggle-btn'
    );


  if (simpleViewBtn) {

    simpleViewBtn.addEventListener(
      'click',
      () => {

        Accessibility.setSimpleView(
          !Accessibility.isSimpleView()
        );
      }
    );
  }


  // Result Easy Mode
  const resultEasyBtn =
    document.getElementById(
      'easy-mode-toggle-result'
    );


  if (resultEasyBtn) {

    resultEasyBtn.addEventListener(
      'click',
      () => {

        Accessibility.setEasyMode(
          !Accessibility.isEasyMode()
        );
      }
    );
  }


  // Scan error recovery
  const tryAgainBtn =
    document.getElementById(
      'scan-error-try-again'
    );

  const manualBtn =
    document.getElementById(
      'scan-error-manual'
    );


  if (tryAgainBtn) {

    tryAgainBtn.onclick =
      () => {

        showView('scan');

        resetScanView();
      };
  }


  if (manualBtn) {

    manualBtn.onclick =
      () => {

        showView('search');

        renderRecentSearches();
      };
  }


  // Preset medicines
  document
    .querySelectorAll(
      '[data-preset-id]'
    )
    .forEach(
      btn => {

        btn.addEventListener(
          'click',
          () => {

            const presetId =
              btn.dataset.presetId;


            const preset =
              MedicineData.getPresetById(
                presetId
              );


            if (preset) {

              showMedicineResult(
                preset,
                false
              );
            }
          }
        );
      }
    );


  // Language dropdowns
  document
    .querySelectorAll(
      'select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select'
    )
    .forEach(
      select => {

        select.addEventListener(
          'change',
          e => {

            setLanguage(
              e.target.value
            );
          }
        );
      }
    );


  // Language buttons
  document
    .querySelectorAll(
      '.lang-btn[data-lang], .lang-picker-item[data-lang], .footer-lang-link[data-lang]'
    )
    .forEach(
      btn => {

        btn.addEventListener(
          'click',
          e => {

            e.preventDefault();

            setLanguage(
              btn.dataset.lang
            );
          }
        );
      }
    );
}


// ─── FAQ Accordions ─────────────────────────────────────────────

function initFAQ() {

  document
    .querySelectorAll(
      '.faq-item'
    )
    .forEach(
      item => {

        const qBtn =
          item.querySelector(
            '.faq-question'
          );


        if (qBtn) {

          qBtn.addEventListener(
            'click',
            () => {

              const isCurrentlyOpen =
                item.classList.contains(
                  'open'
                );


              document
                .querySelectorAll(
                  '.faq-item'
                )
                .forEach(
                  otherItem => {

                    otherItem.classList.remove(
                      'open'
                    );

                    const button =
                      otherItem.querySelector(
                        '.faq-question'
                      );


                    if (button) {

                      button.setAttribute(
                        'aria-expanded',
                        'false'
                      );
                    }
                  }
                );


              if (!isCurrentlyOpen) {

                item.classList.add(
                  'open'
                );

                qBtn.setAttribute(
                  'aria-expanded',
                  'true'
                );
              }
            }
          );
        }
      }
    );
}


// ─── Chart Bar Animation ────────────────────────────────────────

function initChartBars() {

  const bars =
    document.querySelectorAll(
      '.chart-bar-fill-elderly, .chart-bar-fill-younger'
    );


  if (
    'IntersectionObserver' in window
  ) {

    const observer =
      new IntersectionObserver(
        entries => {

          entries.forEach(
            entry => {

              if (
                entry.isIntersecting
              ) {

                const el =
                  entry.target;


                el.style.width =
                  el.dataset.width ||
                  '0%';


                observer.unobserve(
                  el
                );
              }
            }
          );
        },
        {
          threshold: 0.3
        }
      );


    bars.forEach(
      bar => {

        bar.style.width =
          '0%';

        observer.observe(
          bar
        );
      }
    );

  } else {

    bars.forEach(
      bar => {

        bar.style.width =
          bar.dataset.width ||
          '0%';
      }
    );
  }
}


// ─── Scroll Reveal ───────────────────────────────────────────────

function initScrollReveal() {

  if (
    'IntersectionObserver' in window
  ) {

    const observer =
      new IntersectionObserver(
        entries => {

          entries.forEach(
            entry => {

              if (
                entry.isIntersecting
              ) {

                entry.target.classList.add(
                  'visible'
                );
              }
            }
          );
        },
        {
          threshold: 0.1
        }
      );


    document
      .querySelectorAll(
        '.reveal'
      )
      .forEach(
        element =>
          observer.observe(
            element
          )
      );

  } else {

    document
      .querySelectorAll(
        '.reveal'
      )
      .forEach(
        element =>
          element.classList.add(
            'visible'
          )
      );
  }
}


// ─── Toast Notifications ────────────────────────────────────────

let toastTimeout = null;


function showToast(msg) {

  const toast =
    document.getElementById(
      'toast'
    );


  if (!toast) {
    return;
  }


  toast.textContent =
    msg;


  toast.classList.remove(
    'hidden'
  );


  if (toastTimeout) {

    clearTimeout(
      toastTimeout
    );
  }


  toastTimeout =
    setTimeout(
      () =>
        toast.classList.add(
          'hidden'
        ),
      3500
    );
}


// ─── Application Initialization ─────────────────────────────────

async function initApp() {

  // 1. Accessibility
  const a11y =
    Accessibility.load();


  // 2. Initialize i18n
  I18N.init('en');


  currentLanguage =
    normalizeLanguage(
      I18N.currentLang
    );

  State.selectedLang =
    currentLanguage;


  // 3. Synchronize language dropdowns
  document
    .querySelectorAll(
      'select.lang-dropdown, #global-lang-select, #a11y-lang-select, #mobile-lang-select, #result-lang-select'
    )
    .forEach(
      select => {

        select.value =
          currentLanguage;
      }
    );


  // 4. Synchronize accessibility controls
  const easyToggle =
    document.getElementById(
      'a11y-easy-toggle'
    );

  const contrastToggle =
    document.getElementById(
      'a11y-contrast-toggle'
    );

  const textToggle =
    document.getElementById(
      'a11y-text-toggle'
    );


  if (easyToggle) {
    easyToggle.checked =
      a11y.easyMode;
  }


  if (contrastToggle) {
    contrastToggle.checked =
      a11y.highContrast;
  }


  if (textToggle) {
    textToggle.checked =
      a11y.largeText;
  }


  // 5. Initialize modules
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


  // 6. Preload voices
  Voice.waitForVoices()
    .catch(() => {});


  // 7. Initialize OCR worker
  if (
    typeof Tesseract !== 'undefined'
  ) {

    OCR.init()
      .catch(() => {});
  }


  // 8. Start on Home
  showView('home');
}


// ─── Global Attachments ─────────────────────────────────────────

if (
  typeof window !== 'undefined'
) {

  window.setLanguage =
    setLanguage;

  window.State =
    State;

  window.showMedicineResult =
    showMedicineResult;

  /*
   * Use a getter so window.currentLanguage
   * always reflects the latest selected language.
   */
  Object.defineProperty(
    window,
    'currentLanguage',
    {
      configurable: true,

      get() {
        return currentLanguage;
      },

      set(value) {
        currentLanguage =
          normalizeLanguage(value);
      }
    }
  );
}


// ─── Start Application ──────────────────────────────────────────

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initApp
  );

} else {

  initApp();
}
```
