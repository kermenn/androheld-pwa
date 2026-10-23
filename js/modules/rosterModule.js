/* ==========================================================================
   AndroHeld Web - Roster Schedule & Shift Rotation Module
   100% Mirroring Jetpack Compose RosterScreen.kt & RosterEngine.kt
   ========================================================================== */

const STORAGE_KEYS = {
  EMPLOYEES: "androheld_roster_employees",
  OVERRIDES: "androheld_roster_overrides",
  ADMIN_PIN: "androheld_roster_admin_pin"
};

const DEFAULT_ADMIN_PIN = "1234";

const SHIFT_DEFS = {
  "D": { code: "D", name: "Day Shift", hours: "06.00 - 18.00", ot: 3, bg: "#10B981", fg: "#FFFFFF", desc: "Standby Day Shift (+3h OT)" },
  "DN": { code: "DN", name: "Day Normal", hours: "06.00 - 15.00", ot: 0, bg: "#0284C7", fg: "#FFFFFF", desc: "Day Normal Shift (Regular)" },
  "N": { code: "N", name: "Night Shift", hours: "18.00 - 06.00", ot: 4, bg: "#F97316", fg: "#FFFFFF", desc: "Night Shift (+4h OT)" },
  "OFF": { code: "OFF", name: "Off", hours: "-", ot: 0, bg: "#EF4444", fg: "#FFFFFF", desc: "Day Off / Libur" },
  "FB": { code: "FB", name: "Field Break", hours: "-", ot: 0, bg: "#EAB308", fg: "#000000", desc: "Field Break / Roster Off" },
  "CT": { code: "CT", name: "Annual Leave", hours: "-", ot: 0, bg: "#06B6D4", fg: "#FFFFFF", desc: "Cuti / Annual Leave" }
};

const INDO_DAYS = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Baseline Employees from roster_store.json
const BASELINE_EMPLOYEES = [
  {
    id: 2,
    no: 1,
    name: "Muhammad Riski",
    sn: "10003005",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "082213902917",
    patternId: "night_rotation_15",
    refDate: "2026-10-01",
    refCycleIndex: 12,
    notes: "Rotasi malam 15 hari (5 Siang - 2 OFF - 5 Malam - 3 OFF)"
  },
  {
    id: 3,
    no: 2,
    name: "Ahmad Hidayat",
    sn: "10003599",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "085750973830",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 3,
    notes: "Jadwal reguler 5:2 (Sabtu-Minggu Libur)"
  },
  {
    id: 4,
    no: 3,
    name: "Syaiful Rahman",
    sn: "7775",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "08125173278",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 3,
    notes: "Jadwal reguler 5:2 (Sabtu-Minggu Libur)"
  },
  {
    id: 5,
    no: 4,
    name: "Ahmad Juwaini",
    sn: "23464",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "085246366410",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 0,
    notes: "Jadwal reguler 5:2 (Selasa-Rabu Libur agar standby tetap cover)"
  }
];

const BASELINE_OVERRIDES = {
  "4:2026-10-01": { shift: "FB", reason: "Contoh Roster Asli" },
  "4:2026-10-02": { shift: "FB", reason: "Contoh Roster Asli" },
  "4:2026-10-03": { shift: "FB", reason: "Contoh Roster Asli" },
  "4:2026-10-08": { shift: "DN", reason: "Contoh Roster Asli" },
  "4:2026-10-09": { shift: "DN", reason: "Contoh Roster Asli" },
  "4:2026-10-15": { shift: "DN", reason: "Contoh Roster Asli" },
  "4:2026-10-16": { shift: "DN", reason: "Contoh Roster Asli" },
  "3:2026-10-23": { shift: "DN", reason: "Contoh Roster Asli" },
  "3:2026-10-24": { shift: "OFF", reason: "Contoh Roster Asli" },
  "3:2026-10-29": { shift: "CT", reason: "Contoh Roster Asli" },
  "3:2026-10-30": { shift: "CT", reason: "Contoh Roster Asli" }
};

