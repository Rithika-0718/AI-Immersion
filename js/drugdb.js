/**
 * DoseSpeak — Real DrugDB Medicine Database API Client
 *
 * Official Search Endpoint:
 * https://drugdb.in/search?q={USER_QUERY}&type=medicine&limit=20
 *
 * Features:
 *   - Real DrugDB live API search
 *   - 350ms debounce
 *   - AbortController request cancellation
 *   - Monotonic request counter for stale-response protection
 *   - Case-insensitive partial matching
 *   - In-memory cache
 *   - Offline/local fallback dataset
 *   - Safe factual medicine instructions
 *   - English, Tamil, Hindi, Telugu, Kannada, Malayalam
 *
 * IMPORTANT:
 *   This file does NOT calculate personalized dosage.
 *   Users should follow their prescription/doctor/pharmacist instructions.
 */

const DrugDB = (() => {
  const BASE_URL = 'https://drugdb.in/search';
  const CACHE = new Map();

  const DEBOUNCE_DELAY = 350;
  const MIN_QUERY_LENGTH = 2;
  const MAX_RESULTS = 20;

  let currentAbortController = null;
  let latestRequestId = 0;
  let debounceTimer = null;

  /**
   * Search DrugDB live API.
   *
   * The function waits 350ms before sending the request.
   * If another search is made during that time, the previous
   * pending search is cancelled.
   *
   * @param {string} query Search keyword
   * @returns {Promise<Array>} Array of medicine objects
   */
  function search(query) {
    const trimmed = String(query || '').trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      cancelPendingRequest();
      return Promise.resolve([]);
    }

    const cacheKey = trimmed.toLowerCase();

    // Return cached result immediately.
    if (CACHE.has(cacheKey)) {
      return Promise.resolve(CACHE.get(cacheKey));
    }

    // Clear previous debounce timer.
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Cancel previous API request.
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    const requestId = ++latestRequestId;

    return new Promise((resolve) => {
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;

        // If a newer request has already been created,
        // this request is no longer relevant.
        if (requestId !== latestRequestId) {
          resolve([]);
          return;
        }

        currentAbortController = new AbortController();

        try {
          const results = await fetchDrugDB(
            trimmed,
            requestId,
            currentAbortController.signal
          );

          // Protect against stale responses.
          if (requestId !== latestRequestId) {
            resolve([]);
            return;
          }

          CACHE.set(cacheKey, results);
          resolve(results);
        } catch (error) {
          // Ignore intentionally cancelled requests.
          if (error && error.name === 'AbortError') {
            resolve([]);
            return;
          }

          console.warn(
            'DrugDB API request failed. Using local fallback dataset.',
            error
          );

          // Only allow the latest request to use fallback results.
          if (requestId !== latestRequestId) {
            resolve([]);
            return;
          }

          const fallbackResults = searchFallbackMedicines(trimmed);

          // Cache fallback result too.
          CACHE.set(cacheKey, fallbackResults);

          resolve(fallbackResults);
        } finally {
          if (requestId === latestRequestId) {
            currentAbortController = null;
          }
        }
      }, DEBOUNCE_DELAY);
    });
  }

  /**
   * Perform the actual DrugDB API request.
   *
   * @param {string} query
   * @param {number} requestId
   * @param {AbortSignal} signal
   * @returns {Promise<Array>}
   */
  async function fetchDrugDB(query, requestId, signal) {
    const url =
      `${BASE_URL}?q=${encodeURIComponent(query)}` +
      `&type=medicine&limit=${MAX_RESULTS}`;

    const response = await fetch(url, {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`DrugDB returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Stale request protection immediately after API response.
    if (requestId !== latestRequestId) {
      return [];
    }

    const rawResults = extractResults(data);

    const parsedResults = rawResults
      .map((item, index) => parseDrugDBItem(item, index))
      .filter(Boolean);

    return parsedResults.slice(0, MAX_RESULTS);
  }

  /**
   * Extract medicine results from different possible DrugDB
   * response structures.
   *
   * Supports:
   *   { results: [...] }
   *   { data: [...] }
   *   { medicines: [...] }
   *   [...] directly
   *
   * @param {*} data API response
   * @returns {Array}
   */
  function extractResults(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== 'object') {
      return [];
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    if (Array.isArray(data.medicines)) {
      return data.medicines;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    return [];
  }

  /**
   * Cancel debounce timer and active API request.
   */
  function cancelPendingRequest() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    latestRequestId++;
  }

  /**
   * Parse one raw DrugDB medicine item.
   *
   * @param {Object} item
   * @param {number} index
   * @returns {Object|null}
   */
  function parseDrugDBItem(item, index = 0) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const rawName = firstNonEmpty([
      item.medicineName,
      item.medicine_name,
      item.name,
      item.productName,
      item.product_name,
      item.title
    ]) || 'Medicine';

    const brand = firstNonEmpty([
      item.brand,
      item.brandName,
      item.brand_name,
      item['brand.brandName'],
      item['brand.name'],
      item.brand?.brandName,
      item.brand?.name
    ]) || extractBrand(rawName);

    const manufacturer = firstNonEmpty([
      item.manufacturer,
      item.manufacturerName,
      item.manufacturer_name,
      item['manufacturer.manufacturerName'],
      item['manufacturer.name'],
      item.manufacturer?.manufacturerName,
      item.manufacturer?.name
    ]) || 'Not specified';

    const generic = firstNonEmpty([
      item.generic,
      item.genericName,
      item.generic_name,
      item['generic.genericName'],
      item['generic.name'],
      item.generic?.genericName,
      item.generic?.name
    ]) || extractGeneric(rawName);

    const sctid = firstNonEmpty([
      item.medicineSctid,
      item.medicine_sctid,
      item.sctid,
      item.SCTID,
      item.id
    ]) || `local-${Date.now()}-${index}`;

    const strength = extractStrength(
      rawName,
      item.strength || item.dose || item.strengthValue
    );

    const { icon, category } = classifyMedicine(rawName, generic);

    const instructions = buildFactualInstructions(
      rawName,
      generic,
      brand
    );

    return {
      id: `drugdb-${String(sctid)}`,
      sctid: String(sctid),

      name: formatMedicineName(rawName),
      rawName: String(rawName),

      brand: String(brand),
      generic: String(generic),
      manufacturer: String(manufacturer),

      strength,

      category,
      icon,

      isLiveDrugDB: true,

      instructions
    };
  }

  /**
   * Return the first usable non-empty value.
   *
   * @param {Array} values
   * @returns {string}
   */
  function firstNonEmpty(values) {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object') {
        continue;
      }

      const stringValue = String(value).trim();

      if (stringValue) {
        return stringValue;
      }
    }

    return '';
  }

  /**
   * Extract medicine strength.
   *
   * Examples:
   *   500 mg
   *   650 mg
   *   10 mg
   *   5 mg
   *   100 mcg
   *   40 mg
   *   1000 IU
   *
   * @param {string} rawName
   * @param {*} suppliedStrength
   * @returns {string}
   */
  function extractStrength(rawName, suppliedStrength) {
    if (
      suppliedStrength !== null &&
      suppliedStrength !== undefined &&
      String(suppliedStrength).trim()
    ) {
      return String(suppliedStrength).trim();
    }

    const match = String(rawName).match(
      /(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|%))/i
    );

    return match ? match[1] : '';
  }

  /**
   * Clean medicine name for elderly-friendly display.
   *
   * @param {string} raw
   * @returns {string}
   */
  function formatMedicineName(raw) {
    if (!raw) {
      return 'Medicine';
    }

    let clean = String(raw)
      .replace(/\(product\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) {
      return 'Medicine';
    }

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Attempt to extract brand name from medicine name.
   *
   * @param {string} raw
   * @returns {string}
   */
  function extractBrand(raw) {
    if (!raw) {
      return 'Brand';
    }

    const clean = String(raw).trim();

    const beforeParenthesis = clean.split('(')[0].trim();

    if (beforeParenthesis) {
      const words = beforeParenthesis.split(/\s+/);

      // Keep common brand + strength combinations.
      if (
        words.length >= 2 &&
        /\d/.test(words[words.length - 1])
      ) {
        return beforeParenthesis;
      }

      return beforeParenthesis;
    }

    return clean.split(/\s+/)[0] || 'Brand';
  }

  /**
   * Attempt to extract generic name.
   *
   * @param {string} raw
   * @returns {string}
   */
  function extractGeneric(raw) {
    if (!raw) {
      return 'Not specified';
    }

    const match = String(raw).match(/\(([^)]+)\)/);

    if (match && match[1]) {
      return match[1].trim();
    }

    return String(raw).trim();
  }

  /**
   * Classify medicine into a broad display category.
   *
   * This is ONLY a UI classification.
   * It is not a medical diagnosis.
   *
   * @param {string} name
   * @param {string} generic
   * @returns {{icon: string, category: string}}
   */
  function classifyMedicine(name, generic) {
    const combined =
      `${name || ''} ${generic || ''}`.toLowerCase();

    if (
      combined.includes('paracetamol') ||
      combined.includes('acetaminophen') ||
      combined.includes('dolo') ||
      combined.includes('crocin') ||
      combined.includes('ibuprofen') ||
      combined.includes('pain') ||
      combined.includes('fever')
    ) {
      return {
        icon: '💊',
        category: 'Pain Relief / Fever Reducer'
      };
    }

    if (
      combined.includes('cetirizine') ||
      combined.includes('levocetirizine') ||
      combined.includes('zyrtec') ||
      combined.includes('allegra') ||
      combined.includes('fexofenadine') ||
      combined.includes('allergy') ||
      combined.includes('histamine')
    ) {
      return {
        icon: '🌿',
        category: 'Antihistamine / Allergy Relief'
      };
    }

    if (
      combined.includes('amlo') ||
      combined.includes('amlodipine') ||
      combined.includes('telmisartan') ||
      combined.includes('losartan') ||
      combined.includes('atenolol') ||
      combined.includes('blood pressure') ||
      combined.includes('hypertension')
    ) {
      return {
        icon: '❤️',
        category: 'Cardiovascular / Blood Pressure'
      };
    }

    if (
      combined.includes('panto') ||
      combined.includes('pantoprazole') ||
      combined.includes('omeprazole') ||
      combined.includes('rabeprazole') ||
      combined.includes('esomeprazole') ||
      combined.includes('ranitidine') ||
      combined.includes('antacid') ||
      combined.includes('acidity') ||
      combined.includes('gas')
    ) {
      return {
        icon: '🟡',
        category: 'Acidity / Stomach Relief'
      };
    }

    if (
      combined.includes('metformin') ||
      combined.includes('glycomet') ||
      combined.includes('glimepiride') ||
      combined.includes('vildagliptin') ||
      combined.includes('sitagliptin') ||
      combined.includes('insulin') ||
      combined.includes('diabetes') ||
      combined.includes('sugar')
    ) {
      return {
        icon: '🔵',
        category: 'Anti-Diabetic / Blood Sugar Control'
      };
    }

    if (
      combined.includes('amoxi') ||
      combined.includes('amoxicillin') ||
      combined.includes('azithro') ||
      combined.includes('azithromycin') ||
      combined.includes('cipro') ||
      combined.includes('cefixime') ||
      combined.includes('antibiotic')
    ) {
      return {
        icon: '💉',
        category: 'Antibiotic / Infection Treatment'
      };
    }

    if (
      combined.includes('atorvastatin') ||
      combined.includes('rosuvastatin') ||
      combined.includes('cholesterol') ||
      combined.includes('statin')
    ) {
      return {
        icon: '🩸',
        category: 'Lipid Lowering / Cholesterol'
      };
    }

    if (
      combined.includes('cough') ||
      combined.includes('dextromethorphan') ||
      combined.includes('ambroxol') ||
      combined.includes('guaifenesin') ||
      combined.includes('syrup')
    ) {
      return {
        icon: '🧪',
        category: 'Respiratory / Cough & Cold'
      };
    }

    return {
      icon: '💊',
      category: 'Prescription / General Medicine'
    };
  }

  /**
   * Build factual instructions in six supported languages.
   *
   * IMPORTANT:
   * This function intentionally does not calculate
   * personalized dosage from age, weight, symptoms,
   * medical history, or other patient-specific data.
   */
  function buildFactualInstructions(name, generic, brand) {
    const displayName = formatMedicineName(name);

    const combined =
      `${name || ''} ${generic || ''} ${brand || ''}`.toLowerCase();

    /*
     * ---------------------------------------------------------
     * 1. PARACETAMOL / ACETAMINOPHEN
     * ---------------------------------------------------------
     */
    if (
      combined.includes('paracetamol') ||
      combined.includes('acetaminophen') ||
      combined.includes('dolo') ||
      combined.includes('crocin')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Pain Relief / Fever Reducer',
          when:
            'Follow the timing and dosage prescribed by your doctor or pharmacist. Do not exceed the maximum daily amount stated on your prescription or package.',
          food:
            'Can generally be taken with or without food. Take with water.',
          notes:
            'Do not combine with another medicine containing paracetamol or acetaminophen unless a healthcare professional has advised you to do so.',
          important:
            'Keep in a cool, dry place away from children. If pain or fever persists, consult a healthcare professional.'
        },

        ta: {
          medicine: displayName,
          category: 'வலி நிவாரணி / காய்ச்சல் குறைக்கும் மருந்து',
          when:
            'மருத்துவர் அல்லது மருந்தாளுநர் கூறிய நேரம் மற்றும் அளவைப் பின்பற்றவும். பரிந்துரைக்கப்பட்ட அதிகபட்ச தினசரி அளவைத் தாண்ட வேண்டாம்.',
          food:
            'பொதுவாக உணவுடனும் அல்லது உணவு இன்றியும் எடுத்துக்கொள்ளலாம். தண்ணீருடன் எடுத்துக்கொள்ளவும்.',
          notes:
            'பாராசிட்டமால் அல்லது அசிட்டமினோஃபென் உள்ள மற்ற மருந்துகளை மருத்துவ ஆலோசனை இல்லாமல் சேர்த்து எடுத்துக்கொள்ள வேண்டாம்.',
          important:
            'குழந்தைகளுக்கு எட்டாத குளிர்ந்த, உலர்ந்த இடத்தில் வைக்கவும். வலி அல்லது காய்ச்சல் தொடர்ந்தால் மருத்துவரை அணுகவும்.'
        },

        hi: {
          medicine: displayName,
          category: 'दर्द निवारक / बुखार कम करने वाली दवा',
          when:
            'डॉक्टर या फार्मासिस्ट द्वारा बताए गए समय और खुराक का पालन करें। निर्धारित अधिकतम दैनिक मात्रा से अधिक न लें।',
          food:
            'आमतौर पर भोजन के साथ या बिना लिया जा सकता है। पानी के साथ लें।',
          notes:
            'पैरासिटामोल या एसीटामिनोफेन वाली दूसरी दवा बिना डॉक्टर की सलाह के साथ न लें।',
          important:
            'बच्चों की पहुंच से दूर ठंडी और सूखी जगह पर रखें। दर्द या बुखार बना रहे तो डॉक्टर से संपर्क करें।'
        },

        te: {
          medicine: displayName,
          category: 'నొప్పి నివారిణి / జ్వర నివారిణి',
          when:
            'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన సమయం మరియు మోతాదును అనుసరించండి. సూచించిన గరిష్ట రోజువారీ మోతాదును మించకండి.',
          food:
            'సాధారణంగా ఆహారంతో లేదా ఆహారం లేకుండా తీసుకోవచ్చు. నీటితో తీసుకోండి.',
          notes:
            'పారాసిటమాల్ లేదా ఎసిటామినోఫెన్ ఉన్న ఇతర మందులను వైద్య సలహా లేకుండా కలిపి తీసుకోకండి.',
          important:
            'పిల్లలకు దూరంగా చల్లని, పొడి ప్రదేశంలో ఉంచండి. నొప్పి లేదా జ్వరం కొనసాగితే వైద్యుడిని సంప్రదించండి.'
        },

        kn: {
          medicine: displayName,
          category: 'ನೋವು ನಿವಾರಕ / ಜ್ವರ ಕಡಿಮೆ ಮಾಡುವ ಔಷಧ',
          when:
            'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದ ಸಮಯ ಮತ್ತು ಪ್ರಮಾಣವನ್ನು ಅನುಸರಿಸಿ. ಸೂಚಿಸಿದ ಗರಿಷ್ಠ ದೈನಂದಿನ ಪ್ರಮಾಣವನ್ನು ಮೀರಬೇಡಿ.',
          food:
            'ಸಾಮಾನ್ಯವಾಗಿ ಆಹಾರದೊಂದಿಗೆ ಅಥವಾ ಆಹಾರವಿಲ್ಲದೆ ತೆಗೆದುಕೊಳ್ಳಬಹುದು. ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
          notes:
            'ವೈದ್ಯರ ಸಲಹೆಯಿಲ್ಲದೆ ಪ್ಯಾರಸಿಟಮಾಲ್ ಹೊಂದಿರುವ ಇತರ ಔಷಧಿಗಳೊಂದಿಗೆ ಸೇರಿಸಿ ತೆಗೆದುಕೊಳ್ಳಬೇಡಿ.',
          important:
            'ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದಂತೆ ತಂಪಾದ ಮತ್ತು ಒಣ ಸ್ಥಳದಲ್ಲಿ ಇರಿಸಿ. ನೋವು ಅಥವಾ ಜ್ವರ ಮುಂದುವರಿದರೆ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'വേദന സംഹാരി / പനി കുറയ്ക്കുന്ന മരുന്ന്',
          when:
            'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ച സമയവും അളവും പാലിക്കുക. നിർദ്ദേശിച്ച പരമാവധി ദിവസേനയുള്ള അളവ് കവിയരുത്.',
          food:
            'സാധാരണയായി ഭക്ഷണത്തോടൊപ്പം അല്ലെങ്കിൽ അല്ലാതെയും കഴിക്കാം. വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
          notes:
            'ഡോക്ടറുടെ നിർദ്ദേശമില്ലാതെ പാരസെറ്റമോൾ അടങ്ങിയ മറ്റ് മരുന്നുകളോടൊപ്പം കഴിക്കരുത്.',
          important:
            'കുട്ടികൾക്ക് ലഭിക്കാത്ത തണുത്തതും ഉണങ്ങിയതുമായ സ്ഥലത്ത് സൂക്ഷിക്കുക. വേദനയോ പനിയോ തുടരുകയാണെങ്കിൽ ഡോക്ടറെ കാണുക.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * 2. CETIRIZINE / ALLERGY MEDICINES
     * ---------------------------------------------------------
     */
    if (
      combined.includes('cetirizine') ||
      combined.includes('levocetirizine') ||
      combined.includes('zyrtec') ||
      combined.includes('allergy')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Antihistamine / Allergy Relief',
          when:
            'Take according to the schedule prescribed by your doctor or pharmacist.',
          food:
            'Can generally be taken with or without food. Swallow with water.',
          notes:
            'May cause drowsiness in some people. Use caution when driving or operating machinery.',
          important:
            'Keep away from children. Avoid alcohol if it increases drowsiness.'
        },

        ta: {
          medicine: displayName,
          category: 'ஒவ்வாமை நிவாரண மருந்து',
          when:
            'மருத்துவர் அல்லது மருந்தாளுநர் கூறிய அட்டவணைப்படி எடுத்துக்கொள்ளவும்.',
          food:
            'உணவுடனும் அல்லது உணவு இன்றியும் எடுத்துக்கொள்ளலாம். தண்ணீருடன் விழுங்கவும்.',
          notes:
            'சிலருக்கு தூக்கம் ஏற்படலாம். வாகனம் ஓட்டும்போது கவனமாக இருக்கவும்.',
          important:
            'குழந்தைகளுக்கு எட்டாத இடத்தில் வைக்கவும். தூக்கம் அதிகரித்தால் மதுவைத் தவிர்க்கவும்.'
        },

        hi: {
          medicine: displayName,
          category: 'एंटीहिस्टामाइन / एलर्जी राहत',
          when:
            'डॉक्टर या फार्मासिस्ट द्वारा बताए गए समय के अनुसार लें।',
          food:
            'भोजन के साथ या बिना लिया जा सकता है। पानी के साथ निगलें।',
          notes:
            'कुछ लोगों को नींद आ सकती है। वाहन चलाते समय सावधानी बरतें।',
          important:
            'बच्चों की पहुंच से दूर रखें। नींद बढ़ने पर शराब से बचें।'
        },

        te: {
          medicine: displayName,
          category: 'అలెర్జీ నివారిణి',
          when:
            'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన సమయాన్ని అనుసరించండి.',
          food:
            'ఆహారంతో లేదా ఆహారం లేకుండా తీసుకోవచ్చు. నీటితో మింగండి.',
          notes:
            'కొంతమందికి నిద్ర రావచ్చు. వాహనం నడిపేటప్పుడు జాగ్రత్తగా ఉండండి.',
          important:
            'పిల్లలకు అందకుండా ఉంచండి.'
        },

        kn: {
          medicine: displayName,
          category: 'ಅಲರ್ಜಿ ನಿವಾರಕ ಔಷಧ',
          when:
            'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದ ಸಮಯದಂತೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
          food:
            'ಆಹಾರದೊಂದಿಗೆ ಅಥವಾ ಆಹಾರವಿಲ್ಲದೆ ತೆಗೆದುಕೊಳ್ಳಬಹುದು. ನೀರಿನೊಂದಿಗೆ ನುಂಗಿ.',
          notes:
            'ಕೆಲವರಿಗೆ ನಿದ್ರಾವಸ್ಥೆ ಉಂಟಾಗಬಹುದು. ವಾಹನ ಚಾಲನೆ ಮಾಡುವಾಗ ಎಚ್ಚರಿಕೆಯಿಂದಿರಿ.',
          important:
            'ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದಂತೆ ಇರಿಸಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'അലർജി നിവാരണ മരുന്ന്',
          when:
            'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ച സമയക്രമം പാലിക്കുക.',
          food:
            'ഭക്ഷണത്തോടൊപ്പം അല്ലെങ്കിൽ അല്ലാതെയും കഴിക്കാം. വെള്ളത്തോടൊപ്പം വിഴുങ്ങുക.',
          notes:
            'ചിലർക്ക് ഉറക്കം വരാം. വാഹനം ഓടിക്കുമ്പോൾ ശ്രദ്ധിക്കുക.',
          important:
            'കുട്ടികൾക്ക് ലഭിക്കാത്തിടത്ത് സൂക്ഷിക്കുക.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * 3. BLOOD PRESSURE / CARDIOVASCULAR
     * ---------------------------------------------------------
     */
    if (
      combined.includes('amlodipine') ||
      combined.includes('amlo') ||
      combined.includes('telmisartan') ||
      combined.includes('losartan') ||
      combined.includes('atenolol')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Cardiovascular / Blood Pressure Control',
          when:
            'Take exactly according to the schedule prescribed by your doctor. Do not stop the medicine on your own.',
          food:
            'Follow the food instructions provided with your specific medicine. Swallow with water.',
          notes:
            'Monitor blood pressure as advised by your healthcare professional.',
          important:
            'Do not suddenly stop prescribed blood-pressure medicine without medical advice.'
        },

        ta: {
          medicine: displayName,
          category: 'இரத்த அழுத்தக் கட்டுப்பாட்டு மருந்து',
          when:
            'மருத்துவர் குறிப்பிட்ட அட்டவணைப்படி எடுத்துக்கொள்ளவும். மருத்துவரின் ஆலோசனை இல்லாமல் மருந்தை நிறுத்த வேண்டாம்.',
          food:
            'உங்கள் குறிப்பிட்ட மருந்துக்கான உணவு அறிவுறுத்தல்களைப் பின்பற்றவும். தண்ணீருடன் எடுத்துக்கொள்ளவும்.',
          notes:
            'மருத்துவர் கூறியபடி இரத்த அழுத்தத்தைத் தொடர்ந்து பரிசோதிக்கவும்.',
          important:
            'மருத்துவ ஆலோசனை இல்லாமல் இரத்த அழுத்த மருந்தை திடீரென நிறுத்த வேண்டாம்.'
        },

        hi: {
          medicine: displayName,
          category: 'रक्तचाप नियंत्रण दवा',
          when:
            'डॉक्टर द्वारा बताए गए समय के अनुसार लें। डॉक्टर की सलाह के बिना दवा बंद न करें।',
          food:
            'अपनी दवा के निर्देशों के अनुसार भोजन के संबंध में निर्देशों का पालन करें। पानी के साथ लें।',
          notes:
            'डॉक्टर की सलाह के अनुसार रक्तचाप की जांच करते रहें।',
          important:
            'डॉक्टर की सलाह के बिना दवा अचानक बंद न करें।'
        },

        te: {
          medicine: displayName,
          category: 'రక్తపోటు నియంత్రణ మందు',
          when:
            'డాక్టర్ సూచించిన సమయానికి తీసుకోండి. వైద్య సలహా లేకుండా మందును ఆపవద్దు.',
          food:
            'మీ మందుకు సంబంధించిన ఆహార సూచనలను అనుసరించండి. నీటితో తీసుకోండి.',
          notes:
            'డాక్టర్ సూచించిన విధంగా రక్తపోటును తనిఖీ చేయండి.',
          important:
            'వైద్య సలహా లేకుండా మందును అకస్మాత్తుగా ఆపవద్దు.'
        },

        kn: {
          medicine: displayName,
          category: 'ರಕ್ತದೊತ್ತಡ ನಿಯಂತ್ರಣ ಔಷಧ',
          when:
            'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಸಮಯದಂತೆ ತೆಗೆದುಕೊಳ್ಳಿ. ವೈದ್ಯರ ಸಲಹೆಯಿಲ್ಲದೆ ನಿಲ್ಲಿಸಬೇಡಿ.',
          food:
            'ನಿಮ್ಮ ಔಷಧಿಗೆ ನೀಡಿರುವ ಆಹಾರ ಸಂಬಂಧಿತ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ. ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
          notes:
            'ವೈದ್ಯರ ಸಲಹೆಯಂತೆ ರಕ್ತದೊತ್ತಡವನ್ನು ಪರೀಕ್ಷಿಸುತ್ತಿರಿ.',
          important:
            'ವೈದ್ಯರ ಸಲಹೆಯಿಲ್ಲದೆ ಔಷಧಿಯನ್ನು ಹಠಾತ್ ನಿಲ್ಲಿಸಬೇಡಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'രക്തസമ്മർദ്ദ നിയന്ത്രണ മരുന്ന്',
          when:
            'ഡോക്ടർ നിർദ്ദേശിച്ച സമയക്രമം പാലിക്കുക. ഡോക്ടറുടെ നിർദ്ദേശമില്ലാതെ മരുന്ന് നിർത്തരുത്.',
          food:
            'നിങ്ങളുടെ മരുന്നിനുള്ള ഭക്ഷണ നിർദ്ദേശങ്ങൾ പാലിക്കുക. വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
          notes:
            'ഡോക്ടറുടെ നിർദ്ദേശപ്രകാരം രക്തസമ്മർദ്ദം പരിശോധിക്കുക.',
          important:
            'ഡോക്ടറുടെ നിർദ്ദേശമില്ലാതെ മരുന്ന് പെട്ടെന്ന് നിർത്തരുത്.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * 4. ACIDITY / PANTOPRAZOLE / OMEPRAZOLE
     * ---------------------------------------------------------
     */
    if (
      combined.includes('pantoprazole') ||
      combined.includes('panto') ||
      combined.includes('omeprazole') ||
      combined.includes('rabeprazole') ||
      combined.includes('esomeprazole')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Acidity / Stomach Relief',
          when:
            'Follow the timing prescribed by your doctor or pharmacist. These medicines are commonly taken before food when specifically instructed.',
          food:
            'Follow the instructions on your medicine label. Swallow the tablet or capsule as directed and do not crush or chew an enteric-coated form unless instructed.',
          notes:
            'Take consistently according to your prescription.',
          important:
            'If acidity or stomach symptoms continue despite treatment, consult your doctor.'
        },

        ta: {
          medicine: displayName,
          category: 'அமிலத்தன்மை / வயிற்று நிவாரண மருந்து',
          when:
            'மருத்துவர் அல்லது மருந்தாளுநர் கூறிய நேரத்தைப் பின்பற்றவும். குறிப்பிட்ட ஆலோசனை இருந்தால் உணவிற்கு முன் எடுத்துக்கொள்ளவும்.',
          food:
            'மருந்துச் சீட்டில் உள்ள அறிவுறுத்தல்களைப் பின்பற்றவும். மருத்துவர் கூறியபடி மாத்திரை அல்லது கேப்ஸ்யூலை விழுங்கவும்.',
          notes:
            'மருத்துவர் பரிந்துரைத்தபடி தொடர்ந்து எடுத்துக்கொள்ளவும்.',
          important:
            'சிகிச்சைக்குப் பிறகும் வயிற்று எரிச்சல் அல்லது அமிலத்தன்மை தொடர்ந்தால் மருத்துவரை அணுகவும்.'
        },

        hi: {
          medicine: displayName,
          category: 'एसिडिटी / पेट से राहत',
          when:
            'डॉक्टर या फार्मासिस्ट द्वारा बताए गए समय का पालन करें। यदि निर्देश दिया गया हो तो भोजन से पहले लें।',
          food:
            'दवा के लेबल पर दिए निर्देशों का पालन करें। डॉक्टर के निर्देश के अनुसार गोली या कैप्सूल निगलें।',
          notes:
            'प्रिस्क्रिप्शन के अनुसार नियमित रूप से लें।',
          important:
            'इलाज के बावजूद पेट की समस्या बनी रहे तो डॉक्टर से संपर्क करें।'
        },

        te: {
          medicine: displayName,
          category: 'ఆమ్లత్వం / కడుపు ఉపశమనం',
          when:
            'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన సమయాన్ని అనుసరించండి. సూచించినట్లయితే భోజనానికి ముందు తీసుకోండి.',
          food:
            'మందు లేబుల్‌పై ఉన్న సూచనలను అనుసరించండి. సూచించిన విధంగా మాత్రను లేదా క్యాప్సూల్‌ను మింగండి.',
          notes:
            'డాక్టర్ సూచించిన విధంగా క్రమం తప్పకుండా తీసుకోండి.',
          important:
            'చికిత్స తర్వాత కూడా కడుపు సమస్య కొనసాగితే డాక్టర్‌ను సంప్రదించండి.'
        },

        kn: {
          medicine: displayName,
          category: 'ಆಮ್ಲೀಯತೆ / ಹೊಟ್ಟೆ ಪರಿಹಾರ',
          when:
            'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದ ಸಮಯವನ್ನು ಅನುಸರಿಸಿ. ಸೂಚಿಸಿದರೆ ಆಹಾರಕ್ಕಿಂತ ಮೊದಲು ತೆಗೆದುಕೊಳ್ಳಿ.',
          food:
            'ಔಷಧಿಯ ಲೇಬಲ್‌ನಲ್ಲಿರುವ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ. ಸೂಚಿಸಿದಂತೆ ಮಾತ್ರೆಯನ್ನು ಅಥವಾ ಕ್ಯಾಪ್ಸುಲ್ ಅನ್ನು ನುಂಗಿ.',
          notes:
            'ವೈದ್ಯರು ಸೂಚಿಸಿದಂತೆ ನಿಯಮಿತವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಿ.',
          important:
            'ಚಿಕಿತ್ಸೆಯ ನಂತರವೂ ಹೊಟ್ಟೆಯ ಸಮಸ್ಯೆ ಮುಂದುವರಿದರೆ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'അസിഡിറ്റി / വയറിന് ആശ്വാസം',
          when:
            'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ച സമയക്രമം പാലിക്കുക. നിർദ്ദേശിച്ചിട്ടുണ്ടെങ്കിൽ ഭക്ഷണത്തിന് മുമ്പ് കഴിക്കുക.',
          food:
            'മരുന്നിന്റെ ലേബലിലെ നിർദ്ദേശങ്ങൾ പാലിക്കുക. നിർദ്ദേശിച്ചതുപോലെ ഗുളികയോ ക്യാപ്സ്യൂളോ വിഴുങ്ങുക.',
          notes:
            'ഡോക്ടർ നിർദ്ദേശിച്ച പ്രകാരം പതിവായി കഴിക്കുക.',
          important:
            'ചികിത്സയ്ക്കുശേഷവും വയറിന്റെ അസ്വസ്ഥത തുടരുകയാണെങ്കിൽ ഡോക്ടറെ കാണുക.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * 5. ANTI-DIABETIC
     * ---------------------------------------------------------
     */
    if (
      combined.includes('metformin') ||
      combined.includes('glycomet') ||
      combined.includes('glimepiride') ||
      combined.includes('vildagliptin') ||
      combined.includes('sitagliptin') ||
      combined.includes('diabetes')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Anti-Diabetic / Blood Sugar Control',
          when:
            'Take according to the schedule prescribed by your doctor. Do not change the dose without medical advice.',
          food:
            'Follow the food instructions specific to your medicine. Some diabetes medicines should be taken with or around meals.',
          notes:
            'Monitor blood sugar as advised and follow your recommended diet and activity plan.',
          important:
            'Do not change or stop diabetes medication without consulting your healthcare professional.'
        },

        ta: {
          medicine: displayName,
          category: 'நீரிழிவு / இரத்த சர்க்கரை கட்டுப்பாட்டு மருந்து',
          when:
            'மருத்துவர் பரிந்துரைத்த அட்டவணைப்படி எடுத்துக்கொள்ளவும். மருத்துவ ஆலோசனை இல்லாமல் அளவை மாற்ற வேண்டாம்.',
          food:
            'உங்கள் மருந்துக்கான உணவு அறிவுறுத்தல்களைப் பின்பற்றவும். சில நீரிழிவு மருந்துகள் உணவுடன் அல்லது உணவு நேரத்தைச் சுற்றி எடுக்கப்பட வேண்டும்.',
          notes:
            'மருத்துவர் கூறியபடி இரத்த சர்க்கரையை பரிசோதித்து, பரிந்துரைக்கப்பட்ட உணவு முறையைப் பின்பற்றவும்.',
          important:
            'மருத்துவரிடம் ஆலோசிக்காமல் நீரிழிவு மருந்தை மாற்றவோ நிறுத்தவோ வேண்டாம்.'
        },

        hi: {
          medicine: displayName,
          category: 'मधुमेह / रक्त शर्करा नियंत्रण',
          when:
            'डॉक्टर द्वारा बताए गए समय के अनुसार लें। डॉक्टर की सलाह के बिना खुराक न बदलें।',
          food:
            'अपनी दवा के भोजन संबंधी निर्देशों का पालन करें। कुछ मधुमेह की दवाएं भोजन के साथ या भोजन के आसपास ली जाती हैं।',
          notes:
            'डॉक्टर की सलाह के अनुसार ब्लड शुगर की जांच करें और उचित आहार का पालन करें।',
          important:
            'डॉक्टर से सलाह किए बिना दवा बंद या बदलें नहीं।'
        },

        te: {
          medicine: displayName,
          category: 'మధుమేహం / రక్తంలో చక్కెర నియంత్రణ',
          when:
            'డాక్టర్ సూచించిన సమయానికి తీసుకోండి. వైద్య సలహా లేకుండా మోతాదును మార్చవద్దు.',
          food:
            'మీ మందుకు సంబంధించిన ఆహార సూచనలను అనుసరించండి.',
          notes:
            'డాక్టర్ సూచించిన విధంగా బ్లడ్ షుగర్‌ను తనిఖీ చేయండి.',
          important:
            'వైద్య సలహా లేకుండా మందును ఆపవద్దు లేదా మార్చవద్దు.'
        },

        kn: {
          medicine: displayName,
          category: 'ಮಧುಮೇಹ / ರಕ್ತದಲ್ಲಿನ ಸಕ್ಕರೆ ನಿಯಂತ್ರಣ',
          when:
            'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಸಮಯದಂತೆ ತೆಗೆದುಕೊಳ್ಳಿ. ವೈದ್ಯರ ಸಲಹೆಯಿಲ್ಲದೆ ಪ್ರಮಾಣ ಬದಲಾಯಿಸಬೇಡಿ.',
          food:
            'ನಿಮ್ಮ ಔಷಧಿಗೆ ಸಂಬಂಧಿಸಿದ ಆಹಾರ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.',
          notes:
            'ವೈದ್ಯರ ಸಲಹೆಯಂತೆ ರಕ್ತದಲ್ಲಿನ ಸಕ್ಕರೆಯನ್ನು ಪರೀಕ್ಷಿಸಿ.',
          important:
            'ವೈದ್ಯರ ಸಲಹೆಯಿಲ್ಲದೆ ಔಷಧಿಯನ್ನು ನಿಲ್ಲಿಸಬೇಡಿ ಅಥವಾ ಬದಲಾಯಿಸಬೇಡಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'പ്രമേഹ / രക്തത്തിലെ പഞ്ചസാര നിയന്ത്രണം',
          when:
            'ഡോക്ടർ നിർദ്ദേശിച്ച സമയക്രമം പാലിക്കുക. ഡോക്ടറുടെ നിർദ്ദേശമില്ലാതെ അളവ് മാറ്റരുത്.',
          food:
            'നിങ്ങളുടെ മരുന്നിനുള്ള ഭക്ഷണ നിർദ്ദേശങ്ങൾ പാലിക്കുക.',
          notes:
            'ഡോക്ടറുടെ നിർദ്ദേശപ്രകാരം രക്തത്തിലെ പഞ്ചസാര പരിശോധിക്കുക.',
          important:
            'ഡോക്ടറുടെ നിർദ്ദേശമില്ലാതെ മരുന്ന് നിർത്തുകയോ മാറ്റുകയോ ചെയ്യരുത്.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * 6. ANTIBIOTICS
     * ---------------------------------------------------------
     */
    if (
      combined.includes('amoxicillin') ||
      combined.includes('amoxi') ||
      combined.includes('azithromycin') ||
      combined.includes('azithro') ||
      combined.includes('cipro') ||
      combined.includes('cefixime') ||
      combined.includes('antibiotic')
    ) {
      return {
        en: {
          medicine: displayName,
          category: 'Antibiotic / Bacterial Infection Treatment',
          when:
            'Take exactly according to the schedule prescribed by your doctor. Complete the prescribed course unless your healthcare professional tells you otherwise.',
          food:
            'Follow the food instructions specific to your antibiotic. Take with sufficient water.',
          notes:
            'Do not share antibiotics with another person and do not use leftover antibiotics for a new illness.',
          important:
            'Seek medical advice promptly if you develop signs of a serious allergic reaction such as difficulty breathing or swelling.'
        },

        ta: {
          medicine: displayName,
          category: 'நுண்ணுயிர் எதிர்ப்பு மருந்து / தொற்று சிகிச்சை',
          when:
            'மருத்துவர் குறிப்பிட்ட அட்டவணைப்படி எடுத்துக்கொள்ளவும். மருத்துவர் வேறு அறிவுரை வழங்காவிட்டால் பரிந்துரைக்கப்பட்ட கோர்ஸை முடிக்கவும்.',
          food:
            'உங்கள் குறிப்பிட்ட ஆன்டிபயாட்டிக்கிற்கான உணவு அறிவுறுத்தல்களைப் பின்பற்றவும். போதுமான தண்ணீருடன் எடுத்துக்கொள்ளவும்.',
          notes:
            'ஆன்டிபயாட்டிக் மருந்தை மற்றவர்களுடன் பகிர வேண்டாம். மீதமுள்ள மருந்தை புதிய நோய்க்கு பயன்படுத்த வேண்டாம்.',
          important:
            'மூச்சுத்திணறல் அல்லது வீக்கம் போன்ற கடுமையான ஒவ்வாமை அறிகுறிகள் ஏற்பட்டால் உடனடியாக மருத்துவ உதவி பெறவும்.'
        },

        hi: {
          medicine: displayName,
          category: 'एंटीबायोटिक / संक्रमण उपचार',
          when:
            'डॉक्टर द्वारा बताए गए समय के अनुसार लें। डॉक्टर द्वारा अलग निर्देश न दिए जाने तक निर्धारित कोर्स पूरा करें।',
          food:
            'अपनी एंटीबायोटिक के भोजन संबंधी निर्देशों का पालन करें। पर्याप्त पानी के साथ लें।',
          notes:
            'एंटीबायोटिक किसी दूसरे व्यक्ति के साथ साझा न करें और बची हुई दवा को नई बीमारी में इस्तेमाल न करें।',
          important:
            'सांस लेने में कठिनाई या सूजन जैसी गंभीर एलर्जी के लक्षण हों तो तुरंत चिकित्सा सहायता लें।'
        },

        te: {
          medicine: displayName,
          category: 'యాంటీబయోటిక్ / బ్యాక్టీరియా ఇన్ఫెక్షన్ చికిత్స',
          when:
            'డాక్టర్ సూచించిన సమయానికి తీసుకోండి. వైద్యుడు వేరుగా చెప్పకపోతే సూచించిన కోర్సును పూర్తి చేయండి.',
          food:
            'మీ యాంటీబయోటిక్‌కు సంబంధించిన ఆహార సూచనలను అనుసరించండి. తగినంత నీటితో తీసుకోండి.',
          notes:
            'యాంటీబయోటిక్‌ను ఇతరులతో పంచుకోకండి. మిగిలిన మందును కొత్త అనారోగ్యానికి ఉపయోగించకండి.',
          important:
            'శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా వాపు వంటి తీవ్రమైన అలెర్జీ లక్షణాలు ఉంటే వెంటనే వైద్య సహాయం పొందండి.'
        },

        kn: {
          medicine: displayName,
          category: 'ಪ್ರತಿಜೀವಕ / ಬ್ಯಾಕ್ಟೀರಿಯಾ ಸೋಂಕಿನ ಚಿಕಿತ್ಸೆ',
          when:
            'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಸಮಯದಂತೆ ತೆಗೆದುಕೊಳ್ಳಿ. ವೈದ್ಯರು ಬೇರೆ ಹೇಳದಿದ್ದರೆ ಸೂಚಿಸಿದ ಕೋರ್ಸ್ ಅನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.',
          food:
            'ನಿಮ್ಮ ಪ್ರತಿಜೀವಕಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಆಹಾರ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ. ಸಾಕಷ್ಟು ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
          notes:
            'ಪ್ರತಿಜೀವಕವನ್ನು ಇತರರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ. ಉಳಿದ ಔಷಧಿಯನ್ನು ಹೊಸ ಅನಾರೋಗ್ಯಕ್ಕೆ ಬಳಸಬೇಡಿ.',
          important:
            'ಉಸಿರಾಟದ ತೊಂದರೆ ಅಥವಾ ಊತದಂತಹ ತೀವ್ರ ಅಲರ್ಜಿ ಲಕ್ಷಣಗಳಿದ್ದರೆ ತಕ್ಷಣ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಪಡೆಯಿರಿ.'
        },

        ml: {
          medicine: displayName,
          category: 'ആന്റിബയോട്ടിക് / ബാക്ടീരിയൽ അണുബാധ ചികിത്സ',
          when:
            'ഡോക്ടർ നിർദ്ദേശിച്ച സമയക്രമം കൃത്യമായി പാലിക്കുക. ഡോക്ടർ മറ്റൊന്ന് നിർദ്ദേശിച്ചില്ലെങ്കിൽ നിർദ്ദേശിച്ച കോഴ്സ് പൂർത്തിയാക്കുക.',
          food:
            'നിങ്ങളുടെ ആന്റിബയോട്ടിക്കിനുള്ള ഭക്ഷണ നിർദ്ദേശങ്ങൾ പാലിക്കുക. ആവശ്യത്തിന് വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
          notes:
            'ആന്റിബയോട്ടിക് മറ്റൊരാളുമായി പങ്കിടരുത്. ശേഷിച്ച മരുന്ന് പുതിയ രോഗത്തിന് ഉപയോഗിക്കരുത്.',
          important:
            'ശ്വാസതടസ്സം അല്ലെങ്കിൽ വീക്കം പോലുള്ള ഗുരുതര അലർജി ലക്ഷണങ്ങൾ ഉണ്ടായാൽ ഉടൻ വൈദ്യസഹായം തേടുക.'
        }
      };
    }

    /*
     * ---------------------------------------------------------
     * DEFAULT GENERAL MEDICINE GUIDANCE
     * ---------------------------------------------------------
     */
    return {
      en: {
        medicine: displayName,
        category: 'Prescription / General Medicine',
        when:
          'Follow the exact timing and dosage schedule provided by your doctor or pharmacist on your prescription label.',
        food:
          'Follow the food instructions printed on the medicine package or provided by your healthcare professional.',
        notes:
          'Do not change, skip, or double doses without consulting your doctor or pharmacist.',
        important:
          'Keep the medicine in its original packaging in a cool, dry place away from children and direct heat.'
      },

      ta: {
        medicine: displayName,
        category: 'மருத்துவர் பரிந்துரைத்த பொது மருந்து',
        when:
          'உங்கள் மருந்துச் சீட்டில் மருத்துவர் அல்லது மருந்தாளுநர் குறிப்பிட்டுள்ள சரியான நேரம் மற்றும் அளவைப் பின்பற்றவும்.',
        food:
          'மருந்துப் பொதியில் அல்லது மருத்துவ நிபுணர் வழங்கிய உணவு தொடர்பான அறிவுறுத்தல்களைப் பின்பற்றவும்.',
        notes:
          'மருத்துவர் அல்லது மருந்தாளுநரிடம் ஆலோசிக்காமல் அளவை மாற்றவோ தவிர்க்கவோ இரட்டிப்பாக்கவோ வேண்டாம்.',
        important:
          'அசல் பேக்கிங்கில் குழந்தைகளுக்கு எட்டாத குளிர்ந்த, உலர்ந்த இடத்தில் பாதுகாப்பாக வைக்கவும்.'
      },

      hi: {
        medicine: displayName,
        category: 'प्रिस्क्रिप्शन / सामान्य दवा',
        when:
          'अपने डॉक्टर या फार्मासिस्ट द्वारा पर्चे पर बताए गए सही समय और खुराक का पालन करें।',
        food:
          'दवा के पैकेट या स्वास्थ्यकर्मी द्वारा दिए गए भोजन संबंधी निर्देशों का पालन करें।',
        notes:
          'डॉक्टर या फार्मासिस्ट से सलाह किए बिना खुराक बदलें, छोड़ें या दोगुनी न करें।',
        important:
          'दवा को मूल पैकेजिंग में बच्चों की पहुंच से दूर ठंडी और सूखी जगह पर रखें।'
      },

      te: {
        medicine: displayName,
        category: 'సాధారణ ఔషధం',
        when:
          'మీ డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన ఖచ్చితమైన సమయం మరియు మోతాదును అనుసరించండి.',
        food:
          'మందు ప్యాకెట్‌పై లేదా వైద్య నిపుణులు ఇచ్చిన ఆహార సూచనలను అనుసరించండి.',
        notes:
          'వైద్య సలహా లేకుండా మోతాదును మార్చవద్దు, వదిలివేయవద్దు లేదా రెట్టింపు చేయవద్దు.',
        important:
          'మందును అసలు ప్యాకేజీలో పిల్లలకు దూరంగా చల్లని, పొడి ప్రదేశంలో ఉంచండి.'
      },

      kn: {
        medicine: displayName,
        category: 'ಸಾಮಾನ್ಯ ಔಷಧ',
        when:
          'ನಿಮ್ಮ ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದ ನಿಖರ ಸಮಯ ಮತ್ತು ಪ್ರಮಾಣವನ್ನು ಅನುಸರಿಸಿ.',
        food:
          'ಔಷಧಿಯ ಪ್ಯಾಕೆಟ್‌ನಲ್ಲಿ ಅಥವಾ ವೈದ್ಯಕೀಯ ವೃತ್ತಿಪರರು ನೀಡಿದ ಆಹಾರ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.',
        notes:
          'ವೈದ್ಯರ ಅಥವಾ ಔಷಧಿಕಾರರ ಸಲಹೆಯಿಲ್ಲದೆ ಪ್ರಮಾಣವನ್ನು ಬದಲಾಯಿಸಬೇಡಿ, ಬಿಟ್ಟುಬಿಡಬೇಡಿ ಅಥವಾ ದ್ವಿಗುಣಗೊಳಿಸಬೇಡಿ.',
        important:
          'ಔಷಧಿಯನ್ನು ಮೂಲ ಪ್ಯಾಕೇಜ್‌ನಲ್ಲಿ ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದ ತಂಪಾದ ಮತ್ತು ಒಣ ಸ್ಥಳದಲ್ಲಿ ಇರಿಸಿ.'
      },

      ml: {
        medicine: displayName,
        category: 'ജനറൽ മരുന്ന്',
        when:
          'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ച കൃത്യമായ സമയവും അളവും പാലിക്കുക.',
        food:
          'മരുന്നിന്റെ പാക്കറ്റിലോ ആരോഗ്യപ്രവർത്തകൻ നൽകിയതോ ആയ ഭക്ഷണ നിർദ്ദേശങ്ങൾ പാലിക്കുക.',
        notes:
          'ഡോക്ടറുടെയോ ഫാർമസിസ്റ്റിന്റെയോ നിർദ്ദേശമില്ലാതെ അളവ് മാറ്റുകയോ ഒഴിവാക്കുകയോ ഇരട്ടിയാക്കുകയോ ചെയ്യരുത്.',
        important:
          'മരുന്ന് അതിന്റെ യഥാർത്ഥ പാക്കേജിൽ കുട്ടികൾക്ക് ലഭിക്കാത്ത തണുത്തതും ഉണങ്ങിയതുമായ സ്ഥലത്ത് സൂക്ഷിക്കുക.'
      }
    };
  }

  /**
   * Local fallback dataset.
   *
   * Used when the DrugDB API cannot be reached.
   */
  const FALLBACK_MEDICINES = [
    {
      medicineSctid: '906051000189105',
      medicineName: 'Para Para (paracetamol) 650 mg oral tablet',
      brand: 'Para Para 650',
      manufacturer: 'Perk Pharmaceuticals Limited',
      generic: 'Paracetamol 650 mg oral tablet'
    },

    {
      medicineSctid: '562441000189108',
      medicineName: 'Dolo 650 (paracetamol) 650 mg oral tablet',
      brand: 'Dolo 650',
      manufacturer: 'Micro Labs Ltd',
      generic: 'Paracetamol 650 mg oral tablet'
    },

    {
      medicineSctid: '322236009',
      medicineName: 'Crocin Advance (paracetamol) 500 mg oral tablet',
      brand: 'Crocin Advance',
      manufacturer: 'GlaxoSmithKline Consumer Healthcare',
      generic: 'Paracetamol 500 mg oral tablet'
    },

    {
      medicineSctid: '784231000189109',
      medicineName: 'Amlo (amlodipine besilate) 5 mg oral tablet',
      brand: 'Amlo 5',
      manufacturer: 'Orchid Chemicals & Pharmaceuticals Limited',
      generic: 'Amlodipine 5 mg oral tablet'
    },

    {
      medicineSctid: '784231000189110',
      medicineName: 'Amlong (amlodipine) 5 mg oral tablet',
      brand: 'Amlong 5',
      manufacturer: 'Micro Labs Ltd',
      generic: 'Amlodipine 5 mg oral tablet'
    },

    {
      medicineSctid: '784231000189111',
      medicineName: 'Amlokind 5 (amlodipine) 5 mg oral tablet',
      brand: 'Amlokind 5',
      manufacturer: 'Mankind Pharma Ltd',
      generic: 'Amlodipine 5 mg oral tablet'
    },

    {
      medicineSctid: '322238002',
      medicineName: 'Cetzine (cetirizine hydrochloride) 10 mg oral tablet',
      brand: 'Cetzine 10',
      manufacturer: "Dr. Reddy's Laboratories Ltd",
      generic: 'Cetirizine hydrochloride 10 mg oral tablet'
    },

    {
      medicineSctid: '322238003',
      medicineName: 'Zyrtec (cetirizine) 10 mg oral tablet',
      brand: 'Zyrtec',
      manufacturer: 'GSK Pharmaceuticals',
      generic: 'Cetirizine 10 mg oral tablet'
    },

    {
      medicineSctid: '322238004',
      medicineName: 'Okacet (cetirizine) 10 mg oral tablet',
      brand: 'Okacet',
      manufacturer: 'Cipla Ltd',
      generic: 'Cetirizine 10 mg oral tablet'
    },

    {
      medicineSctid: '322239001',
      medicineName: 'Pan 40 (pantoprazole sodium) 40 mg gastro-resistant tablet',
      brand: 'Pan 40',
      manufacturer: 'Alkem Laboratories Ltd',
      generic: 'Pantoprazole 40 mg gastro-resistant tablet'
    },

    {
      medicineSctid: '322239002',
      medicineName: 'Pantocid 40 (pantoprazole) 40 mg oral tablet',
      brand: 'Pantocid 40',
      manufacturer: 'Sun Pharmaceutical Industries Ltd',
      generic: 'Pantoprazole 40 mg oral tablet'
    },

    {
      medicineSctid: '322240001',
      medicineName: 'Glycomet 500 (metformin hydrochloride) 500 mg oral tablet',
      brand: 'Glycomet 500',
      manufacturer: 'USV Private Limited',
      generic: 'Metformin hydrochloride 500 mg oral tablet'
    },

    {
      medicineSctid: '322240002',
      medicineName: 'Glycomet-GP 1 (metformin + glimepiride) tablet',
      brand: 'Glycomet-GP 1',
      manufacturer: 'USV Private Limited',
      generic: 'Metformin 500 mg + Glimepiride 1 mg tablet'
    },

    {
      medicineSctid: '322241001',
      medicineName: 'Novamox 500 (amoxicillin trihydrate) 500 mg oral capsule',
      brand: 'Novamox 500',
      manufacturer: 'Cipla Ltd',
      generic: 'Amoxicillin 500 mg oral capsule'
    },

    {
      medicineSctid: '322241002',
      medicineName: 'Mox 500 (amoxicillin) 500 mg oral capsule',
      brand: 'Mox 500',
      manufacturer: 'Sun Pharmaceutical Industries Ltd',
      generic: 'Amoxicillin 500 mg oral capsule'
    },

    {
      medicineSctid: '322241003',
      medicineName: 'Augmentin 625 Duo (amoxicillin + clavulanic acid) tablet',
      brand: 'Augmentin 625 Duo',
      manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
      generic: 'Amoxicillin 500 mg + Clavulanic Acid 125 mg tablet'
    },

    {
      medicineSctid: '322242001',
      medicineName: 'Azithral 500 (azithromycin) 500 mg oral tablet',
      brand: 'Azithral 500',
      manufacturer: 'Alembic Pharmaceuticals Ltd',
      generic: 'Azithromycin 500 mg oral tablet'
    },

    {
      medicineSctid: '322243001',
      medicineName: 'Telma 40 (telmisartan) 40 mg oral tablet',
      brand: 'Telma 40',
      manufacturer: 'Glenmark Pharmaceuticals Ltd',
      generic: 'Telmisartan 40 mg oral tablet'
    },

    {
      medicineSctid: '322244001',
      medicineName: 'Atorva 10 (atorvastatin) 10 mg oral tablet',
      brand: 'Atorva 10',
      manufacturer: 'Zydus Cadila Healthcare',
      generic: 'Atorvastatin 10 mg oral tablet'
    },

    {
      medicineSctid: '322245001',
      medicineName: 'Omez 20 (omeprazole) 20 mg oral capsule',
      brand: 'Omez 20',
      manufacturer: "Dr. Reddy's Laboratories Ltd",
      generic: 'Omeprazole 20 mg oral capsule'
    }
  ];

  /**
   * Search the local fallback medicine database.
   *
   * Supports partial matching:
   *   para
   *   dolo
   *   amlo
   *   ceti
   *   panto
   *   glyco
   *   amoxi
   *   azith
   *   telma
   *   ator
   *   omez
   *
   * @param {string} query
   * @returns {Array}
   */
  function searchFallbackMedicines(query) {
    const q = String(query || '')
      .toLowerCase()
      .trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const matches = FALLBACK_MEDICINES.filter((medicine) => {
      const searchableText = [
        medicine.medicineName,
        medicine.brand,
        medicine.generic,
        medicine.manufacturer
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(q);
    });

    return matches
      .map((medicine, index) => {
        const parsed = parseDrugDBItem(
          {
            ...medicine
          },
          index
        );

        if (parsed) {
          parsed.isLiveDrugDB = false;
        }

        return parsed;
      })
      .filter(Boolean)
      .slice(0, MAX_RESULTS);
  }

  /**
   * Clear all cached searches.
   */
  function clearCache() {
    CACHE.clear();
  }

  /**
   * Remove one cached search.
   *
   * @param {string} query
   */
  function clearCacheFor(query) {
    const key = String(query || '')
      .trim()
      .toLowerCase();

    if (key) {
      CACHE.delete(key);
    }
  }

  /**
   * Return cache size.
   *
   * @returns {number}
   */
  function getCacheSize() {
    return CACHE.size;
  }

  /**
   * Public API.
   */
  return {
    search,

    parseDrugDBItem,
    formatMedicineName,
    buildFactualInstructions,

    searchFallbackMedicines,

    clearCache,
    clearCacheFor,
    getCacheSize,

    FALLBACK_MEDICINES
  };
})();

/**
 * Browser global.
 */
if (typeof window !== 'undefined') {
  window.DrugDB = DrugDB;
}

/**
 * CommonJS / Node.js support.
 */
if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports = DrugDB;
}
