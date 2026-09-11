# DoseSpeak 💊🎙️

> **Accessibility-first healthcare assistant that helps elderly patients easily scan, understand, and hear medicine instructions in their preferred language.**

Exact 1:1 replica of the Base44 application with complete local standalone support (zero external server dependencies).

---

## 🌟 Key Features

1. **Multi-Language Voice Support (TTS)**
   - Tamil (`ta-IN`)
   - English (`en-IN`)
   - Hindi (`hi-IN`)
   - Telugu (`te-IN`)
   - Kannada (`kn-IN`)
   - Malayalam (`ml-IN`)

2. **Medicine Scanner & Identifier**
   - Live Camera / Photo Upload with OCR analysis simulation
   - Instant search by medicine brand or generic name
   - Comprehensive offline medicine knowledge base

3. **Accessibility Features**
   - High Contrast Mode
   - Large Text / Enhanced Readability Mode
   - Simplified Language / Easy Explanation Mode
   - Full Keyboard & Screen-reader support

4. **Detailed Dosage & Safety Information**
   - Exact dosage guidelines (morning/afternoon/night)
   - Before/After food instructions
   - Missed dose & emergency precautions
   - Direct emergency helpline & WhatsApp support integration (`+91 90038 11616`)
   - Location integration with Google Maps (Coimbatore, Tamil Nadu)

5. **Recent Scans & History**
   - LocalStorage-backed scan history for instant access

---

## 🚀 How to Run Locally

You can run this project using any static HTTP server:

### Option 1: Using Node.js (npx serve)
```bash
npx serve .
```

### Option 2: Using Python 3
```bash
python3 -m http.server 3000
```

### Option 3: Using VS Code Live Server
Open the folder in VS Code, right-click `index.html`, and select **"Open with Live Server"**.

---

## 🌐 How to Deploy

- **Vercel**: Deploy with one click or run `vercel` in this folder (preconfigured with `vercel.json`).
- **Netlify**: Drag and drop the folder into Netlify Drop or run `netlify deploy` (preconfigured with `netlify.toml` and `_redirects`).
- **GitHub Pages**: Upload to a GitHub repo and enable GitHub Pages under repository settings.
- **Cloudflare Pages**: Connect your Git repository or upload the directory.
