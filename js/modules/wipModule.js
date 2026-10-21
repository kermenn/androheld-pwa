/* ==========================================================================
   WIP Tools Module (Mirroring WipToolsScreen.kt & WipToolsViewModel.kt)
   ========================================================================== */

import { SheetsService } from '../services/sheetsService.js';
import { GasService } from '../services/gasService.js';

let activeTab = 0; // 0: Parts In, 1: Evidence In, 2: Parts Out, 3: Evidence Out

// State: Parts Out
let outPicWarehouse = "";
let outPicService = "";
let outOdNumbers = [];
let outPhotos = []; // array of { filename, base64, previewUrl }
let isSubmittingOut = false;

// State: Parts In
let inOdNumbers = [];
let inUnit = "";
let inLokasi = "";
let inPhotos = []; // array of { filename, base64, previewUrl }
let isSubmittingIn = false;

// Cached Records
let wipOutRecords = [];
let wipInRecords = [];
let isSyncingOutDb = false;
let isSyncingInDb = false;

export const WipModule = {
  init() {
    this.bindEvents();
    this.switchTab(0);
  },

  bindEvents() {
    // 4 Tab Headers
    const tabs = document.querySelectorAll('.wip-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabIndex = parseInt(e.currentTarget.dataset.tab, 10);
        this.switchTab(tabIndex);
      });
    });

    // --- FORM PARTS OUT (Tab 2) ---
    const outOdInput = document.getElementById('wip-out-od-input');
    const outAddOdBtn = document.getElementById('btn-wip-out-add-od');
    if (outAddOdBtn && outOdInput) {
      outAddOdBtn.addEventListener('click', () => {
        const val = outOdInput.value.trim().toUpperCase();
        if (val && !outOdNumbers.includes(val)) {
          outOdNumbers.push(val);
          outOdInput.value = '';
          this.renderOdChips('out');
        }
      });
      outOdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          outAddOdBtn.click();
        }
      });
    }

    const outPhotoInput = document.getElementById('wip-out-photo-file-input');
    const outPhotoBtn = document.getElementById('btn-wip-out-add-photo');
    if (outPhotoBtn && outPhotoInput) {
      outPhotoBtn.addEventListener('click', () => outPhotoInput.click());
      outPhotoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          if (outPhotos.length >= 10) break;
          try {
            const compressed = await GasService.compressImage(file);
            outPhotos.push(compressed);
          } catch (err) {
            console.error("Gagal kompres foto", err);
          }
        }
        outPhotoInput.value = '';
        this.renderPhotos('out');
      });
    }

    const btnSubmitOut = document.getElementById('btn-wip-out-submit');
    if (btnSubmitOut) {
      btnSubmitOut.addEventListener('click', () => this.submitWipOut());
    }

    // --- FORM PARTS IN (Tab 0) ---
    const inOdInput = document.getElementById('wip-in-od-input');
    const inAddOdBtn = document.getElementById('btn-wip-in-add-od');
    if (inAddOdBtn && inOdInput) {
      inAddOdBtn.addEventListener('click', () => {
        const val = inOdInput.value.trim().toUpperCase();
        if (val && !inOdNumbers.includes(val)) {
          inOdNumbers.push(val);
          inOdInput.value = '';
          this.renderOdChips('in');
        }
      });
      inOdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inAddOdBtn.click();
        }
      });
    }

    const inPhotoInput = document.getElementById('wip-in-photo-file-input');
    const inPhotoBtn = document.getElementById('btn-wip-in-add-photo');
    if (inPhotoBtn && inPhotoInput) {
      inPhotoBtn.addEventListener('click', () => inPhotoInput.click());
      inPhotoInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          if (inPhotos.length >= 10) break;
          try {
            const compressed = await GasService.compressImage(file);
            inPhotos.push(compressed);
          } catch (err) {
            console.error("Gagal kompres foto", err);
          }
        }
        inPhotoInput.value = '';
        this.renderPhotos('in');
      });
    }

    const btnSubmitIn = document.getElementById('btn-wip-in-submit');
    if (btnSubmitIn) {
      btnSubmitIn.addEventListener('click', () => this.submitWipIn());
    }

    // --- Search filter for Evidence ---
    const evidenceSearch = document.getElementById('wip-evidence-search');
    if (evidenceSearch) {
      evidenceSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (activeTab === 1) this.renderEvidenceInList(q);
        if (activeTab === 3) this.renderEvidenceOutList(q);
      });
    }

    // Sync button in top bar
    const refreshBtn = document.getElementById('btn-wip-sync');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (activeTab === 1) this.syncEvidenceIn();
        else if (activeTab === 3) this.syncEvidenceOut();
      });
    }
  },

  switchTab(index) {
    activeTab = index;
    document.querySelectorAll('.wip-tab').forEach((tab) => {
      tab.classList.toggle('active', parseInt(tab.dataset.tab, 10) === index);
    });

    document.querySelectorAll('.wip-tab-content').forEach((panel) => {
      panel.style.display = 'none';
    });

    const activePanel = document.getElementById(`wip-tab-panel-${index}`);
    if (activePanel) activePanel.style.display = 'block';

    // Auto-fetch database when opening Evidence tabs
    if (index === 1 && wipInRecords.length === 0) {
      this.syncEvidenceIn();
    } else if (index === 3 && wipOutRecords.length === 0) {
      this.syncEvidenceOut();
    }
  },

  renderOdChips(type) {
    const isOut = type === 'out';
    const list = isOut ? outOdNumbers : inOdNumbers;
    const container = document.getElementById(isOut ? 'wip-out-od-chips' : 'wip-in-od-chips');
    if (!container) return;

    container.innerHTML = '';
    list.forEach((od, idx) => {
      const chip = document.createElement('div');
      chip.className = 'od-badge-chip';
      chip.innerHTML = `
        <span>${od}</span>
        <button type="button" class="od-chip-del" data-idx="${idx}">×</button>
      `;
      chip.querySelector('.od-chip-del').addEventListener('click', () => {
        list.splice(idx, 1);
        this.renderOdChips(type);
      });
      container.appendChild(chip);
    });
  },

  renderPhotos(type) {
    const isOut = type === 'out';
    const photos = isOut ? outPhotos : inPhotos;
    const container = document.getElementById(isOut ? 'wip-out-photo-preview' : 'wip-in-photo-preview');
    if (!container) return;

    container.innerHTML = '';
    photos.forEach((p, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb-item';
      thumb.innerHTML = `
        <img src="${p.previewUrl}" alt="Photo ${idx+1}">
        <button type="button" class="photo-thumb-del" data-idx="${idx}">×</button>
      `;
      thumb.querySelector('.photo-thumb-del').addEventListener('click', () => {
        photos.splice(idx, 1);
        this.renderPhotos(type);
      });
      container.appendChild(thumb);
    });
  },

  async submitWipOut() {
    if (isSubmittingOut) return;
    const picWarehouse = document.getElementById('wip-out-pic-wh')?.value.trim() || "";
    const picService = document.getElementById('wip-out-pic-svc')?.value.trim() || "";

    if (!picWarehouse || !picService) {
      alert("Harap isi PIC Warehouse dan PIC Service!");
      return;
    }
    if (outOdNumbers.length === 0) {
      alert("Harap tambahkan minimal 1 Nomor OD!");
      return;
    }
    if (outPhotos.length === 0) {
      alert("Harap ambil/lampirkan minimal 1 foto bukti serah terima!");
      return;
    }

    isSubmittingOut = true;
    const submitBtn = document.getElementById('btn-wip-out-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;

    try {
      this.showToast("Mengunggah foto & data ke Google Drive...");
      await GasService.submitWipOut(picWarehouse, picService, outOdNumbers, outPhotos);

      // Reset form
      outOdNumbers = [];
      outPhotos = [];
      document.getElementById('wip-out-pic-wh').value = '';
      document.getElementById('wip-out-pic-svc').value = '';
      this.renderOdChips('out');
      this.renderPhotos('out');

      alert("🎉 Sukses! Data Serah Terima Parts Out berhasil tercatat di Google Spreadsheet & foto tersimpan di Google Drive.");
      this.switchTab(3); // Switch to Evidence Out
      this.syncEvidenceOut();
    } catch (err) {
      console.error(err);
      alert("Gagal kirim: " + err.message);
    } finally {
      isSubmittingOut = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = "SUBMIT PENYERAHAN PARTS OUT";
    }
  },

  async submitWipIn() {
    if (isSubmittingIn) return;
    const unit = document.getElementById('wip-in-unit')?.value.trim() || "";
    const lokasi = document.getElementById('wip-in-lokasi')?.value.trim() || "";

    if (inOdNumbers.length === 0) {
      alert("Harap tambahkan minimal 1 Nomor OD!");
      return;
    }
    if (!unit || !lokasi) {
      alert("Harap isi Model Unit dan Lokasi Rak/WIP!");
      return;
    }
    if (inPhotos.length === 0) {
      alert("Harap lampirkan minimal 1 foto bukti fisik!");
      return;
    }

    isSubmittingIn = true;
    const submitBtn = document.getElementById('btn-wip-in-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;

    try {
      this.showToast("Mengunggah foto & data ke Google Drive...");
      await GasService.submitWipIn(inOdNumbers, unit, lokasi, inPhotos);

      // Reset form
      inOdNumbers = [];
      inPhotos = [];
      document.getElementById('wip-in-unit').value = '';
      document.getElementById('wip-in-lokasi').value = '';
      this.renderOdChips('in');
      this.renderPhotos('in');

      alert("🎉 Sukses! Data Parts In berhasil tercatat di Google Spreadsheet & foto tersimpan di Google Drive.");
      this.switchTab(1); // Switch to Evidence In
      this.syncEvidenceIn();
    } catch (err) {
      console.error(err);
      alert("Gagal kirim: " + err.message);
    } finally {
      isSubmittingIn = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = "SUBMIT REGISTRASI PARTS IN";
    }
  },

  async syncEvidenceOut() {
    if (isSyncingOutDb) return;
    isSyncingOutDb = true;
    const listContainer = document.getElementById('wip-out-records-list');
    if (listContainer) listContainer.innerHTML = '<div style="text-align: center; padding: 30px;"><div class="spinner" style="margin: 0 auto 10px auto;"></div>Memuat riwayat Evidence Out...</div>';

    try {
      wipOutRecords = await SheetsService.getWipOutRecords();
      this.renderEvidenceOutList("");
    } catch (e) {
      if (listContainer) listContainer.innerHTML = `<div style="text-align: center; color: var(--accent-red); padding: 20px;">Gagal memuat: ${e.message}</div>`;
    } finally {
      isSyncingOutDb = false;
    }
  },

  async syncEvidenceIn() {
    if (isSyncingInDb) return;
    isSyncingInDb = true;
    const listContainer = document.getElementById('wip-in-records-list');
    if (listContainer) listContainer.innerHTML = '<div style="text-align: center; padding: 30px;"><div class="spinner" style="margin: 0 auto 10px auto;"></div>Memuat riwayat Evidence In...</div>';

    try {
      wipInRecords = await SheetsService.getWipInRecords();
      this.renderEvidenceInList("");
    } catch (e) {
      if (listContainer) listContainer.innerHTML = `<div style="text-align: center; color: var(--accent-red); padding: 20px;">Gagal memuat: ${e.message}</div>`;
    } finally {
      isSyncingInDb = false;
    }
  },

  renderEvidenceOutList(query = "") {
    const container = document.getElementById('wip-out-records-list');
    if (!container) return;

    let filtered = wipOutRecords;
    if (query) {
      const q = query.toLowerCase();
      filtered = wipOutRecords.filter(r => 
        r.odNumber.toLowerCase().includes(q) ||
        r.picWarehouse.toLowerCase().includes(q) ||
        r.picService.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Tidak ada riwayat Evidence Out.</div>`;
      return;
    }

    container.innerHTML = filtered.map(r => `
      <div class="evidence-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="evidence-od">OD: ${r.odNumber}</span>
          <span class="evidence-timestamp">${r.timestamp}</span>
        </div>
        <div class="evidence-detail-row">
          <span>🏢 Warehouse: <strong>${r.picWarehouse}</strong></span>
          <span>🔧 Service: <strong>${r.picService}</strong></span>
        </div>
        ${r.photoUrl ? `
          <div style="margin-top: 8px;">
            <a href="${r.photoUrl}" target="_blank" class="evidence-photo-link">
              📷 Buka Foto Bukti Google Drive ↗
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  renderEvidenceInList(query = "") {
    const container = document.getElementById('wip-in-records-list');
    if (!container) return;

    let filtered = wipInRecords;
    if (query) {
      const q = query.toLowerCase();
      filtered = wipInRecords.filter(r => 
        r.odNumber.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q) ||
        r.lokasi.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Tidak ada riwayat Evidence In.</div>`;
      return;
    }

    container.innerHTML = filtered.map(r => `
      <div class="evidence-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="evidence-od">OD: ${r.odNumber}</span>
          <span class="evidence-timestamp">${r.timestamp}</span>
        </div>
        <div class="evidence-detail-row">
          <span>🚜 Unit: <strong>${r.unit}</strong></span>
          <span>📍 Lokasi: <strong>${r.lokasi}</strong></span>
        </div>
        ${r.photoUrl ? `
          <div style="margin-top: 8px;">
            <a href="${r.photoUrl}" target="_blank" class="evidence-photo-link">
              📷 Buka Foto Bukti Google Drive ↗
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }
};
