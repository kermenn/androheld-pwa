/**
 * AndroHeld Web - Main Tools Module (SAP WebGUI, Evidence Input, & Data View)
 * 100% Faithful to AndroHeld Native Compose UI (SapBrowserViewModel.kt & SapBrowserScreen.kt)
 */

import { CONFIG } from '../config.js';
import { GasService } from '../services/gasService.js';
import { SheetsService } from '../services/sheetsService.js';
import { OcrService } from '../services/ocrService.js';

export const MainToolsModule = {
  activeTab: 'sap',
  cachedPhotos: [], // Array of { filename, base64, previewUrl }
  evidenceRecords: [], // Array of { timestamp, huInbOut, photoUrl, photoUrls }
  isLoadingData: false,
  isSubmitting: false,

  init() {
    this.bindEvents();
    this.loadCachedData();
  },

  bindEvents() {
    // 3 Tab Switching (SAP Menu, Submit Evidence, Database View)
    const tabBtns = document.querySelectorAll('.maintools-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    // SAP WebGUI Open Button
    const btnOpenSap = document.getElementById('btn-open-sap-external');
    if (btnOpenSap) {
      btnOpenSap.addEventListener('click', () => {
        const url = CONFIG.SAP_URL;
        window.open(url, '_blank');
      });
    }

    // Camera OCR Scanner for HU Inbound / Outbound
    const btnScanHu = document.getElementById('btn-maintools-scan-hu');
    if (btnScanHu) {
      btnScanHu.addEventListener('click', () => {
        OcrService.start((scannedText) => {
          const input = document.getElementById('maintools-hu-input');
          if (input) {
            input.value = scannedText;
          }
        });
      });
    }

    // Helper for processing files
    const handleFiles = async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      const remainingSlots = 10 - this.cachedPhotos.length;
      if (remainingSlots <= 0) {
        this.showToast('Maksimal 10 foto sudah tercapai.');
        return;
      }

      const filesToProcess = files.slice(0, remainingSlots);
      for (const file of filesToProcess) {
        try {
          const compressed = await GasService.compressImage(file, 1280, 0.75);
          this.cachedPhotos.push(compressed);
        } catch (err) {
          console.error('Gagal memproses foto:', err);
        }
      }

      this.renderPhotos();
    };

    // Camera Direct Input
    const cameraInput = document.getElementById('maintools-camera-input');
    if (cameraInput) {
      cameraInput.addEventListener('change', async (e) => {
        await handleFiles(e.target.files);
        cameraInput.value = '';
      });
    }

    // Gallery Multi-Image Input
    const galleryInput = document.getElementById('maintools-gallery-input');
    if (galleryInput) {
      galleryInput.addEventListener('change', async (e) => {
        await handleFiles(e.target.files);
        galleryInput.value = '';
      });
    }

    // Clear All Data Form Button
    const btnClearAll = document.getElementById('btn-maintools-clear-all');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        const huInput = document.getElementById('maintools-hu-input');
        if (huInput) huInput.value = '';
        this.cachedPhotos = [];
        this.renderPhotos();
        this.showToast('Form Evidence dibersihkan.');
      });
    }

    // Submit Evidence Form
    const btnSubmit = document.getElementById('btn-maintools-submit-evidence');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        this.submitEvidence();
      });
    }

    // Search in Data View
    const searchInput = document.getElementById('maintools-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderEvidenceList(e.target.value.trim());
      });
    }

    // Sync Data View Button in Topbar
    const btnSync = document.getElementById('btn-maintools-sync-data');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.loadEvidenceData(true);
      });
    }
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.maintools-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.maintools-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-content-${tabId}`);
    });

    if (tabId === 'dataview' && this.evidenceRecords.length === 0) {
      this.loadEvidenceData(false);
    }
  },

  renderPhotos() {
    const container = document.getElementById('maintools-photos-preview');
    const counter = document.getElementById('maintools-photo-counter');

    if (counter) {
      counter.textContent = `${this.cachedPhotos.length}/10 Foto`;
    }

    if (!container) return;
    container.innerHTML = '';

    this.cachedPhotos.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'evidence-photo-thumb-wrap';
      card.innerHTML = `
        <img src="${photo.previewUrl}" alt="Preview Foto ${idx + 1}" class="evidence-photo-thumb">
        <button type="button" class="evidence-photo-del-btn" data-index="${idx}" title="Hapus Foto">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      card.querySelector('.evidence-photo-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.cachedPhotos.splice(idx, 1);
        this.renderPhotos();
      });

      container.appendChild(card);
    });
  },

  async submitEvidence() {
    if (this.isSubmitting) return;

    const huInput = document.getElementById('maintools-hu-input');
    const huInbOut = (huInput?.value || '').trim();

    if (!huInbOut) {
      this.showToast('HU/Inb/Out Number tidak boleh kosong!');
      huInput?.focus();
      return;
    }

    if (this.cachedPhotos.length === 0) {
      this.showToast('Silakan ambil atau pilih minimal 1 foto bukti fisik!');
      return;
    }

    const btnSubmit = document.getElementById('btn-maintools-submit-evidence');
    const originalText = btnSubmit ? btnSubmit.innerHTML : 'SUBMIT EVIDENCE';

    try {
      this.isSubmitting = true;
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
          <div class="spinner-small" style="margin-right: 8px; border-top-color: #000;"></div>
          MENGIRIM (${this.cachedPhotos.length} FOTO)...
        `;
      }

      await GasService.submitSapEvidence(huInbOut, this.cachedPhotos);

      this.showToast('Data Evidence SAP berhasil dikirim!');

      // Reset form
      if (huInput) huInput.value = '';
      this.cachedPhotos = [];
      this.renderPhotos();

      // Auto refresh data view
      this.loadEvidenceData(true);

    } catch (err) {
      console.error('Submit SAP Evidence gagal:', err);
      this.showToast('Gagal mengirim: ' + (err.message || 'Koneksi error'));
    } finally {
      this.isSubmitting = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }
    }
  },

  loadCachedData() {
    const cached = localStorage.getItem('androheld_sap_evidence_cache');
    if (cached) {
      try {
        this.evidenceRecords = JSON.parse(cached);
        this.renderEvidenceList();
      } catch (_) {}
    }
  },

  async loadEvidenceData(forceSync = false) {
    if (this.isLoadingData) return;

    const syncBtn = document.getElementById('btn-maintools-sync-data');
    const container = document.getElementById('maintools-evidence-list');

    try {
      this.isLoadingData = true;
      if (syncBtn) syncBtn.classList.add('rotating');
      if (container && this.evidenceRecords.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
            <div class="spinner-androheld" style="margin: 0 auto 16px;"></div>
            <div style="color: #FFFFFF; font-weight: 600; font-size: 14px;">Mengunduh data Evidence...</div>
            <div style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">Menghubungkan ke Google Sheets via Cloudflare Proxy</div>
          </div>
        `;
      }

      const records = await SheetsService.fetchSapEvidence();
      this.evidenceRecords = records;
      localStorage.setItem('androheld_sap_evidence_cache', JSON.stringify(records));
      this.renderEvidenceList();

      if (forceSync) {
        this.showToast(`Berhasil sinkron (${records.length} data SAP Evidence).`);
      }
    } catch (err) {
      console.error('Gagal sinkron data SAP Evidence:', err);
      if (container && this.evidenceRecords.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 32px 16px;">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" style="margin-bottom: 12px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <div style="color: #FFFFFF; font-weight: 700; font-size: 14px;">Gagal memuat database Evidence!</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 16px;">${this.escapeHtml(err.message)}</div>
            <button class="androheld-primary-btn" id="btn-retry-evidence-sync" style="width: auto; padding: 8px 20px; font-size: 12px;">COBA LAGI</button>
          </div>
        `;
        document.getElementById('btn-retry-evidence-sync')?.addEventListener('click', () => this.loadEvidenceData(true));
      }
      this.showToast('Gagal sinkron data: ' + err.message);
    } finally {
      this.isLoadingData = false;
      if (syncBtn) syncBtn.classList.remove('rotating');
    }
  },

  renderEvidenceList(query = '') {
    const container = document.getElementById('maintools-evidence-list');
    const countBadge = document.getElementById('maintools-records-count');
    if (!container) return;

    const cleanQuery = query.toLowerCase().trim();
    const filtered = this.evidenceRecords.filter(item => {
      if (!cleanQuery) return true;
      return (
        item.huInbOut.toLowerCase().includes(cleanQuery) ||
        item.timestamp.toLowerCase().includes(cleanQuery)
      );
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Data`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.4;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div style="color: #FFFFFF; font-weight: 700; font-size: 14px;">
            ${this.evidenceRecords.length === 0 ? 'Belum ada data SAP Evidence!' : 'Data tidak ditemukan!'}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            ${this.evidenceRecords.length === 0 ? 'Ketuk ikon Refresh di kanan atas untuk menyinkronkan data.' : 'Coba cari dengan nomor HU atau tanggal lain.'}
          </div>
        </div>
      `;
      return;
    }

    // Render cards matching Compose Card in SapBrowserScreen.kt
    container.innerHTML = filtered.map(item => {
      const urls = item.photoUrls && item.photoUrls.length > 0 
        ? item.photoUrls 
        : (item.photoUrl && item.photoUrl.startsWith('http') ? [item.photoUrl] : []);
      const hasPhoto = urls.length > 0;
      const firstUrl = urls[0] || '#';

      return `
        <div class="evidence-record-card">
          <div class="evidence-record-header">
            <div class="evidence-hu-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
              <span class="evidence-hu-text">${this.escapeHtml(item.huInbOut)}</span>
            </div>
            <div class="evidence-timestamp-text">${this.escapeHtml(item.timestamp)}</div>
          </div>
          ${hasPhoto ? `
            <div class="evidence-photo-action-wrap">
              <a href="${this.escapeHtml(firstUrl)}" target="_blank" rel="noopener noreferrer" class="evidence-native-photo-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c1.65 0 3-1.35 3-3s-1.35-3-3-3-3 1.35-3 3 1.35 3 3 3zm0-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7-4h-3.17l-1.83-2H9.83L8 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H19v12z"/></svg>
                <span>${urls.length > 1 ? `BUKA BUKTI FOTO EVIDENCE (${urls.length})` : 'BUKA BUKTI FOTO EVIDENCE'}</span>
              </a>
            </div>
          ` : `
            <div class="evidence-no-photo-text">Tidak ada bukti foto terlampir</div>
          `}
        </div>
      `;
    }).join('');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
};
