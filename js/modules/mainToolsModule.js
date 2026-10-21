/**
 * AndroHeld Web - Main Tools Module (SAP WebGUI, Evidence Input, & Data View)
 * 100% Mirroring SapBrowserViewModel.kt & SapBrowserScreen.kt
 */

import { CONFIG } from '../config.js';
import { GasService } from '../services/gasService.js';
import { SheetsService } from '../services/sheetsService.js';
import { ScannerService } from '../services/scannerService.js';

export const MainToolsModule = {
  activeTab: 'sap',
  cachedPhotos: [], // Array of { filename, base64, previewUrl }
  evidenceRecords: [], // Array of { timestamp, huInbOut, photoUrl }
  isLoadingData: false,
  isSubmitting: false,

  init() {
    this.bindEvents();
    this.loadCachedData();
  },

  bindEvents() {
    // Tab Switching
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

    // Camera Barcode Scanner for HU Inbound / Outbound
    const btnScanHu = document.getElementById('btn-maintools-scan-hu');
    if (btnScanHu) {
      btnScanHu.addEventListener('click', () => {
        ScannerService.start((scannedText) => {
          const input = document.getElementById('maintools-hu-input');
          if (input) {
            input.value = scannedText;
          }
        });
      });
    }

    // Photo Input (Camera / Gallery)
    const photoInput = document.getElementById('maintools-photo-input');
    if (photoInput) {
      photoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
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

        photoInput.value = '';
        this.renderPhotos();
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

    // Sync Data View Button
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
      this.showToast('No HU / Inb / Out tidak boleh kosong!');
      huInput?.focus();
      return;
    }

    if (this.cachedPhotos.length === 0) {
      this.showToast('Silakan ambil atau pilih minimal 1 foto!');
      return;
    }

    const btnSubmit = document.getElementById('btn-maintools-submit-evidence');
    const originalText = btnSubmit ? btnSubmit.innerHTML : 'Kirim Data Evidence';

    try {
      this.isSubmitting = true;
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
          <div class="spinner-small" style="margin-right: 8px;"></div>
          Mengirim (${this.cachedPhotos.length} foto)...
        `;
      }

      const res = await GasService.submitSapEvidence(huInbOut, this.cachedPhotos);

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
          <div style="text-align: center; padding: 36px 16px; color: var(--text-secondary);">
            <div class="spinner" style="margin: 0 auto 12px;"></div>
            Memuat data Evidence dari Google Sheets...
          </div>
        `;
      }

      const records = await SheetsService.fetchSapEvidence();
      this.evidenceRecords = records;
      localStorage.setItem('androheld_sap_evidence_cache', JSON.stringify(records));
      this.renderEvidenceList();

      if (forceSync) {
        this.showToast(`Data disinkronkan (${records.length} rekaman).`);
      }
    } catch (err) {
      console.error('Gagal sinkron data SAP Evidence:', err);
      if (container && this.evidenceRecords.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 24px 16px; color: #FF5252;">
            Gagal memuat data dari cloud.<br>
            <button class="primary-btn" id="btn-retry-evidence-sync" style="margin-top: 12px; width: auto; padding: 8px 16px;">Coba Lagi</button>
          </div>
        `;
        document.getElementById('btn-retry-evidence-sync')?.addEventListener('click', () => this.loadEvidenceData(true));
      }
      this.showToast('Gagal memuat data Google Sheets: ' + err.message);
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
        <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="11" y2="17"></line></svg>
          <div>Tidak ada data Evidence yang cocok.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const hasPhoto = item.photoUrl && item.photoUrl.startsWith('http');
      return `
        <div class="evidence-record-card">
          <div class="evidence-record-header">
            <div class="evidence-hu-badge">${this.escapeHtml(item.huInbOut)}</div>
            <div class="evidence-timestamp">${this.escapeHtml(item.timestamp)}</div>
          </div>
          ${hasPhoto ? `
            <div class="evidence-photo-action">
              <a href="${this.escapeHtml(item.photoUrl)}" target="_blank" rel="noopener noreferrer" class="evidence-photo-link-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Lihat Foto di Google Drive ↗
              </a>
            </div>
          ` : `
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">Foto tidak tersedia</div>
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
