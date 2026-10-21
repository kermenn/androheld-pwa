/* ==========================================================================
   QC Hose Assembly Module (Mirroring QcHoseScreen.kt & QcHoseViewModel.kt)
   5-Point Quality Inspection Form & Evidence History
   ========================================================================== */

import { SheetsService } from '../services/sheetsService.js';
import { GasService } from '../services/gasService.js';

let activeTab = 0; // 0: Form Inspeksi Baru, 1: Riwayat Bukti
let isSubmitting = false;
let isSyncingDb = false;
let qcHoseRecords = [];

// 5 Dedicated Photo Slots
const photoSlots = {
  panjang: null,   // { filename, base64, previewUrl }
  crimp: null,
  coupling1: null,
  coupling2: null,
  actual: null
};

export const QcHoseModule = {
  init() {
    this.bindEvents();
    this.switchTab(0);
  },

  bindEvents() {
    // Tab switching (2 tabs: Inspeksi Baru, Riwayat Bukti)
    const tabs = document.querySelectorAll('.qc-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabIndex = parseInt(e.currentTarget.dataset.tab, 10);
        this.switchTab(tabIndex);
      });
    });

    // 5 Photo Capture Slot Handlers
    const slotKeys = ['panjang', 'crimp', 'coupling1', 'coupling2', 'actual'];
    slotKeys.forEach((key) => {
      const inputEl = document.getElementById(`qc-input-${key}`);
      const triggerEl = document.getElementById(`qc-slot-${key}`);
      const delBtn = document.getElementById(`qc-del-${key}`);

      if (triggerEl && inputEl) {
        triggerEl.addEventListener('click', (e) => {
          if (e.target.closest('.qc-photo-delete')) return; // ignore delete click
          inputEl.click();
        });

        inputEl.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          try {
            this.showToast(`Mengompres foto ${key.toUpperCase()}...`);
            const compressed = await GasService.compressImage(file);
            photoSlots[key] = compressed;
            this.renderPhotoSlot(key);
          } catch (err) {
            console.error(err);
            alert("Gagal memproses foto: " + err.message);
          }
          inputEl.value = '';
        });
      }

      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          photoSlots[key] = null;
          this.renderPhotoSlot(key);
        });
      }
    });

    // Submit Button
    const btnSubmit = document.getElementById('btn-qc-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitForm());
    }

    // Top Bar Refresh Sync Button
    const syncBtn = document.getElementById('btn-qc-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncDatabase());
    }

    // Evidence Search Input
    const searchInput = document.getElementById('qc-evidence-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderEvidenceList(e.target.value.trim());
      });
    }
  },

  switchTab(index) {
    activeTab = index;
    document.querySelectorAll('.qc-tab').forEach((tab) => {
      tab.classList.toggle('active', parseInt(tab.dataset.tab, 10) === index);
    });

    document.querySelectorAll('.qc-tab-content').forEach((panel) => {
      panel.style.display = 'none';
    });

    const activePanel = document.getElementById(`qc-tab-panel-${index}`);
    if (activePanel) activePanel.style.display = 'block';

    // Auto sync on opening Evidence tab if empty
    if (index === 1 && qcHoseRecords.length === 0) {
      this.syncDatabase();
    }
  },

  renderPhotoSlot(key) {
    const slotEl = document.getElementById(`qc-slot-${key}`);
    const previewEl = document.getElementById(`qc-preview-${key}`);
    const placeholderEl = document.getElementById(`qc-placeholder-${key}`);
    const statusBadge = document.getElementById(`qc-status-${key}`);
    const delBtn = document.getElementById(`qc-del-${key}`);

    if (!slotEl || !previewEl || !placeholderEl) return;

    const data = photoSlots[key];
    if (data) {
      previewEl.src = data.previewUrl;
      previewEl.style.display = 'block';
      placeholderEl.style.display = 'none';
      if (statusBadge) {
        statusBadge.textContent = 'TERAMBIL ✓';
        statusBadge.className = 'qc-badge-status badge-success';
      }
      if (delBtn) delBtn.style.display = 'flex';
      slotEl.classList.add('has-photo');
    } else {
      previewEl.src = '';
      previewEl.style.display = 'none';
      placeholderEl.style.display = 'flex';
      if (statusBadge) {
        statusBadge.textContent = 'WAJIB';
        statusBadge.className = 'qc-badge-status badge-pending';
      }
      if (delBtn) delBtn.style.display = 'none';
      slotEl.classList.remove('has-photo');
    }
  },

  async submitForm() {
    if (isSubmitting) return;

    const pic = document.getElementById('qc-pic-hose')?.value.trim() || '';
    const po = document.getElementById('qc-po-subcon')?.value.trim() || '';
    const pn = document.getElementById('qc-pn-hose')?.value.trim() || '';
    const angle = document.getElementById('qc-angle')?.value.trim() || '';
    const remarks = document.getElementById('qc-remarks')?.value.trim() || '';

    // Validations (exact mirror of QcHoseViewModel.kt)
    if (!pic) {
      alert("PIC Hose tidak boleh kosong!");
      document.getElementById('qc-pic-hose')?.focus();
      return;
    }
    if (!po) {
      alert("PO Subcon Reference tidak boleh kosong!");
      document.getElementById('qc-po-subcon')?.focus();
      return;
    }
    if (!pn) {
      alert("Part Number (PN) Hose tidak boleh kosong!");
      document.getElementById('qc-pn-hose')?.focus();
      return;
    }
    if (!angle) {
      alert("Angle / Sudut Orientasi tidak boleh kosong! (Contoh: 0°, 45°, 90°)");
      document.getElementById('qc-angle')?.focus();
      return;
    }

    if (!photoSlots.panjang) {
      alert("Silakan ambil Foto 1: Pengukuran Panjang Hose!");
      return;
    }
    if (!photoSlots.crimp) {
      alert("Silakan ambil Foto 2: Pengukuran Mesin Crimp!");
      return;
    }
    if (!photoSlots.coupling1) {
      alert("Silakan ambil Foto 3: Coupling Ujung 1 (After Crimp)!");
      return;
    }
    if (!photoSlots.coupling2) {
      alert("Silakan ambil Foto 4: Coupling Ujung 2 (After Crimp)!");
      return;
    }
    if (!photoSlots.actual) {
      alert("Silakan ambil Foto 5: Foto Aktual Utuh Hose!");
      return;
    }

    isSubmitting = true;
    const submitBtn = document.getElementById('btn-qc-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;

    try {
      this.showToast("Mengunggah 5 foto inspeksi ke Google Drive & Spreadsheet...");

      await GasService.submitQcHose(pic, po, pn, angle, remarks, {
        fotoPanjang: photoSlots.panjang,
        fotoCrimp: photoSlots.crimp,
        fotoCoupling1: photoSlots.coupling1,
        fotoCoupling2: photoSlots.coupling2,
        fotoActual: photoSlots.actual
      });

      // Clear Form
      this.clearForm();
      alert("🎉 Sukses! Data 5-Point QC Hose Assembly & 5 Foto Bukti Fisik berhasil tersimpan di Google Drive dan Spreadsheet.");

      // Switch to Evidence Tab & Sync
      this.switchTab(1);
      this.syncDatabase();
    } catch (err) {
      console.error(err);
      alert("Gagal kirim data QC Hose: " + err.message);
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = "SUBMIT HASIL INSPEKSI QC HOSE";
    }
  },

  clearForm() {
    ['panjang', 'crimp', 'coupling1', 'coupling2', 'actual'].forEach((key) => {
      photoSlots[key] = null;
      this.renderPhotoSlot(key);
    });

    const fields = ['qc-pic-hose', 'qc-po-subcon', 'qc-pn-hose', 'qc-angle', 'qc-remarks'];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  },

  async syncDatabase() {
    if (isSyncingDb) return;
    isSyncingDb = true;

    const container = document.getElementById('qc-records-list');
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 30px;"><div class="spinner" style="margin: 0 auto 10px auto;"></div>Memuat riwayat QC Hose dari Google Sheets...</div>';
    }

    try {
      qcHoseRecords = await SheetsService.getQcHoseRecords();
      this.renderEvidenceList("");
    } catch (e) {
      if (container) {
        container.innerHTML = `<div style="text-align: center; color: var(--accent-red); padding: 20px;">Gagal memuat: ${e.message}</div>`;
      }
    } finally {
      isSyncingDb = false;
    }
  },

  renderEvidenceList(query = "") {
    const container = document.getElementById('qc-records-list');
    if (!container) return;

    let filtered = qcHoseRecords;
    if (query) {
      const q = query.toLowerCase();
      filtered = qcHoseRecords.filter((r) =>
        r.pnHose.toLowerCase().includes(q) ||
        r.poSubconRef.toLowerCase().includes(q) ||
        r.picHose.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">Tidak ada riwayat inspeksi QC Hose yang cocok.</div>';
      return;
    }

    container.innerHTML = filtered.map((r) => {
      const photos = [
        { title: 'Panjang', url: r.fotoPanjangUrl },
        { title: 'Crimp', url: r.fotoCrimpUrl },
        { title: 'Coupling 1', url: r.fotoCoupling1Url },
        { title: 'Coupling 2', url: r.fotoCoupling2Url },
        { title: 'Actual', url: r.fotoActualUrl }
      ].filter(p => p.url);

      return `
        <div class="evidence-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="evidence-od">PN: ${r.pnHose || '-'}</span>
              <div style="font-size: 11px; color: var(--accent-primary); margin-top: 2px;">
                PO Subcon: <strong>${r.poSubconRef || '-'}</strong>
              </div>
            </div>
            <span class="evidence-timestamp">${r.timestamp}</span>
          </div>

          <div class="evidence-detail-row" style="margin-top: 8px;">
            <span>👨‍🔧 PIC: <strong>${r.picHose}</strong></span>
            <span>📐 Sudut: <strong>${r.angle}°</strong></span>
          </div>

          ${r.remarks ? `
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 6px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: var(--radius-sm);">
              💬 <em>${r.remarks}</em>
            </div>
          ` : ''}

          ${photos.length > 0 ? `
            <div style="margin-top: 10px; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
              <div style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 6px;">FOTO INSPEKSI DRIVE:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${photos.map(p => `
                  <a href="${p.url}" target="_blank" class="evidence-photo-link" style="font-size: 10.5px; padding: 4px 8px;">
                    📷 ${p.title} ↗
                  </a>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }
};