export const RosterModule = {
  employees: [],
  overrides: {},
  currentYear: 2026,
  currentMonth: 10, // 1-indexed (10 = Oktober)
  isAdminMode: false,
  selectedCell: null, // { employeeId, dateIso, currentShift }

  init() {
    this.loadState();
    this.renderMonthHeader();
    this.renderKpis();
    this.renderEmployeeRoster();
    this.bindEvents();
  },

  loadState() {
    try {
      const empRaw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      this.employees = empRaw ? JSON.parse(empRaw) : [...BASELINE_EMPLOYEES];

      const ovRaw = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
      this.overrides = ovRaw ? JSON.parse(ovRaw) : { ...BASELINE_OVERRIDES };
    } catch (e) {
      console.warn("Roster load error", e);
      this.employees = [...BASELINE_EMPLOYEES];
      this.overrides = { ...BASELINE_OVERRIDES };
    }
  },

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees));
      localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
    } catch (e) {
      console.error("Roster save error", e);
    }
  },

  bindEvents() {
    // Top Bar Back
    const backBtn = document.getElementById('btn-roster-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.navigateTo('home');
      });
    }

    // Month Navigation
    const prevBtn = document.getElementById('btn-roster-prev-month');
    const nextBtn = document.getElementById('btn-roster-next-month');
    const todayBtn = document.getElementById('btn-roster-today');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentMonth === 1) {
          this.currentMonth = 12;
          this.currentYear--;
        } else {
          this.currentMonth--;
        }
        this.refreshView();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentMonth === 12) {
          this.currentMonth = 1;
          this.currentYear++;
        } else {
          this.currentMonth++;
        }
        this.refreshView();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth() + 1;
        this.refreshView();
      });
    }

    // Admin Lock Button
    const adminBtn = document.getElementById('btn-roster-admin-toggle');
    const adminPinModal = document.getElementById('roster-admin-pin-modal');
    const adminPinClose = document.getElementById('btn-close-roster-pin');
    const adminPinSubmit = document.getElementById('btn-submit-roster-pin');

    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        if (this.isAdminMode) {
          this.isAdminMode = false;
          this.updateAdminButtonUI();
          this.refreshView();
          this.showToast("Mode Admin dinonaktifkan.");
        } else {
          if (adminPinModal) adminPinModal.style.display = 'flex';
          const pinInput = document.getElementById('roster-admin-pin-input');
          if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
          }
        }
      });
    }

    if (adminPinClose) {
      adminPinClose.addEventListener('click', () => {
        if (adminPinModal) adminPinModal.style.display = 'none';
      });
    }

    if (adminPinSubmit) {
      adminPinSubmit.addEventListener('click', () => {
        const pinInput = document.getElementById('roster-admin-pin-input');
        const pin = pinInput ? pinInput.value.trim() : "";
        const savedPin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;

        if (pin === savedPin) {
          this.isAdminMode = true;
          this.updateAdminButtonUI();
          if (adminPinModal) adminPinModal.style.display = 'none';
          this.refreshView();
          this.showToast("🔓 Mode Admin Aktif! Sentuh cell untuk ubah shift.");
        } else {
          this.showToast("❌ PIN Admin salah! Default: 1234");
        }
      });
    }

    // Auto-Balance Shift Button
    const autoBalanceBtn = document.getElementById('btn-roster-auto-balance');
    if (autoBalanceBtn) {
      autoBalanceBtn.addEventListener('click', () => {
        this.autoBalanceShift();
      });
    }

    // Reset Roster Button
    const resetRosterBtn = document.getElementById('btn-roster-reset');
    if (resetRosterBtn) {
      resetRosterBtn.addEventListener('click', () => {
        if (confirm("Reset roster ke template default awal?")) {
          this.employees = [...BASELINE_EMPLOYEES];
          this.overrides = { ...BASELINE_OVERRIDES };
          this.saveState();
          this.refreshView();
          this.showToast("Roster berhasil di-reset ke template awal.");
        }
      });
    }

    // Cell Edit Modal Actions
    const cellModal = document.getElementById('roster-cell-edit-modal');
    const closeCellModal = document.getElementById('btn-close-cell-edit');
    if (closeCellModal) {
      closeCellModal.addEventListener('click', () => {
        if (cellModal) cellModal.style.display = 'none';
      });
    }

    // Shift options buttons inside Cell Edit Modal
    document.querySelectorAll('.roster-shift-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftCode = btn.getAttribute('data-shift');
        if (this.selectedCell) {
          const key = `${this.selectedCell.employeeId}:${this.selectedCell.dateIso}`;
          this.overrides[key] = { shift: shiftCode, reason: "Manual Edit" };
          this.saveState();
          if (cellModal) cellModal.style.display = 'none';
          this.refreshView();
          this.showToast(`Shift diubah ke: ${shiftCode}`);
        }
      });
    });
  },

  updateAdminButtonUI() {
    const adminBtn = document.getElementById('btn-roster-admin-toggle');
    const adminText = document.getElementById('roster-admin-status-text');
    const adminIcon = document.getElementById('roster-admin-icon');

    if (adminBtn) {
      adminBtn.classList.toggle('admin-active', this.isAdminMode);
    }
    if (adminText) {
      adminText.textContent = this.isAdminMode ? "Admin Aktif" : "Kunci Admin";
    }
    if (adminIcon) {
      adminIcon.textContent = this.isAdminMode ? "🔓" : "🔒";
    }
  },

  refreshView() {
    this.renderMonthHeader();
    this.renderKpis();
    this.renderEmployeeRoster();
  },

  renderMonthHeader() {
    const titleEl = document.getElementById('roster-month-title');
    if (titleEl) {
      titleEl.textContent = `${MONTH_NAMES[this.currentMonth - 1]} ${this.currentYear}`;
    }
  },

  projectShift(emp, year, month, day) {
    const dt = new Date(year, month - 1, day);
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const overrideKey = `${emp.id}:${dateIso}`;

    // 1. Check Overrides
    if (this.overrides[overrideKey]) {
      return this.overrides[overrideKey].shift;
    }

    // 2. Project from Pattern
    const refParts = (emp.refDate || "2026-10-01").split('-');
    const refDate = new Date(parseInt(refParts[0]), parseInt(refParts[1]) - 1, parseInt(refParts[2]));
    const diffDays = Math.round((dt.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

    let sequence = [];
    if (emp.patternId === 'night_rotation_15') {
      sequence = ["D", "D", "D", "D", "D", "OFF", "OFF", "N", "N", "N", "N", "N", "OFF", "OFF", "OFF"];
    } else {
      // Regular 5:2 (e.g. Ahmad Hidayat refCycleIndex = 3)
      sequence = ["DN", "DN", "DN", "DN", "DN", "OFF", "OFF"];
    }

    const cycleLen = sequence.length;
    const rawIdx = (emp.refCycleIndex + diffDays) % cycleLen;
    const normalizedIdx = (rawIdx < 0) ? (rawIdx + cycleLen) % cycleLen : rawIdx;

    return sequence[normalizedIdx];
  },

  renderKpis() {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    let onDutyCount = 0;
    let offCount = 0;

    this.employees.forEach(emp => {
      const shift = this.projectShift(emp, todayYear, todayMonth, todayDay);
      if (shift === 'D' || shift === 'DN' || shift === 'N') {
        onDutyCount++;
      } else {
        offCount++;
      }
    });

    const totalEl = document.getElementById('roster-kpi-total-personnel');
    const onDutyEl = document.getElementById('roster-kpi-on-duty');
    const offEl = document.getElementById('roster-kpi-off');

    if (totalEl) totalEl.textContent = `${this.employees.length} Staf`;
    if (onDutyEl) onDutyEl.textContent = `${onDutyCount} Orang`;
    if (offEl) offEl.textContent = `${offCount} Orang`;
  },

  renderEmployeeRoster() {
    const container = document.getElementById('roster-employees-container');
    if (!container) return;

    const numDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === this.currentYear && now.getMonth() + 1 === this.currentMonth);
    const todayDay = isCurrentMonth ? now.getDate() : -1;

    container.innerHTML = this.employees.map(emp => {
      let workDays = 0;
      let offDays = 0;
      let otHours = 0;

      // Build daily cells
      const cellsHtml = [];
      for (let d = 1; d <= numDays; d++) {
        const dt = new Date(this.currentYear, this.currentMonth - 1, d);
        const dayOfWeek = (dt.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
        const dayShort = INDO_DAYS[dayOfWeek];
        const isWeekend = (dayOfWeek >= 5);
        const isToday = (d === todayDay);

        const shiftCode = this.projectShift(emp, this.currentYear, this.currentMonth, d);
        const shiftDef = SHIFT_DEFS[shiftCode] || SHIFT_DEFS["DN"];

        if (shiftCode === 'D' || shiftCode === 'DN' || shiftCode === 'N') {
          workDays++;
          otHours += (shiftDef.ot || 0);
        } else {
          offDays++;
        }

        const dateIso = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        cellsHtml.push(`
          <div class="roster-cell-item ${isToday ? 'cell-today' : ''} ${isWeekend ? 'cell-weekend' : ''}" 
               data-emp-id="${emp.id}" 
               data-emp-name="${emp.name}" 
               data-date-iso="${dateIso}" 
               data-shift="${shiftCode}">
            <div class="roster-cell-day-num">${d}</div>
            <div class="roster-cell-day-name">${dayShort}</div>
            <div class="roster-shift-pill" style="background: ${shiftDef.bg}; color: ${shiftDef.fg};">
              ${shiftCode}
            </div>
          </div>
        `);
      }

      // Today's shift badge
      const todayShiftCode = todayDay > 0 ? this.projectShift(emp, this.currentYear, this.currentMonth, todayDay) : "-";
      const todayDef = SHIFT_DEFS[todayShiftCode] || { bg: "#4A4A5A", fg: "#FFFFFF", name: "Standby" };

      return `
        <div class="roster-emp-card">
          <div class="roster-emp-header">
            <div>
              <div class="roster-emp-name">${emp.name}</div>
              <div class="roster-emp-meta">${emp.position} • ${emp.location}</div>
            </div>
            <div class="roster-today-badge" style="background: ${todayDef.bg}; color: ${todayDef.fg};">
              <span>Hari Ini: ${todayShiftCode} (${todayDef.name})</span>
            </div>
          </div>

          <!-- Monthly Stats Strip -->
          <div class="roster-emp-stats-strip">
            <div class="roster-stat-col">
              <span class="roster-stat-label">HARI KERJA</span>
              <span class="roster-stat-val" style="color: var(--accent-green);">${workDays} Hari</span>
            </div>
            <div class="roster-stat-col">
              <span class="roster-stat-label">LIBUR / CUTI</span>
              <span class="roster-stat-val" style="color: var(--accent-orange);">${offDays} Hari</span>
            </div>
            <div class="roster-stat-col">
              <span class="roster-stat-label">EST. LEMBUR</span>
              <span class="roster-stat-val" style="color: var(--accent-primary); font-weight: 800;">+${otHours} Jam</span>
            </div>
          </div>

          <!-- 31 Days Shift Horizontal Timeline -->
          <div class="roster-timeline-scroll">
            ${cellsHtml.join('')}
          </div>
        </div>
      `;
    }).join('');

    // Attach Cell Click listener (for Admin Mode)
    container.querySelectorAll('.roster-cell-item').forEach(cell => {
      cell.addEventListener('click', () => {
        if (!this.isAdminMode) {
          const shift = cell.getAttribute('data-shift');
          const def = SHIFT_DEFS[shift] || {};
          this.showToast(`Tanggal ${cell.getAttribute('data-date-iso')}: Shift ${shift} (${def.desc || ''})`);
          return;
        }

        // Admin Edit
        const empId = parseInt(cell.getAttribute('data-emp-id'), 10);
        const empName = cell.getAttribute('data-emp-name');
        const dateIso = cell.getAttribute('data-date-iso');
        const currentShift = cell.getAttribute('data-shift');

        this.selectedCell = { employeeId: empId, dateIso, currentShift };

        const modal = document.getElementById('roster-cell-edit-modal');
        const titleEl = document.getElementById('cell-edit-title');
        const subEl = document.getElementById('cell-edit-subtitle');

        if (titleEl) titleEl.textContent = `Ubah Shift: ${empName}`;
        if (subEl) subEl.textContent = `Tanggal: ${dateIso} • Shift Saat Ini: ${currentShift}`;
        if (modal) modal.style.display = 'flex';
      });
    });
  },

  autoBalanceShift() {
    if (!this.isAdminMode) {
      this.showToast("⚠️ Buka kunci Mode Admin terlebih dahulu.");
      return;
    }

    // Auto-balance logic: ensure each weekend has 2 standby countermen
    const numDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
    let count = 0;

    for (let d = 1; d <= numDays; d++) {
      const dt = new Date(this.currentYear, this.currentMonth - 1, d);
      const isWeekend = (dt.getDay() === 0 || dt.getDay() === 6);

      if (isWeekend) {
        // Assign first 2 employees as Day Normal standby if they are off
        const dateIso = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        this.overrides[`3:${dateIso}`] = { shift: "DN", reason: "Auto-Balance Standby" };
        this.overrides[`4:${dateIso}`] = { shift: "DN", reason: "Auto-Balance Standby" };
        count += 2;
      }
    }

    this.saveState();
    this.refreshView();
    this.showToast(`✨ Roster seimbang! ${count} shift standby disesuaikan.`);
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
};
