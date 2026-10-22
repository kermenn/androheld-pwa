/* ==========================================================================
   Continuous Real-Time Auto-Scan OCR Service (AndroHeld High-Tech Text Recognition)
   Fully automated hands-free text recognition for Part Numbers, HU, and OD Numbers
   ========================================================================== */

let stream = null;
let videoTrack = null;
let isScanning = false;
let isProcessing = false;
let isTargetLocked = false;
let torchOn = false;
let currentCallback = null;
let autoScanTimer = null;
let autoConfirmTimer = null;

// Sound effect for successful scan
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2100, ctx.currentTime);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // audio context might be restricted
  }
}

// Filter words to find Caterpillar / Industrial Part, HU, and OD Number patterns
function extractPartNumbers(rawText) {
  if (!rawText) return [];

  const blacklist = new Set([
    'MADE', 'IN', 'USA', 'PART', 'NO', 'NUMBER', 'CAT', 'CATERPILLAR',
    'QTY', 'PCS', 'PIECE', 'PIECES', 'BOX', 'DATE', 'WEIGHT', 'KG', 'LBS',
    'NET', 'GROSS', 'GENUINE', 'PARTS', 'FOR', 'USE', 'ORIGINAL', 'TRAKINDO',
    'ITEM', 'DESC', 'ORDER', 'MATERIAL', 'GROUP', 'NAME', 'TOTAL'
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

    let score = 0;

    // 1. Hyphenated Part / Location: 1R-0716, 215-3211, 6V-9746, 3E-0123, RAK-A1
    if (/^[A-Z0-9]{1,5}-[A-Z0-9]{2,8}$/.test(cleaned)) {
      score += 120;
    }
    // 2. Alphanumeric mixture: 1R0716, 6V9746, HU10245, 1P4567
    else if (/\d/.test(cleaned) && /[A-Z]/.test(cleaned)) {
      score += 100;
    }
    // 3. SAP HU number or OD number (6-18 digits): 1042531, 1002345678, 4000123456
    else if (/^\d{6,18}$/.test(cleaned)) {
      score += 90;
    }
    // 4. Pure numeric 4-5 digits
    else if (/^\d{4,5}$/.test(cleaned)) {
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
      this.captureBtn.addEventListener('click', () => this.runScan(true));
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

    isTargetLocked = false;
    isProcessing = false;
    this.resetResults();
    this.setTargetLockedVisual(false);
    this.updateStatus("Memulai kamera...", true);

    try {
      isScanning = true;
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
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

      this.updateStatus("Arahkan kotak kuning ke label (Pemindaian Otomatis Aktif)...", false);

      // Start continuous auto-scanning loop after video starts playing
      this.scheduleNextScan(500);

    } catch (err) {
      console.error("Camera access error:", err);
      this.stop();
      alert("Tidak dapat mengakses kamera: " + (err.message || "Izin kamera ditolak. Harap izinkan akses kamera di browser."));
    }
  },

  scheduleNextScan(delayMs = 600) {
    clearTimeout(autoScanTimer);
    if (!isScanning || isTargetLocked) return;

    autoScanTimer = setTimeout(() => {
      if (isScanning && !isTargetLocked && !isProcessing) {
        this.runScan(false);
      }
    }, delayMs);
  },

  async runScan(isManual = false) {
    if (!isScanning || isProcessing || isTargetLocked || !this.videoEl) return;

    if (!window.Tesseract) {
      if (isManual) alert("Modul OCR Tesseract belum siap. Tunggu sebentar...");
      this.scheduleNextScan(1000);
      return;
    }

    isProcessing = true;
    if (isManual) {
      this.updateStatus("Memproses teks...", true);
      if (this.captureBtn) this.captureBtn.classList.add('loading');
    }

    try {
      const video = this.videoEl;
      if (video.readyState < 2) {
        isProcessing = false;
        this.scheduleNextScan(400);
        return;
      }

      const targetBox = this.targetBoxEl || { getBoundingClientRect: () => ({ left: 20, top: 150, width: 300, height: 120 }) };
      const videoRect = video.getBoundingClientRect();
      const boxRect = targetBox.getBoundingClientRect();

      const videoW = video.videoWidth || 1280;
      const videoH = video.videoHeight || 720;

      const scaleX = videoW / videoRect.width;
      const scaleY = videoH / videoRect.height;
      const scale = Math.max(scaleX, scaleY);

      const displayedVideoW = videoW / scale;
      const displayedVideoH = videoH / scale;
      const offsetX = (videoRect.width - displayedVideoW) / 2;
      const offsetY = (videoRect.height - displayedVideoH) / 2;

      const cropX = Math.max(0, (boxRect.left - videoRect.left - offsetX) * scale);
      const cropY = Math.max(0, (boxRect.top - videoRect.top - offsetY) * scale);
      const cropW = Math.min(videoW - cropX, boxRect.width * scale);
      const cropH = Math.min(videoH - cropY, boxRect.height * scale);

      // Fast in-memory canvas (max 480px width for near-instant OCR inference)
      const targetCanvasW = Math.min(480, Math.round(cropW));
      const targetCanvasH = Math.round((targetCanvasW / cropW) * cropH);

      const canvas = this.canvasEl || document.createElement('canvas');
      canvas.width = targetCanvasW;
      canvas.height = targetCanvasH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetCanvasW, targetCanvasH);

      // Contrast enhancement: convert to sharp grayscale threshold
      try {
        const imgData = ctx.getImageData(0, 0, targetCanvasW, targetCanvasH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = gray > 130 ? 255 : (gray < 75 ? 0 : gray);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {}

      // Fast OCR recognition
      const result = await window.Tesseract.recognize(canvas, 'eng');
      const text = result && result.data ? result.data.text : '';
      const candidates = extractPartNumbers(text);

      if (candidates.length > 0 && isScanning && !isTargetLocked) {
        // LOCK TARGET!
        isTargetLocked = true;
        clearTimeout(autoScanTimer);

        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        playBeep();

        const best = candidates[0];
        this.setTargetLockedVisual(true);
        this.renderCandidates(candidates);
        this.updateStatus(`✓ Terdeteksi: ${best} (Memilih otomatis...)`, false);

        // Auto-confirm after 650ms for seamless hands-free UX
        clearTimeout(autoConfirmTimer);
        autoConfirmTimer = setTimeout(() => {
          if (isScanning) {
            this.selectCandidate(best);
          }
        }, 650);

      } else {
        if (!isTargetLocked) {
          this.updateStatus("Memindai otomatis... Arahkan kotak ke stiker teks", false);
          this.scheduleNextScan(550);
        }
      }

    } catch (err) {
      console.warn("Auto-scan cycle error:", err);
      if (!isTargetLocked) {
        this.scheduleNextScan(800);
      }
    } finally {
      isProcessing = false;
      if (this.captureBtn) this.captureBtn.classList.remove('loading');
    }
  },

  setTargetLockedVisual(locked) {
    if (this.targetBoxEl) {
      if (locked) {
        this.targetBoxEl.classList.add('locked');
      } else {
        this.targetBoxEl.classList.remove('locked');
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
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            clearTimeout(autoConfirmTimer);
            this.selectCandidate(cand);
          });
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

    clearTimeout(autoScanTimer);
    clearTimeout(autoConfirmTimer);

    if (navigator.vibrate) navigator.vibrate(50);
    playBeep();

    const cb = currentCallback;
    this.stop();

    if (cb) {
      setTimeout(() => cb(clean), 100);
    }
  },

  resetResults() {
    clearTimeout(autoScanTimer);
    clearTimeout(autoConfirmTimer);
    this.setTargetLockedVisual(false);
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
    isTargetLocked = false;
    currentCallback = null;

    clearTimeout(autoScanTimer);
    clearTimeout(autoConfirmTimer);

    this.setTargetLockedVisual(false);

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
