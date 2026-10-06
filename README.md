# DoseSpeak 💊🔊

> **Accessibility-first healthcare assistant that helps elderly patients easily scan, understand, and hear medicine instructions in their preferred language.**

DoseSpeak is an AI-assisted medicine instruction web application designed to make medicine information easier to understand for elderly and multilingual users.

---

## 🌟 Key Features

### 1. Multi-Language Voice Support

DoseSpeak supports:

- English
- Tamil
- Hindi
- Telugu
- Kannada
- Malayalam

Users can select their preferred language and listen to medicine instructions using browser-based Text-to-Speech.

### 2. Medicine Search

- Search medicines by brand or generic name.
- Live autocomplete while typing.
- Uses the DrugDB medicine search API.
- Includes loading, no-result and error handling.
- Uses debouncing and request cancellation to avoid unnecessary API requests.
- Cached results help improve repeated searches.

### 3. Medicine Scanner & OCR

DoseSpeak uses **Tesseract.js** for Optical Character Recognition.

The OCR workflow is:

**Medicine strip image → Tesseract.js → Extracted text → Confidence check → Medicine matching → Medicine information**

The current prototype uses a **30% OCR confidence threshold**. Low-confidence results are not treated as confirmed medicine identification.

OCR accuracy can vary depending on image quality, lighting, glare, camera angle, curved packaging and text visibility.

### 4. Accessibility Features

- High Contrast Mode
- Large Text / Enhanced Readability Mode
- Simplified Language / Easy Explanation Mode
- Keyboard and screen-reader friendly interface
- Voice-first interaction

### 5. Medicine Information

The application presents structured medicine information such as:

- Medicine name
- Usage information
- Dosage-related instructions available in the verified data
- Before/after food instructions
- Missed-dose guidance
- Safety precautions

DoseSpeak does not replace a doctor or pharmacist.

### 6. Additional Support

- Healthcare assistance
- Location support using Google Maps
- Recent medicine/history support
- Emergency/help information

---

## 🔍 OCR Implementation

The scanner uses **Tesseract.js** to process uploaded medicine-strip images.

The OCR process:

1. User uploads or captures a medicine image.
2. Tesseract.js processes the image.
3. Text is extracted from the medicine strip.
4. OCR confidence is checked.
5. The extracted text is matched with available medicine information.
6. The matched medicine information is displayed to the user.

The current prototype does **not** claim perfect OCR accuracy.

### OCR Pre-processing

The current implementation does not use dedicated grayscale,
adaptive thresholding or advanced glare-removal preprocessing.

This is a planned improvement because medicine packaging can contain:

- Reflections
- Curved surfaces
- Small text
- Low contrast
- Uneven lighting

Future versions can introduce image cropping, grayscale conversion,
adaptive thresholding and glare reduction to improve OCR performance.

---

## 🌐 Medicine Search Implementation

DoseSpeak integrates medicine search functionality using the DrugDB API.

The search system includes:

- Partial-text search
- Live suggestions
- 350 ms debounce
- Request cancellation
- Stale-response protection
- Result caching
- Loading state
- No-result handling
- API error handling
- Fallback medicine data

This improves responsiveness and prevents outdated search responses from replacing newer results.

---

## 🌍 Multilingual Content

DoseSpeak supports six languages:

**English, Tamil, Hindi, Telugu, Kannada and Malayalam.**

The medicine information used by the prototype is based on
**curated language-specific content** rather than unrestricted
AI-generated medical translation.

This is important because automatically generating or translating
dosage information without verification could change the medical
meaning of an instruction.

The selected language is applied to the medicine information and
voice output supported by the application.

Future versions can use professionally reviewed multilingual
medical datasets or verified translation services.

---

## 🔊 Text-to-Speech

DoseSpeak uses the browser's **Web Speech API** to read medicine
instructions aloud.

The user can:

1. Select a language.
2. View the corresponding medicine information.
3. Press the listen button.
4. Hear the instructions using the available browser voice.

Voice availability may vary depending on the user's browser and device.

---

## 🛡️ Responsible AI & Safety

DoseSpeak is an accessibility and medicine-information assistant,
not a diagnostic or prescription system.

The application:

- Does not diagnose diseases.
- Does not prescribe medicines.
- Does not generate personalized dosage instructions.
- Does not modify a doctor's prescription.
- Does not treat low-confidence OCR as confirmed identification.
- Uses defined medicine information instead of unrestricted
  AI-generated dosage instructions.
- Encourages users to confirm important medical information with
  a qualified doctor or pharmacist.

OCR results may be affected by image quality and packaging conditions.

---

## 🧪 Testing

The prototype has been tested across the major user flows:

| Feature | Status |
|---|---|
| Medicine search | Tested |
| Live autocomplete | Tested |
| Medicine selection | Tested |
| Image upload | Tested |
| OCR processing | Tested |
| OCR confidence handling | Tested |
| Language switching | Tested |
| Text-to-Speech | Tested |
| Accessibility features | Tested |
| Medicine history | Tested |
| Location support | Tested |

### OCR Testing

OCR performance depends on image quality, lighting, glare,
camera angle and text visibility.

A larger labelled dataset of medicine-strip images is required
for formal OCR accuracy benchmarking.

---

## 🏗️ System Architecture

```text
                    DoseSpeak
                        |
             +----------+----------+
             |                     |
       Medicine Search        Image Upload
             |                     |
          DrugDB API           Tesseract.js
             |                     |
             +----------+----------+
                        |
                 Medicine Matching
                        |
                Medicine Information
                        |
                Language Selection
                        |
              Curated Multilingual
                    Content
                        |
                 Web Speech API
                        |
                     User
