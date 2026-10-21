/**
 * AndroHeld Web - PIN Security Module (PinModule)
 * 100% Matching Android Native PinViewModel.kt & PinScreen.kt
 * 
 * Features:
 * - One-way SHA-256 + Salt ("androheld_salt_key_2026_@!")
 * - Salted Target Hash: "edd3d488f2d939bd37ddc9adc41c1afa44bb739e09be6b251b7b0580c0f862bd" (PIN 1508)
 * - Brute-Force Lockout Policy:
 *     >= 3 fails -> 30 seconds lockout
 *     >= 5 fails -> 5 minutes lockout
 *     >= 7 fails -> Permanent lock (until admin reset)
 * - Interactive numeric keypad with haptic + Web Audio feedback
 * - Physical keyboard support (0-9, Backspace)
 * - Dot indicators with error shake animation
 * - Session persistence & Quick Lock functionality
 */

const SALT = "androheld_salt_key_2026_@!";
const TARGET_HASH = "edd3d488f2d939bd37ddc9adc41c1afa44bb739e09be6b251b7b0580c0f862bd";

const STORAGE_KEYS = {
  FAILED_ATTEMPTS: "androheld_pin_failed_attempts",
  LOCK_UNTIL: "androheld_pin_lock_until",
  AUTH_SESSION: "androheld_auth_session"
};

