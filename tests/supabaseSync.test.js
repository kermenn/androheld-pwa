import { describe, it, expect } from 'vitest';

function parseSupabaseOverrides(rawRows) {
  let adminPin = null;
  const employeeOverrides = {};

  rawRows.forEach(item => {
    if (item.employee_id === 0 && item.date === 'CONFIG_PIN') {
      adminPin = item.shift;
    } else if (item.employee_id > 0 && item.date) {
      employeeOverrides[`${item.employee_id}:${item.date}`] = {
        shift: item.shift,
        reason: item.reason || 'Supabase Sync'
      };
    }
  });

  return { adminPin, employeeOverrides };
}

function buildAdminPinPayload(hashedPin) {
  return [{
    employee_id: 0,
    date: 'CONFIG_PIN',
    shift: hashedPin,
    reason: 'ADMIN_PIN'
  }];
}

describe("Supabase Cloud Sync & Security Protocol Tests", () => {
  it("strictly separates config PIN rows from employee schedule overrides", () => {
    const rawRows = [
      { employee_id: 0, date: 'CONFIG_PIN', shift: 'sha256:a491cc13...', reason: 'ADMIN_PIN' },
      { employee_id: 2, date: '2026-10-15', shift: 'OFF', reason: 'Cuti Tahunan' },
      { employee_id: 3, date: '2026-10-16', shift: 'D', reason: 'Tukar Shift' }
    ];

    const result = parseSupabaseOverrides(rawRows);

    expect(result.adminPin).toBe('sha256:a491cc13...');
    expect(result.employeeOverrides['0:CONFIG_PIN']).toBeUndefined();
    expect(Object.keys(result.employeeOverrides).length).toBe(2);
    expect(result.employeeOverrides['2:2026-10-15'].shift).toBe('OFF');
  });

  it("builds valid batch upsert payload for Admin PIN with employee_id = 0", () => {
    const payload = buildAdminPinPayload('sha256:test_hash_value');
    expect(payload).toHaveLength(1);
    expect(payload[0].employee_id).toBe(0);
    expect(payload[0].date).toBe('CONFIG_PIN');
    expect(payload[0].shift).toBe('sha256:test_hash_value');
  });

  it("ignores invalid or negative employee IDs from cloud feed", () => {
    const rawRows = [
      { employee_id: -1, date: '2026-10-15', shift: 'D' },
      { employee_id: 0, date: '2026-10-15', shift: 'D' } // Non-config row with ID 0
    ];

    const result = parseSupabaseOverrides(rawRows);
    expect(Object.keys(result.employeeOverrides).length).toBe(0);
    expect(result.adminPin).toBeNull();
  });

  it("enforces RLS WITH CHECK policy rules against unauthorized payload structures", () => {
    function evaluateRlsWithCheck(employee_id, date, shift) {
      const isStaffValid = employee_id > 0 && typeof date === 'string' && date.length === 10 && typeof shift === 'string' && shift.length <= 10;
      const isConfigValid = employee_id === 0 && date === 'CONFIG_PIN' && typeof shift === 'string' && (shift.startsWith('sha256:') || shift.length >= 4);
      return isStaffValid || isConfigValid;
    }

    // Valid inputs
    expect(evaluateRlsWithCheck(2, '2026-10-24', 'D')).toBe(true);
    expect(evaluateRlsWithCheck(0, 'CONFIG_PIN', 'sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701')).toBe(true);

    // Invalid / tampering attempts
    expect(evaluateRlsWithCheck(-1, '2026-10-24', 'D')).toBe(false);
    expect(evaluateRlsWithCheck(0, '2026-10-24', 'D')).toBe(false);
    expect(evaluateRlsWithCheck(0, 'CONFIG_PIN', '')).toBe(false);
    expect(evaluateRlsWithCheck(2, '24-10-2026', 'D')).toBe(false); // bad date format
  });
});
