/* ==========================================================================
   OCR Text Recognition Scanner Service for Part Numbers
   Mirroring Android Compose OcrScannerOverlay (Google ML Kit behavior)
   ========================================================================== */

let stream = null;
let videoTrack = null;
let isScanning = false;
let isProcessing = false;
let torchOn = false;
let currentCallback = null;
let tesseractWorker = null;

// Sound effect for successful scan
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {
    // audio context might be restricted
  }
}

// Filter words to find Caterpillar / Industrial Part Number patterns
function extractPartNumbers(rawText) {
  if (!rawText) return [];

  const blacklist = new Set([
    'MADE', 'IN', 'USA', 'PART', 'NO', 'NUMBER', 'CAT', 'CATERPILLAR',
    'QTY', 'PCS', 'PIECE', 'PIECES', 'BOX', 'DATE', 'WEIGHT', 'KG', 'LBS',
    'NET', 'GROSS', 'GENUINE', 'PARTS', 'FOR', 'USE', 'ORIGINAL', 'TRAKINDO'
  ]);

  // Split lines & words
  const rawWords = rawText.split(/[\r\n\s\t,;]+/);
  const candidatesMap = new Map();

  for (const raw of rawWords) {
    // Remove unwanted edge punctuation but keep interior hyphens
    let cleaned = raw.toUpperCase().replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '');
    
    // Ignore short or blacklisted words
    if (cleaned.length < 3 || blacklist.has(cleaned)) continue;

    // Check if alphanumeric
    if (!/^[A-Z0-9-]+$/.test(cleaned)) continue;

    // Calculate score
    let score = 0;

    // Has hyphen like 1R-0716, 215-3211, 6V-9746, 3E-0123
    if (/^[A-Z0-9]{1,4}-[A-Z0-9]{4,8}$/.test(cleaned)) {
      score += 100;
    }
    // Has mixture of letters and numbers like 1R0716, 6V9746, 1042531
    else if (/\d/.test(cleaned) && /[A-Z]/.test(cleaned)) {
      score += 80;
    }
    // Pure numeric of 5-8 digits like 1042531
    else if (/^\d{5,8}$/.test(cleaned)) {
      score += 60;
    } else {
      score += 30;
    }

    if (!candidatesMap.has(cleaned) || candidatesMap.get(cleaned) < score) {
      candidatesMap.set(cleaned, score);
    }
  }

  // Sort descending by score, then length
  return Array.from(candidatesMap.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(entry => entry[0]);
}

