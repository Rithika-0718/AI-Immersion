/**
 * DoseSpeak — Data & Recently Viewed Manager
 * Manages medicine models, presets, and localStorage recent history
 */

const RECENT_KEY = 'dosespeak_recent_medicines';

const MedicineData = (() => {

  /**
   * Get recently viewed medicines from localStorage
   */
  function getRecentlyViewed() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to load recently viewed:', e);
      return [];
    }
  }


  /**
   * Save a medicine to recently viewed history
   * Maximum 8 entries, deduplicated
   */
  function addRecentlyViewed(medicine) {
    if (!medicine || !medicine.name) return;

    try {
      let recent = getRecentlyViewed();

      // Remove existing duplicate
      recent = recent.filter(
        m => m.id !== medicine.id && m.name !== medicine.name
      );

      // Add newest medicine at the beginning
      recent.unshift({
        id: medicine.id,
        name: medicine.name,
        brand: medicine.brand || '',
        category: medicine.category || '',
        icon: medicine.icon || '💊',
        viewedAt: new Date().toISOString()
      });

      // Keep only the latest 8
      if (recent.length > 8) {
        recent = recent.slice(0, 8);
      }

      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify(recent)
      );

    } catch (e) {
      console.warn('Failed to save recently viewed:', e);
    }
  }


  /**
   * Clear recently viewed history
   */
  function clearRecentlyViewed() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch (e) {
      console.warn('Failed to clear recently viewed:', e);
    }
  }


  /**
   * Generate safe multilingual medicine instructions.
   *
   * Preferred source:
   * DrugDB.buildFactualInstructions()
   *
   * Fallback:
   * General, non-personalized safety wording.
   */
  function getSafeInstructions(name, generic, brand) {

    // Use DrugDB's instruction builder when available
    if (
      typeof DrugDB !== 'undefined' &&
      typeof DrugDB.buildFactualInstructions === 'function'
    ) {
      return DrugDB.buildFactualInstructions(
        name,
        generic,
        brand
      );
    }

    // Safe fallback instructions
    return {

      en: {
        medicine: name,
        category: 'Medicine Information',
        when: 'Follow the schedule and instructions given by your doctor or pharmacist.',
        food: 'Take only as directed by your doctor or pharmacist, with water if appropriate.',
        notes: 'Do not change or exceed the prescribed dose. If you have questions or concerns, consult a doctor or pharmacist.',
        important: 'Keep out of reach of children. Store according to the instructions on the medicine package.'
      },

      ta: {
        medicine: name,
        category: 'மருந்து தகவல்',
        when: 'உங்கள் மருத்துவர் அல்லது மருந்தாளுநர் கூறிய நேரம் மற்றும் வழிமுறைகளைப் பின்பற்றவும்.',
        food: 'மருத்துவர் அல்லது மருந்தாளுநர் கூறியபடி, தேவையானால் தண்ணீருடன் எடுத்துக்கொள்ளவும்.',
        notes: 'மருத்துவர் கூறிய அளவை மாற்றவோ அதிகமாக எடுத்துக்கொள்ளவோ வேண்டாம். சந்தேகம் இருந்தால் மருத்துவர் அல்லது மருந்தாளுநரை அணுகவும்.',
        important: 'குழந்தைகளுக்கு எட்டாத இடத்தில் வைக்கவும். மருந்து தொகுப்பில் கூறியபடி சேமிக்கவும்.'
      },

      hi: {
        medicine: name,
        category: 'दवा की जानकारी',
        when: 'डॉक्टर या फार्मासिस्ट द्वारा बताए गए समय और निर्देशों का पालन करें।',
        food: 'डॉक्टर या फार्मासिस्ट के निर्देश के अनुसार, आवश्यकता होने पर पानी के साथ लें।',
        notes: 'निर्धारित खुराक को बदलें या उससे अधिक न लें। किसी भी संदेह या चिंता के लिए डॉक्टर या फार्मासिस्ट से सलाह लें।',
        important: 'बच्चों की पहुंच से दूर रखें। दवा के पैकेज पर दिए गए निर्देशों के अनुसार संग्रह करें।'
      },

      te: {
        medicine: name,
        category: 'మందుల సమాచారం',
        when: 'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన సమయం మరియు సూచనలను అనుసరించండి.',
        food: 'డాక్టర్ లేదా ఫార్మసిస్ట్ సూచించిన విధంగా, అవసరమైతే నీటితో తీసుకోండి.',
        notes: 'సూచించిన మోతాదును మార్చకండి లేదా మించకండి. ఏదైనా సందేహం ఉంటే డాక్టర్ లేదా ఫార్మసిస్ట్‌ను సంప్రదించండి.',
        important: 'పిల్లలకు అందకుండా ఉంచండి. మందు ప్యాకేజీపై ఇచ్చిన సూచనల ప్రకారం నిల్వ చేయండి.'
      },

      kn: {
        medicine: name,
        category: 'ಔಷಧ ಮಾಹಿತಿ',
        when: 'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದ ಸಮಯ ಮತ್ತು ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.',
        food: 'ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರು ಸೂಚಿಸಿದಂತೆ, ಅಗತ್ಯವಿದ್ದರೆ ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
        notes: 'ಸೂಚಿಸಿದ ಪ್ರಮಾಣವನ್ನು ಬದಲಾಯಿಸಬೇಡಿ ಅಥವಾ ಮೀರಬೇಡಿ. ಯಾವುದೇ ಅನುಮಾನವಿದ್ದರೆ ವೈದ್ಯರು ಅಥವಾ ಔಷಧಿಕಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
        important: 'ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದಂತೆ ಇಡಿ. ಔಷಧಿಯ ಪ್ಯಾಕೇಜ್‌ನಲ್ಲಿರುವ ಸೂಚನೆಗಳಂತೆ ಸಂಗ್ರಹಿಸಿ.'
      },

      ml: {
        medicine: name,
        category: 'മരുന്ന് വിവരങ്ങൾ',
        when: 'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ച സമയവും നിർദ്ദേശങ്ങളും പാലിക്കുക.',
        food: 'ഡോക്ടർ അല്ലെങ്കിൽ ഫാർമസിസ്റ്റ് നിർദ്ദേശിച്ചതുപോലെ, ആവശ്യമെങ്കിൽ വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
        notes: 'നിർദ്ദേശിച്ച ഡോസ് മാറ്റുകയോ അതിൽ കൂടുതൽ കഴിക്കുകയോ ചെയ്യരുത്. സംശയങ്ങളുണ്ടെങ്കിൽ ഡോക്ടറെയോ ഫാർമസിസ്റ്റിനെയോ സമീപിക്കുക.',
        important: 'കുട്ടികളിൽ നിന്ന് അകലെ സൂക്ഷിക്കുക. മരുന്നിന്റെ പാക്കേജിലെ നിർദ്ദേശങ്ങൾ അനുസരിച്ച് സംഭരിക്കുക.'
      }

    };
  }


  /**
   * Quick preset medicines for instant access
   */
  function getPresetMedicines() {

    return [

      {
        id: 'paracetamol-500',
        name: 'Paracetamol 500 mg',
        brand: 'Paracetamol',
        generic: 'Acetaminophen / Paracetamol',
        category: 'Pain Relief / Fever Reducer',
        icon: '💊',
        strength: '500 mg',
        instructions: getSafeInstructions(
          'Paracetamol 500 mg',
          'Paracetamol',
          'Paracetamol'
        )
      },

      {
        id: 'amlodipine-5',
        name: 'Amlodipine 5 mg',
        brand: 'Amlodipine',
        generic: 'Amlodipine Besylate',
        category: 'Cardiovascular / Blood Pressure',
        icon: '❤️',
        strength: '5 mg',
        instructions: getSafeInstructions(
          'Amlodipine 5 mg',
          'Amlodipine',
          'Amlodipine'
        )
      },

      {
        id: 'cetirizine-10',
        name: 'Cetirizine 10 mg',
        brand: 'Cetirizine',
        generic: 'Cetirizine Hydrochloride',
        category: 'Antihistamine / Allergy Relief',
        icon: '🌿',
        strength: '10 mg',
        instructions: getSafeInstructions(
          'Cetirizine 10 mg',
          'Cetirizine',
          'Cetirizine'
        )
      },

      {
        id: 'pantoprazole-40',
        name: 'Pantoprazole 40 mg',
        brand: 'Pantoprazole',
        generic: 'Pantoprazole Sodium Gastro-resistant',
        category: 'Proton Pump Inhibitor / Acidity Relief',
        icon: '🟡',
        strength: '40 mg',
        instructions: getSafeInstructions(
          'Pantoprazole 40 mg',
          'Pantoprazole',
          'Pantoprazole'
        )
      },

      {
        id: 'metformin-500',
        name: 'Metformin 500 mg',
        brand: 'Metformin',
        generic: 'Metformin Hydrochloride',
        category: 'Anti-Diabetic / Blood Sugar Control',
        icon: '🔵',
        strength: '500 mg',
        instructions: getSafeInstructions(
          'Metformin 500 mg',
          'Metformin',
          'Metformin'
        )
      },

      {
        id: 'amoxicillin-500',
        name: 'Amoxicillin 500 mg',
        brand: 'Amoxicillin',
        generic: 'Amoxicillin Trihydrate',
        category: 'Antibiotic / Bacterial Infection Treatment',
        icon: '💉',
        strength: '500 mg',
        instructions: getSafeInstructions(
          'Amoxicillin 500 mg',
          'Amoxicillin',
          'Amoxicillin'
        )
      }

    ];
  }


  /**
   * Get a preset medicine by its ID
   */
  function getPresetById(id) {
    const list = getPresetMedicines();

    return list.find(
      medicine => medicine.id === id
    ) || null;
  }


  // Public API
  return {
    getRecentlyViewed,
    addRecentlyViewed,
    clearRecentlyViewed,
    getPresetMedicines,
    getPresetById
  };

})();


// Browser export
if (typeof window !== 'undefined') {
  window.MedicineData = MedicineData;
}


// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MedicineData;
}
