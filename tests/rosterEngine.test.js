import { describe, it, expect } from 'vitest';

function projectShift(emp, year, month, day, overrides = {}) {
  const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const overrideKey = `${emp.id}:${dateIso}`;

  if (overrides[overrideKey]) {
    return overrides[overrideKey].shift;
  }

  const dt = new Date(year, month - 1, day);
  const refDateStr = emp.refDate || "2026-10-01";
  const refParts = refDateStr.split('-');
  const refDt = new Date(parseInt(refParts[0]), parseInt(refParts[1]) - 1, parseInt(refParts[2]));

  const diffMs = dt.getTime() - refDt.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let sequence = ["DN", "DN", "DN", "DN", "DN", "OFF", "OFF"];

  if (emp.patternId === "night_rotation_15") {
    sequence = [
      "D", "D", "D", "D", "D",
      "OFF", "OFF",
      "N", "N", "N", "N", "N",
      "OFF", "OFF", "OFF"
    ];
  } else if (emp.name === "Ahmad Juwaini") {
    sequence = ["DN", "OFF", "OFF", "DN", "DN", "D", "D"];
  }

  const cycleLen = sequence.length;
  const startIdx = emp.refCycleIndex || 0;
  const rawIdx = (startIdx + (diffDays % cycleLen)) % cycleLen;
  const idx = rawIdx < 0 ? rawIdx + cycleLen : rawIdx;

  return sequence[idx];
}

describe("Roster Schedule Engine & Rotation Tests", () => {
  const ahmadHidayat = {
    id: 3,
    name: "Ahmad Hidayat",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 3 // Oct 1, 2026 is Thursday (index 3 in DN,DN,DN,DN,DN,OFF,OFF)
  };

  const muhammadRiski = {
    id: 2,
    name: "Muhammad Riski",
    patternId: "night_rotation_15",
    refDate: "2026-10-01",
    refCycleIndex: 12
  };

  const ahmadJuwaini = {
    id: 5,
    name: "Ahmad Juwaini",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 0
  };

  it("projects correct weekday and weekend shifts for regular 5:2 worker", () => {
    // Oct 1, 2026 is Thursday -> DN
    expect(projectShift(ahmadHidayat, 2026, 10, 1)).toBe("DN");
    // Oct 2, 2026 is Friday -> DN
    expect(projectShift(ahmadHidayat, 2026, 10, 2)).toBe("DN");
    // Oct 3, 2026 is Saturday -> OFF
    expect(projectShift(ahmadHidayat, 2026, 10, 3)).toBe("OFF");
    // Oct 4, 2026 is Sunday -> OFF
    expect(projectShift(ahmadHidayat, 2026, 10, 4)).toBe("OFF");
    // Oct 5, 2026 is Monday -> DN
    expect(projectShift(ahmadHidayat, 2026, 10, 5)).toBe("DN");
  });

  it("projects 15-day night rotation accurately across cycle boundaries", () => {
    // Muhammad Riski starts at cycle index 12 on Oct 1 (sequence length 15)
    // 15-day sequence: 0..4: D, 5..6: OFF, 7..11: N, 12..14: OFF
    expect(projectShift(muhammadRiski, 2026, 10, 1)).toBe("OFF"); // index 12
    expect(projectShift(muhammadRiski, 2026, 10, 2)).toBe("OFF"); // index 13
    expect(projectShift(muhammadRiski, 2026, 10, 3)).toBe("OFF"); // index 14
    expect(projectShift(muhammadRiski, 2026, 10, 4)).toBe("D");   // index 0 -> Day Shift
  });

  it("prioritizes database overrides over baseline pattern projection", () => {
    const overrides = {
      "3:2026-10-03": { shift: "D", reason: "Standby Coverage Weekend" }
    };
    // Normally OFF on Saturday Oct 3, but override makes it D
    expect(projectShift(ahmadHidayat, 2026, 10, 3, overrides)).toBe("D");
  });

  it("maintains Ahmad Juwaini's weekend standby rotation", () => {
    // Ahmad Juwaini sequence: ["DN", "OFF", "OFF", "DN", "DN", "D", "D"]
    // Oct 1 (idx 0): DN
    // Oct 2 (idx 1): OFF
    // Oct 3 (idx 2): OFF
    // Oct 4 (idx 3): DN
    // Oct 5 (idx 4): DN
    // Oct 6 (idx 5): D
    // Oct 7 (idx 6): D
    expect(projectShift(ahmadJuwaini, 2026, 10, 1)).toBe("DN");
    expect(projectShift(ahmadJuwaini, 2026, 10, 2)).toBe("OFF");
  });
});
