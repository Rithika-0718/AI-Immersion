# DoseSpeak 💊🔊

> **Accessibility-first healthcare assistant that helps elderly patients scan, understand, and hear medicine instructions in their preferred language.**

DoseSpeak is an **AI-assisted medicine-information web application** designed to make medicine information easier to understand and access for elderly and multilingual users.

The application combines **medicine search, Tesseract.js OCR, OCR confidence checking, medicine matching, multilingual content, accessibility features, and browser-based Text-to-Speech** in a single interface.

---

## 🏥 Field Observation & User Evidence

To understand the real-world communication problem before developing DoseSpeak, a field observation was conducted at **Sasi Kala Hospital**.

The observation included interactions with **3–4 elderly patients**, along with discussions with a **doctor and nurses**.

The elderly patients explained that handwritten prescriptions can be difficult to understand. They also highlighted difficulties when medicine names or instructions are provided in **English or another language they are not comfortable with**.

The nurses confirmed this communication challenge from their experience with patients. They explained that elderly patients may return repeatedly to clarify medicine instructions, while doctors may not always be available and nurses are often available to provide clarification.

The elderly patients responded positively to the idea of:

- Preferred-language medicine information
- Structured medicine instructions
- Voice-based instructions
- Medicine search
- Medicine-strip scanning

These observations helped define the core problem addressed by DoseSpeak.

### Root Cause

The field observation indicated that the problem is not simply remembering medicines. It also involves **understanding, identifying and accessing medicine instructions in a language and format that is comfortable for the patient**.

Key barriers identified were:

- Difficult-to-read handwritten prescriptions
- Limited understanding of English or unfamiliar prescription language
- Medicine instructions not consistently communicated in the patient's preferred language
- Repeated dependence on doctors or nurses for clarification
- Difficulty independently accessing structured medicine information

---

## 💡 Problem → Solution

DoseSpeak was designed around the communication barriers identified during the field observation.

| Observed Need | DoseSpeak Response |
|---|---|
| Difficulty understanding written medicine information | Structured medicine information |
| Difficulty identifying medicine from packaging | Tesseract.js-based OCR |
| Language barrier | Six-language support |
| Need to hear instructions repeatedly | Browser-based Text-to-Speech |
| Need to find medicine information | Live medicine search |
| Uncertainty from poor OCR | Confidence checking + retry/manual search |

The goal of DoseSpeak is **not to replace healthcare professionals**, but to make medicine information easier to access, understand and hear.

---

# 🌟 Key Features

## 1. 🌍 Multi-Language Support

DoseSpeak supports six languages:

- 🇬🇧 English
- 🇮🇳 Tamil
- 🇮🇳 Hindi
- 🇮🇳 Telugu
- 🇮🇳 Kannada
- 🇮🇳 Malayalam

Users can select their preferred language and view supported medicine information and hear instructions through browser-based Text-to-Speech.

---

## 2. 🔎 Medicine Search

DoseSpeak provides medicine search functionality using the **DrugDB medicine search API**.

Features include:

- Search by brand or generic name
- Partial-text live autocomplete
- Loading state
- No-result handling
- API error handling
- 350 ms search debounce
- Request cancellation
- Stale-response protection
- Result caching
- Fallback medicine data

The search system is designed to remain responsive while the user types and to prevent outdated responses from replacing newer results.

---

## 3. 📷 Medicine Scanner & OCR

DoseSpeak uses **Tesseract.js** for Optical Character Recognition.

The OCR workflow is:

**Medicine strip image → Tesseract.js OCR → Extracted text → Confidence check → Medicine matching → Medicine information**

The current prototype uses a **30% OCR confidence threshold**.

Low-confidence OCR results are **not treated as confirmed medicine identification**.

OCR performance can vary depending on:

- Image quality
- Lighting
- Glare
- Camera angle
- Curved packaging
- Text visibility
- Text size and contrast

---

## 4. ♿ Accessibility Features

DoseSpeak follows an accessibility-first design approach.

Available features include:

- High Contrast Mode
- Large Text / Enhanced Readability
- Simplified / Easy Explanation Mode
- Keyboard-friendly interaction
- Voice-based medicine instructions

The interface is designed to reduce visual and language barriers for elderly users.

---

## 5. 💊 Structured Medicine Information

DoseSpeak presents available medicine information in a structured format, including information such as:

- Medicine name
- Usage information
- Medicine instructions available in the application data
- Food-related instructions where available
- Safety information where available

DoseSpeak does **not calculate personalized dosage** and does not replace a doctor or pharmacist.

