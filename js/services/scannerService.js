/* ==========================================================================
   Live Camera Barcode & QR Code Scanner Service
   Using local html5-qrcode library with haptic feedback & auto-reticle
   ========================================================================== */

let html5QrCode = null;
let isScanning = false;
let currentOnScanCallback = null;

// Sound effect for successful scan
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // audio context might be restricted before user gesture
  }
}

export const ScannerService = {
  init() {
    this.modalEl = document.getElementById('camera-scanner-modal');
    this.closeBtn = document.getElementById('btn-close-scanner');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.stop());
    }
  },

  /**
   * Opens the full-screen camera viewfinder and scans for barcodes.
   * @param {Function} onScanSuccess Callback function receiving (scannedText)
   */
  async start(onScanSuccess) {
    currentOnScanCallback = onScanSuccess;

    if (!window.Html5Qrcode) {
      alert("Library pemindai kamera belum siap. Coba muat ulang halaman.");
      return;
    }

    if (!this.modalEl) {
      this.modalEl = document.getElementById('camera-scanner-modal');
    }

    this.modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (!html5QrCode) {
      html5QrCode = new window.Html5Qrcode("scanner-reader-box");
    }

    const config = {
      fps: 15,
      qrbox: { width: 280, height: 180 }, // Wide box optimized for Code 128 / Code 39 part barcodes
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };

    try {
      isScanning = true;
      await html5QrCode.start(
        { facingMode: "environment" }, // Rear / Back camera
        config,
        (decodedText) => {
          this.handleSuccess(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame misses
        }
      );
    } catch (err) {
      console.error("Camera start error", err);
      this.stop();
      alert("Tidak dapat mengakses kamera: " + (err.message || "Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser."));
    }
  },

  handleSuccess(decodedText) {
    const cleanText = decodedText.trim().toUpperCase();
    if (!cleanText) return;

    // Haptic feedback (Vibration on Android / Supported iOS)
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }
    playBeep();

    const cb = currentOnScanCallback;
    this.stop();

    if (cb) {
      setTimeout(() => cb(cleanText), 150);
    }
  },

  async stop() {
    if (!isScanning) {
      if (this.modalEl) this.modalEl.style.display = 'none';
      document.body.style.overflow = '';
      return;
    }

    isScanning = false;
    currentOnScanCallback = null;

    if (html5QrCode) {
      try {
        await html5QrCode.stop();
      } catch (e) {
        console.warn("Error stopping scanner", e);
      }
    }

    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    document.body.style.overflow = '';
  }
};
