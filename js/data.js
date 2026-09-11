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
   * Save a medicine to recently viewed history (max 8 entries, deduplicated)
   */
  function addRecentlyViewed(medicine) {
    if (!medicine || !medicine.name) return;
    try {
      let recent = getRecentlyViewed();
      // Filter out existing duplicate
      recent = recent.filter(m => m.id !== medicine.id && m.name !== medicine.name);
      // Prepend the new one
      recent.unshift({
        id: medicine.id,
        name: medicine.name,
        brand: medicine.brand || '',
        category: medicine.category || '',
        icon: medicine.icon || '💊',
        viewedAt: new Date().toISOString()
      });
      // Limit to 8
      if (recent.length > 8) {
        recent = recent.slice(0, 8);
      }
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
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
   * Helper to generate instructions safely
   */
  function getSafeInstructions(name, generic, brand) {
    if (typeof DrugDB !== 'undefined' && DrugDB.buildFactualInstructions) {
      return DrugDB.buildFactualInstructions(name, generic, brand);
    }
    return {
      en: {
        medicine: name,
        category: 'Prescription Medicine',
        when: 'Follow the specific schedule given by your doctor or pharmacist.',
        food: 'Take as directed on packaging with water.',
        notes: 'Do not exceed the recommended dose. Consult your doctor if symptoms persist.',
        important: 'Keep out of reach of children. Store in a cool, dry place.'
      },
      ta: {
        medicine: name,
        category: 'மருந்து தகவல்',
        when: 'உங்கள் மருத்துவர் அல்லது மருந்தாளுநர் கூறிய நேரத்தைப் பின்பற்றவும்.',
        food: 'உணவுடனும் அல்லது இல்லாமலும் ஒரு டம்ளர் தண்ணீருடன் எடுக்கலாம்.',
        notes: 'பரிந்துரைக்கப்பட்ட அளவை மீறாதீர்கள். 3 நாட்களுக்கு மேல் தொந்தரவு தொடர்ந்தால் மருத்துவரை அணுகவும்.',
        important: 'குழந்தைகள் கையெட்டாத இடத்தில் வைக்கவும். குளிர்ந்த இடத்தில் சேமிக்கவும்.'
      },
      hi: {
        medicine: name,
        category: 'दवा की जानकारी',
        when: 'डॉक्टर या फार्मासिस्ट द्वारा बताए गए समय का पालन करें।',
        food: 'पानी के साथ भोजन के बाद या पहले लें।',
        notes: 'निर्धारित खुराक से अधिक न लें।',
        important: 'बच्चों की पहुंच से दूर रखें।'
      },
      te: {
        medicine: name,
        category: 'మందుల సమాచారం',
        when: 'డాక్టర్ సూచించిన సమయాన్ని అనుసరించండి.',
        food: 'నీటితో ఆహారంతో లేదా లేకుండా తీసుకోవచ్చు.',
        notes: 'సిఫారసు చేసిన మోతాదు మించకండి.',
        important: 'పిల్లలకు దూరంగా ఉంచండి.'
      },
      kn: {
        medicine: name,
        category: 'ಔಷಧ ಮಾಹಿತಿ',
        when: 'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಸಮಯವನ್ನು ಅನುಸರಿಸಿ.',
        food: 'ಆಹಾರದೊಂದಿಗೆ ಅಥವಾ ಇಲ್ಲದೆ ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
        notes: 'ನಿಗದಿತ ಪ್ರಮಾಣ ಮೀರಬೇಡಿ.',
        important: 'ಮಕ್ಕಳ ಕೈಗೆ ಸಿಗದಂತೆ ಇರಿಸಿ.'
      },
      ml: {
        medicine: name,
        category: 'മരുന്ന് വിവരങ്ങൾ',
        when: 'ഡോക്ടർ നിർദ്ദേശിച്ച സമയം പാലിക്കുക.',
        food: 'ഭക്ഷണത്തോടൊപ്പം അല്ലെങ്കിൽ കൂടാതെ വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
        notes: 'ശുപാർശ ചെയ്ത ഡോസ് കവിയരുത്.',
        important: 'കുട്ടികളിൽ നിന്ന് മാറ്റി സൂക്ഷിക്കുക.'
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
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Pain Relief / Fever Reducer',
        icon: '💊',
        strength: '500 mg',
        instructions: getSafeInstructions('Paracetamol 500 mg', 'Paracetamol', 'Paracetamol')
      },
      {
        id: 'amlodipine-5',
        name: 'Amlodipine 5 mg',
        brand: 'Amlodipine',
        generic: 'Amlodipine Besylate',
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Cardiovascular / Blood Pressure',
        icon: '❤️',
        strength: '5 mg',
        instructions: getSafeInstructions('Amlodipine 5 mg', 'Amlodipine', 'Amlodipine')
      },
      {
        id: 'cetirizine-10',
        name: 'Cetirizine 10 mg',
        brand: 'Cetirizine',
        generic: 'Cetirizine Hydrochloride',
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Antihistamine / Allergy Relief',
        icon: '🌿',
        strength: '10 mg',
        instructions: getSafeInstructions('Cetirizine 10 mg', 'Cetirizine', 'Cetirizine')
      },
      {
        id: 'pantoprazole-40',
        name: 'Pantoprazole 40 mg',
        brand: 'Pantoprazole',
        generic: 'Pantoprazole Sodium Gastro-resistant',
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Proton Pump Inhibitor / Acidity Relief',
        icon: '🟡',
        strength: '40 mg',
        instructions: getSafeInstructions('Pantoprazole 40 mg', 'Pantoprazole', 'Pantoprazole')
      },
      {
        id: 'metformin-500',
        name: 'Metformin 500 mg',
        brand: 'Metformin',
        generic: 'Metformin Hydrochloride',
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Anti-Diabetic / Blood Sugar Control',
        icon: '🔵',
        strength: '500 mg',
        instructions: getSafeInstructions('Metformin 500 mg', 'Metformin', 'Metformin')
      },
      {
        id: 'amoxicillin-500',
        name: 'Amoxicillin 500 mg',
        brand: 'Amoxicillin',
        generic: 'Amoxicillin Trihydrate',
        manufacturer: 'Indian Pharmacopoeia (IP)',
        category: 'Antibiotic / Bacterial Infection Treatment',
        icon: '💉',
        strength: '500 mg',
        instructions: getSafeInstructions('Amoxicillin 500 mg', 'Amoxicillin', 'Amoxicillin')
      }
    ];
  }

  function getPresetById(id) {
    const list = getPresetMedicines();
    return list.find(m => m.id === id) || null;
  }

  return {
    getRecentlyViewed,
    addRecentlyViewed,
    clearRecentlyViewed,
    getPresetMedicines,
    getPresetById
  };
})();

if (typeof window !== 'undefined') {
  window.MedicineData = MedicineData;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MedicineData;
}