---

## 6. 📍 Additional Support

The prototype also includes:

- Recent medicine/history support
- Google Maps location support
- Help/healthcare support information

---

# 🔍 OCR Implementation

The scanner uses **Tesseract.js** to process uploaded medicine-strip images.

## OCR Process

1. User uploads or captures a medicine image.
2. Tesseract.js processes the image.
3. Text is extracted from the medicine strip.
4. OCR confidence is checked.
5. Extracted text is matched with available medicine information.
6. Matching medicine information is displayed.

## OCR Safety Flow

```text
                    Image Upload
                         │
                         ↓
                    Tesseract.js
                         │
                         ↓
                   Extracted Text
                         │
                         ↓
                  Confidence Check
                         │
                 ┌───────┴───────┐
                 │               │
            Valid Result     Low Confidence /
                 │              No Match
                 ↓               │
        Medicine Matching        ↓
                 │          Retry Scan /
                 ↓          Manual Search
        Medicine Information      │
                 │                │
                 └───────←────────┘
                         │
                         ↓
                 Language Selection
                         │
                         ↓
                    Voice Output
                         │
                         ↓
                       User
```

If OCR confidence is low or a medicine cannot be matched reliably, DoseSpeak does not present the result as confirmed identification.

The user can retry the scan or use manual medicine search.

---

## OCR Pre-processing

The current implementation does **not** use dedicated:

- Grayscale conversion
- Adaptive thresholding
- Advanced glare-removal preprocessing

This is a planned improvement because medicine packaging can contain reflections, curved surfaces, small text, low contrast and uneven lighting.

Future versions can introduce:

- Image cropping
- Grayscale conversion
- Adaptive thresholding
- Glare reduction
- Improved image preprocessing

---

# 🌐 Medicine Search Implementation

DoseSpeak integrates medicine search using the **DrugDB API**.

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

### Search Flow

```text
User types medicine name
          ↓
     350 ms debounce
          ↓
       DrugDB API
          ↓
   Search result received
          ↓
 Medicine information
          ↓
 Display in selected language
```

Request cancellation and stale-response protection help prevent outdated search results from replacing newer results.

---

# 🤖 AI & Technical Approach

DoseSpeak combines AI-assisted development with specific intelligent/technical components in the application.

## Tesseract.js OCR

**Optical Character Recognition (OCR)** is used to extract text from uploaded medicine-strip images.

## OCR Confidence Checking

The OCR result includes a confidence value. DoseSpeak uses a **30% confidence threshold** so that weak OCR output is not automatically treated as confirmed medicine identification.

## Medicine Matching

Extracted medicine-related text is matched against available medicine information and medicine-search results.

## Multilingual Text-to-Speech

The selected language is passed to the browser's **Web Speech API**, allowing medicine instructions to be read aloud when a suitable voice is available.

### Important AI Boundary

DoseSpeak does **not** use unrestricted generative AI to create personalized dosage instructions.

The system is designed to assist with **identification, information access, language accessibility and voice output**, while medical decisions remain with qualified healthcare professionals.

---

# 🌍 Multilingual Content

DoseSpeak supports:

**English, Tamil, Hindi, Telugu, Kannada and Malayalam.**

The prototype uses **curated language-specific medicine content** rather than unrestricted AI-generated medical translation.

This is important because automatically generating or translating dosage information without verification could change the meaning of a medical instruction.

The selected language is applied to supported medicine information and voice output.

Future versions can use professionally reviewed multilingual medical datasets or verified medical translation services.

---

# 🔊 Text-to-Speech

DoseSpeak uses the browser's **Web Speech API** to read medicine instructions aloud.

The user can:

1. Select a preferred language.
2. View the corresponding medicine information.
3. Press the listen button.
4. Hear the instructions using the available browser voice.

Voice availability may vary depending on the user's browser and device.

---

# 🛡️ Responsible AI & Safety

DoseSpeak is an **accessibility and medicine-information assistant**, not a diagnostic or prescription system.

The application:

- Does not diagnose diseases.
- Does not prescribe medicines.
- Does not generate personalized dosage instructions.
- Does not modify a doctor's prescription.
- Does not treat low-confidence OCR as confirmed identification.
- Uses defined medicine information rather than unrestricted AI-generated dosage instructions.
- Provides a retry/manual-search path when OCR cannot confidently identify a medicine.
- Encourages users to confirm important medical information with a qualified doctor or pharmacist.

### Safety Boundary