export const PinModule = {
  enteredPin: "",
  failedAttempts: 0,
  lockUntil: 0,
  isLocked: false,
  isProcessing: false,
  timerInterval: null,
  audioCtx: null,
  onUnlockCallback: null,

  /**
   * Initialize PIN Screen & Event Listeners
   */
  init(onUnlock) {
    this.onUnlockCallback = onUnlock;
    this.loadState();
    this.bindEvents();
    this.checkLockout();
  },

  /**
   * Load security state from persistent localStorage
   */
  loadState() {
    this.failedAttempts = parseInt(localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS) || "0", 10);
    this.lockUntil = parseInt(localStorage.getItem(STORAGE_KEYS.LOCK_UNTIL) || "0", 10);
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, this.failedAttempts.toString());
    localStorage.setItem(STORAGE_KEYS.LOCK_UNTIL, this.lockUntil.toString());
  },

  /**
   * Check if current browser session is already authenticated
   */
  isAuthenticated() {
    return sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION) === "true";
  },

  /**
   * Web Audio API Synthesizer (Instant, no external MP3 dependencies)
   */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  playTapSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (_) {}
  },

  playErrorSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
  },

  playSuccessSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      
      // Chime Note 1 (C5 - 523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Chime Note 2 (E5 - 659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(659.25, now + 0.1);
      gain2.gain.setValueAtTime(0.14, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.36);
    } catch (_) {}
  },

  /**
   * Haptic vibration feedback (Mobile Safari / Chrome)
   */
  vibrate(pattern) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  },

  /**
   * SHA-256 + Salt Enkripsi (Web Crypto API)
   */
  async hashSha256(plainPin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainPin + SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  },

  /**
   * Check lockout state & countdown
   */
  checkLockout() {
    const now = Date.now();
    const lockoutBanner = document.getElementById("pin-lockout-banner");
    const lockoutTimer = document.getElementById("pin-lockout-timer");
    const keypad = document.getElementById("pin-keypad-grid");

    if (this.lockUntil > now) {
      this.isLocked = true;
      if (keypad) keypad.classList.add("disabled");
      if (lockoutBanner) lockoutBanner.style.display = "flex";

      if (this.lockUntil === Number.MAX_SAFE_INTEGER || this.failedAttempts >= 7) {
        if (lockoutTimer) {
          lockoutTimer.textContent = "Aplikasi Dikunci Permanen (Hubungi Administrator)";
        }
        return;
      }

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((this.lockUntil - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.isLocked = false;
          if (keypad) keypad.classList.remove("disabled");
          if (lockoutBanner) lockoutBanner.style.display = "none";
          this.renderDots();
        } else {
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          if (lockoutTimer) {
            lockoutTimer.textContent = mins > 0 
              ? `Terkunci: Coba lagi dalam ${mins} menit ${secs} detik` 
              : `Terkunci: Coba lagi dalam ${secs} detik`;
          }
        }
      }, 1000);
    } else {
      this.isLocked = false;
      if (keypad) keypad.classList.remove("disabled");
      if (lockoutBanner) lockoutBanner.style.display = "none";
    }
  },

  /**
   * Handle digit tap
   */
  enterDigit(digit) {
    if (this.isLocked || this.isProcessing) return;
    if (this.enteredPin.length < 4) {
      this.enteredPin += digit;
      this.playTapSound();
      this.vibrate(20);
      this.renderDots();

      if (this.enteredPin.length === 4) {
        this.verifyPin();
      }
    }
  },

  /**
   * Handle delete (backspace) tap
   */
  deleteDigit() {
    if (this.isLocked || this.isProcessing) return;
    if (this.enteredPin.length > 0) {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.playTapSound();
      this.vibrate(25);
      this.renderDots();
    }
  },

  /**
   * Render PIN dot indicator states
   */
  renderDots(isError = false) {
    const dots = document.querySelectorAll(".pin-dot");
    dots.forEach((dot, index) => {
      dot.className = "pin-dot";
      if (isError) {
        dot.classList.add("error");
      } else if (index < this.enteredPin.length) {
        dot.classList.add("filled");
      }
    });

    const errorMsg = document.getElementById("pin-error-msg");
    if (errorMsg) {
      if (this.failedAttempts > 0 && !isError) {
        errorMsg.textContent = `Percobaan gagal: ${this.failedAttempts} kali`;
        errorMsg.style.display = "block";
      } else if (!isError) {
        errorMsg.style.display = "none";
      }
    }
  },

  /**
   * Verify entered PIN against target SHA-256 hash
   */
  async verifyPin() {
    this.isProcessing = true;
    const computedHash = await this.hashSha256(this.enteredPin);

    if (computedHash === TARGET_HASH) {
      // SUCCESS!
      this.playSuccessSound();
      this.vibrate([40, 40, 80]);
      
      // Reset attempts
      this.failedAttempts = 0;
      this.lockUntil = 0;
      this.saveState();
      this.enteredPin = "";
      this.renderDots();

      // Set session unlocked
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, "true");

      setTimeout(() => {
        this.isProcessing = false;
        if (typeof this.onUnlockCallback === "function") {
          this.onUnlockCallback();
        }
      }, 250);

    } else {
      // WRONG PIN
      this.failedAttempts += 1;
      const now = Date.now();

      if (this.failedAttempts >= 7) {
        this.lockUntil = Number.MAX_SAFE_INTEGER;
      } else if (this.failedAttempts >= 5) {
        this.lockUntil = now + (5 * 60 * 1000); // 5 minutes
      } else if (this.failedAttempts >= 3) {
        this.lockUntil = now + (30 * 1000); // 30 seconds
      }

      this.saveState();
      this.playErrorSound();
      this.vibrate([80, 50, 80, 50, 150]);

      // Trigger Visual Error & Shake Animation
      const dotsContainer = document.getElementById("pin-dots-container");
      if (dotsContainer) {
        dotsContainer.classList.add("shake");
      }
      this.renderDots(true);

      const errorMsg = document.getElementById("pin-error-msg");
      if (errorMsg) {
        errorMsg.textContent = `PIN Salah! (${this.failedAttempts}x percobaan)`;
        errorMsg.style.display = "block";
      }

      setTimeout(() => {
        if (dotsContainer) {
          dotsContainer.classList.remove("shake");
        }
        this.enteredPin = "";
        this.isProcessing = false;
        this.renderDots();
        this.checkLockout();
      }, 550);
    }
  },

  /**
   * Explicit Lock Method (Call from UI or Auto-Lock)
   */
  lock() {
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    this.enteredPin = "";
    this.renderDots();
    this.checkLockout();

    document.querySelectorAll(".view-screen").forEach(s => s.classList.remove("active"));
    const pinScreen = document.getElementById("screen-pin");
    if (pinScreen) pinScreen.classList.add("active");
  },

  /**
   * Bind event listeners for UI buttons and physical keyboards
   */
  bindEvents() {
    // Numeric Keypad buttons (0-9 and DEL)
    const keypad = document.getElementById("pin-keypad-grid");
    if (keypad) {
      keypad.addEventListener("click", (e) => {
        const btn = e.target.closest(".pin-key");
        if (!btn) return;
        const val = btn.dataset.key;
        if (val === "DEL") {
          this.deleteDigit();
        } else if (val !== undefined && val !== "") {
          this.enterDigit(val);
        }
      });
    }

    // Physical Keyboard support (PC or External Bluetooth Keyboard)
    window.addEventListener("keydown", (e) => {
      const pinScreen = document.getElementById("screen-pin");
      if (!pinScreen || !pinScreen.classList.contains("active")) return;

      if (e.key >= "0" && e.key <= "9") {
        this.enterDigit(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        this.deleteDigit();
      }
    });

    // Quick Lock Button on Home Screen
    const lockBtn = document.getElementById("btn-quick-lock");
    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        this.lock();
      });
    }
  }
};
