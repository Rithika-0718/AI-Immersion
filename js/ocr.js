/**
 * DoseSpeak — OCR / Image Recognition Module
 * Integrates Tesseract.js optical character recognition with safety confidence thresholds
 * and 1-Click Presentation Demo Mode
 */

const OCR = (() => {
  let tesseractWorker = null;
  let isInitialized = false;
  let isInitializing = false;

  /**
   * Initialize Tesseract OCR worker
   */
  async function init(onProgress) {
    if (isInitialized || isInitializing) return;
    if (typeof Tesseract === 'undefined') {
      console.warn('Tesseract.js not loaded');
      return;
    }

    isInitializing = true;
    try {
      tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress(Math.round(m.progress * 100));
          }
        }
      });
      isInitialized = true;
    } catch (e) {
      console.warn('Tesseract worker initialization issue:', e);
      isInitialized = false;
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Process medicine image through OCR pipeline
   */
  async function processImage(imageSource, { onStatus, onProgress } = {}) {
    if (onStatus) onStatus('reading');

    // Attempt real OCR if Tesseract is available
    if (typeof Tesseract !== 'undefined') {
      try {
        if (!isInitialized) {
          await init(onProgress);
        }

        if (tesseractWorker) {
          const result = await tesseractWorker.recognize(imageSource);
          const text = result && result.data && result.data.text ? result.data.text.trim() : '';
          const confidence = (result && result.data && result.data.confidence) || 0;

          if (text && text.length >= 3 && confidence >= 30) {
            // Match against medicine names or query DrugDB
            const matched = await findMedicineFromText(text);
            if (matched) {
              if (onStatus) onStatus('found');
              return { success: true, medicine: matched, ocrText: text, isDemo: false };
            }
          }
        }
      } catch (err) {
        console.warn('Live OCR failed or low confidence:', err);
      }
    }

    // If OCR could not confidently recognize medicine name
    if (onStatus) onStatus('not_found');
    return { success: false, reason: 'low_confidence' };
  }

  /**
   * Match recognized text with known pharmaceutical patterns or DrugDB search
   */
  async function findMedicineFromText(rawText) {
    if (!rawText) return null;
    const clean = rawText.toLowerCase();

    // Check common brand & generic keywords
    const keywords = [
      { key: 'paracetamol', id: 'paracetamol-500' },
      { key: 'acetaminophen', id: 'paracetamol-500' },
      { key: 'dolo', id: 'paracetamol-500' },
      { key: 'crocin', id: 'paracetamol-500' },
      { key: 'calpol', id: 'paracetamol-500' },
      { key: 'amlodipine', id: 'amlodipine-5' },
      { key: 'amlo', id: 'amlodipine-5' },
      { key: 'amlong', id: 'amlodipine-5' },
      { key: 'cetirizine', id: 'cetirizine-10' },
      { key: 'cetzine', id: 'cetirizine-10' },
      { key: 'zyrtec', id: 'cetirizine-10' },
      { key: 'pantoprazole', id: 'pantoprazole-40' },
      { key: 'pantocid', id: 'pantoprazole-40' },
      { key: 'pan 40', id: 'pantoprazole-40' },
      { key: 'metformin', id: 'metformin-500' },
      { key: 'glycomet', id: 'metformin-500' },
      { key: 'amoxicillin', id: 'amoxicillin-500' },
      { key: 'novamox', id: 'amoxicillin-500' },
      { key: 'augmentin', id: 'amoxicillin-500' },
      { key: 'azithromycin', id: 'azithral-500' },
      { key: 'azithral', id: 'azithral-500' },
      { key: 'telmisartan', id: 'telma-40' },
      { key: 'telma', id: 'telma-40' }
    ];

    for (const item of keywords) {
      if (clean.includes(item.key)) {
        // Return preset or fallback match
        const preset = MedicineData.getPresetById(item.id);
        if (preset) return preset;

        const results = await DrugDB.search(item.key);
        if (results && results.length > 0) {
          return results[0];
        }
      }
    }

    // Try live search with the first 2 words from OCR
    const words = clean.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
    for (const w of words.slice(0, 3)) {
      const liveResults = await DrugDB.search(w);
      if (liveResults && liveResults.length > 0) {
        return liveResults[0];
      }
    }

    return null;
  }

  /**
   * Run the 1-Click Prototype Demo Mode for immersion video presentation
   * Simulates full scan -> OCR -> Tamil selection -> Instructions -> Tamil TTS
   */
  async function runDemoFlow({ onStatus, onComplete }) {
    if (onStatus) onStatus('reading');
    await new Promise(r => setTimeout(r, 800));

    if (onStatus) onStatus('processing');
    await new Promise(r => setTimeout(r, 900));

    // Get verified Paracetamol 500 mg preset
    const demoMedicine = MedicineData.getPresetById('paracetamol-500') || {
      id: 'paracetamol-500',
      name: 'Paracetamol 500 mg',
      brand: 'Paracetamol',
      generic: 'Acetaminophen / Paracetamol',
      category: 'Pain Relief / Fever Reducer',
      icon: '💊',
      strength: '500 mg',
      instructions: DrugDB.buildFactualInstructions('Paracetamol 500 mg', 'Paracetamol', 'Paracetamol')
    };

    if (onComplete) {
      onComplete(demoMedicine);
    }
  }

  /**
   * Terminate Tesseract worker on cleanup
   */
  async function terminate() {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
      isInitialized = false;
    }
  }

  return {
    init,
    processImage,
    findMedicineFromText,
    runDemoFlow,
    terminate
  };
})();