export const OcrService = {
  init() {
    this.modalEl = document.getElementById('ocr-scanner-modal');
    this.videoEl = document.getElementById('ocr-video');
    this.canvasEl = document.getElementById('ocr-canvas');
    this.targetBoxEl = document.querySelector('.ocr-target-box');
    this.statusLabel = document.getElementById('ocr-status-label');
    this.statusDot = document.querySelector('.ocr-status-dot');
    this.captureBtn = document.getElementById('btn-ocr-capture');
    this.closeBtn = document.getElementById('btn-close-ocr');
    this.torchBtn = document.getElementById('btn-toggle-torch');
    this.bestCard = document.getElementById('ocr-best-candidate-card');
    this.bestVal = document.getElementById('ocr-best-value');
    this.candidatesContainer = document.getElementById('ocr-candidates-container');
    this.candidatesChips = document.getElementById('ocr-candidates-chips');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.stop());
    }

    if (this.captureBtn) {
      this.captureBtn.addEventListener('click', () => this.captureAndRecognize());
    }

    if (this.torchBtn) {
      this.torchBtn.addEventListener('click', () => this.toggleTorch());
    }

    if (this.bestCard) {
      this.bestCard.addEventListener('click', () => {
        const text = this.bestVal ? this.bestVal.textContent.trim() : '';
        if (text) this.selectCandidate(text);
      });
    }
  },

  async start(onSelectCallback) {
    currentCallback = onSelectCallback;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Browser Anda tidak mendukung akses kamera langsung.");
      return;
    }

    if (!this.modalEl) this.init();

    this.modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.resetResults();
    this.updateStatus("Arahkan kotak kuning ke stiker teks part", false);

    try {
      isScanning = true;
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (this.videoEl) {
        this.videoEl.srcObject = stream;
        await this.videoEl.play();
      }

      // Check flashlight / torch capability
      videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && this.torchBtn) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          this.torchBtn.style.display = 'flex';
        } else {
          this.torchBtn.style.display = 'none';
        }
      }

      // Preload / Warmup Tesseract in the background
      this.preloadEngine();

    } catch (err) {
      console.error("Camera access error:", err);
      this.stop();
      alert("Tidak dapat mengakses kamera: " + (err.message || "Izin kamera ditolak. Harap izinkan akses kamera di browser."));
    }
  },

  async preloadEngine() {
    if (window.Tesseract && !tesseractWorker) {
      try {
        // Tesseract is ready
      } catch (e) {
        console.warn("Tesseract preload notice:", e);
      }
    }
  },

  async captureAndRecognize() {
    if (!isScanning || isProcessing || !this.videoEl) return;

    if (!window.Tesseract) {
      alert("Modul OCR Tesseract belum selesai dimuat. Tunggu sebentar dan coba lagi.");
      return;
    }

    isProcessing = true;
    this.updateStatus("Memproses gambar...", true);
    if (this.captureBtn) {
      this.captureBtn.disabled = true;
      this.captureBtn.classList.add('loading');
    }

    try {
      // 1. Calculate Crop Area based on .ocr-target-box in viewport
      const video = this.videoEl;
      const targetBox = this.targetBoxEl || { getBoundingClientRect: () => ({ left: 20, top: 150, width: 300, height: 120 }) };
      const videoRect = video.getBoundingClientRect();
      const boxRect = targetBox.getBoundingClientRect();

      // Video native resolution
      const videoW = video.videoWidth || 1280;
      const videoH = video.videoHeight || 720;

      // Scale factors (account for object-fit: cover)
      const scaleX = videoW / videoRect.width;
      const scaleY = videoH / videoRect.height;
      const scale = Math.max(scaleX, scaleY);

      const displayedVideoW = videoW / scale;
      const displayedVideoH = videoH / scale;
      const offsetX = (videoRect.width - displayedVideoW) / 2;
      const offsetY = (videoRect.height - displayedVideoH) / 2;

      // Crop coordinates in video pixel space
      const cropX = Math.max(0, (boxRect.left - videoRect.left - offsetX) * scale);
      const cropY = Math.max(0, (boxRect.top - videoRect.top - offsetY) * scale);
      const cropW = Math.min(videoW - cropX, boxRect.width * scale);
      const cropH = Math.min(videoH - cropY, boxRect.height * scale);

      // 2. Draw cropped area to canvas
      const canvas = this.canvasEl || document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // 3. Image enhancement (Grayscale + High Contrast Thresholding for text readability)
      try {
        const imgData = ctx.getImageData(0, 0, cropW, cropH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Standard luminance
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Simple binarize threshold
          const val = gray > 130 ? 255 : (gray < 70 ? 0 : gray);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (imgErr) {
        console.warn("Canvas filter fallback:", imgErr);
      }

      this.updateStatus("Mengenali teks via OCR...", true);

      // 4. Run Tesseract Recognition
      const result = await window.Tesseract.recognize(canvas, 'eng', {
        logger: (m) => {
          if (m && m.status === 'recognizing text' && m.progress) {
            this.updateStatus(`Mengenali teks (${Math.round(m.progress * 100)}%)...`, true);
          }
        }
      });

      const recognizedText = result && result.data ? result.data.text : '';
      const candidates = extractPartNumbers(recognizedText);

      if (candidates.length > 0) {
        if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        playBeep();

        this.renderCandidates(candidates);
        this.updateStatus(`Ditemukan ${candidates.length} kandidat teks part. Ketuk untuk memilih.`, false);
      } else {
        this.updateStatus("Tidak terdeteksi kode part. Dekatkan stiker ke kotak kuning & pindai lagi.", false);
      }

    } catch (err) {
      console.error("OCR execution error:", err);
      this.updateStatus("Gagal membaca teks: " + (err.message || "Error OCR"), false);
    } finally {
      isProcessing = false;
      if (this.captureBtn) {
        this.captureBtn.disabled = false;
        this.captureBtn.classList.remove('loading');
      }
    }
  },

  renderCandidates(candidates) {
    if (!candidates || candidates.length === 0) {
      this.resetResults();
      return;
    }

    const best = candidates[0];
    if (this.bestCard && this.bestVal) {
      this.bestVal.textContent = best;
      this.bestCard.style.display = 'flex';
    }

    if (this.candidatesContainer && this.candidatesChips) {
      this.candidatesChips.innerHTML = '';
      
      const others = candidates.filter(c => c !== best);
      if (others.length > 0) {
        others.forEach(cand => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'ocr-candidate-chip';
          chip.textContent = cand;
          chip.addEventListener('click', () => this.selectCandidate(cand));
          this.candidatesChips.appendChild(chip);
        });
        this.candidatesContainer.style.display = 'block';
      } else {
        this.candidatesContainer.style.display = 'none';
      }
    }
  },

  selectCandidate(text) {
    const clean = text.trim();
    if (!clean) return;

    if (navigator.vibrate) navigator.vibrate(50);
    playBeep();

    const cb = currentCallback;
    this.stop();

    if (cb) {
      setTimeout(() => cb(clean), 150);
    }
  },

  resetResults() {
    if (this.bestCard) this.bestCard.style.display = 'none';
    if (this.candidatesContainer) this.candidatesContainer.style.display = 'none';
    if (this.candidatesChips) this.candidatesChips.innerHTML = '';
  },

  updateStatus(text, isLoading) {
    if (this.statusLabel) this.statusLabel.textContent = text;
    if (this.statusDot) {
      if (isLoading) {
        this.statusDot.classList.add('loading');
      } else {
        this.statusDot.classList.remove('loading');
      }
    }
  },

  async toggleTorch() {
    if (!videoTrack) return;
    try {
      torchOn = !torchOn;
      await videoTrack.applyConstraints({
        advanced: [{ torch: torchOn }]
      });
      if (this.torchBtn) {
        this.torchBtn.classList.toggle('active', torchOn);
      }
    } catch (e) {
      console.warn("Torch toggle not supported:", e);
    }
  },

  stop() {
    isScanning = false;
    isProcessing = false;
    currentCallback = null;

    if (torchOn && videoTrack) {
      try {
        videoTrack.applyConstraints({ advanced: [{ torch: false }] });
      } catch (e) {}
      torchOn = false;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    videoTrack = null;

    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }

    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }

    document.body.style.overflow = '';
  }
};