```text
User
 ↓
Scan / Search
 ↓
OCR / Medicine Search
 ↓
Confidence & Matching Check
 ↓
Medicine Information
 ↓
Preferred Language
 ↓
Text-to-Speech
 ↓
User Understanding
```

**DoseSpeak assists with access and understanding. It does not replace professional medical advice.**

---

# 🧪 Testing & Evidence

The prototype has been tested across the major user flows:

| Feature | Status |
|---|---|
| Medicine search | Tested |
| Partial/live autocomplete | Tested |
| Medicine selection | Tested |
| Image upload | Tested |
| OCR processing | Tested |
| OCR confidence handling | Tested |
| Language switching | Tested |
| Text-to-Speech | Tested |
| Accessibility features | Tested |
| Medicine history | Tested |
| Location support | Tested |

## Verified Project Numbers

| Metric | Value |
|---|---:|
| Elderly patients involved in field observation | **3–4** |
| Supported languages | **6** |
| OCR confidence threshold | **30%** |
| Search debounce | **350 ms** |

These numbers describe the current prototype and field observation. They are **not presented as medical accuracy or patient-outcome statistics**.

### OCR Testing Limitation

OCR performance depends on image quality, lighting, glare, camera angle and text visibility.

A larger labelled dataset of medicine-strip images would be required for formal OCR accuracy benchmarking.

---

# 🏗️ System Architecture

```text
                         DOSESPEAK
                            │
              ┌─────────────┴─────────────┐
              │                           │
        Medicine Search              Image Upload
              │                           │
          DrugDB API                 Tesseract.js
              │                           │
              │                     Extracted Text
              │                           │
              └─────────────┬─────────────┘
                            ↓
                    Medicine Matching
                            ↓
                  Confidence / Safety
                       Validation
                            │
                  ┌─────────┴─────────┐
                  │                   │
             Valid Match        Low Confidence /
                  │               No Match
                  ↓                   │
        Medicine Information          ↓
                  │             Retry Scan /
                  │             Manual Search
                  │                   │
                  └───────────←───────┘
                            ↓
                  Language Selection
                            ↓
                Curated Multilingual
                      Content
                            ↓
                  Web Speech API
                            ↓
                    Elderly User
```

### Architecture Logic

The system follows an accessibility-first flow:

**Input → Identify → Validate → Explain → Select Language → Speak**

The validation stage is important because OCR output from medicine packaging can be affected by image quality and other environmental factors.

---

# 🧠 Development Approach

DoseSpeak was developed iteratively, starting from rapid prototyping and progressing toward a functional implementation.

The development focused on:

1. Understanding the real-world problem through field observation.
2. Designing an elderly-friendly interface.
3. Building medicine search functionality.
4. Integrating medicine-strip OCR.
5. Adding OCR confidence handling.
6. Implementing multilingual content.
7. Adding browser-based voice assistance.
8. Adding accessibility controls.
9. Testing the major user flows.
10. Documenting safety boundaries and limitations.

---

# 🤖 AI Tools Used During Development

The project was developed with assistance from the following AI-enabled tools:

| Tool | Usage |
|---|---|
| **ChatGPT** | Problem exploration, feature planning, technical guidance, debugging support, documentation and README preparation |
| **Base44** | Initial DoseSpeak web application generation and rapid prototyping |
| **Antigravity** | Website development, code generation/refinement and implementation support |

AI tools were used as **development assistants**. Generated suggestions and code were reviewed and tested before being incorporated into the project.

The final implementation, feature behavior and safety boundaries were checked against the actual project requirements.

---

# 🚀 Future Improvements

Potential future improvements include:

- Image cropping before OCR
- Grayscale and adaptive-threshold preprocessing
- Glare reduction
- Larger labelled OCR test dataset
- Professionally reviewed multilingual medical content
- Additional medicine coverage
- Improved offline support
- More accessibility testing with elderly users
- Usability testing with a larger participant group

---

# 🌐 Live Prototype

**DoseSpeak:**  
https://stereotyped-clear-care-voice.base44.app/

---

# 📌 Disclaimer

DoseSpeak is an **educational/prototype accessibility project**.

It is intended to help users access and understand medicine information more easily. It should not be used as a replacement for a doctor's prescription, pharmacist guidance or professional medical advice.

Users should verify important medicine-related information with a qualified healthcare professional.

---

# 👩‍💻 Project Information

**Project:** DoseSpeak — AI Immersion Project

**Student:** Rithika S  
**Department:** Artificial Intelligence and Machine Learning  
**Year:** Second Year  
**Institution:** Rathinam Technical Campus

---

## 📄 License

This project is released under the **MIT License**.
