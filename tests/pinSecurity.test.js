import { describe, it, expect } from 'vitest';

const PIN_SALT = "androheld_roster_secure_salt_2026";

async function hashAdminPin(plainPin) {
  const clean = (plainPin || "").trim();
  const msgBuffer = new TextEncoder().encode(PIN_SALT + clean);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hashHex}`;
}

async function verifyAdminPin(enteredPin, storedPin) {
  const clean = (enteredPin || "").trim();
  const stored = (storedPin || "").trim();
  if (!clean || !stored) return false;
  if (stored.startsWith("sha256:")) {
    const hashed = await hashAdminPin(clean);
    return hashed === stored;
  }
  return clean === stored;
}

describe("Roster Admin PIN Security & Hashing Tests", () => {
  it("computes exact SHA-256 salted hash matching cross-platform vector for '3110'", async () => {
    const hash = await hashAdminPin("3110");
    expect(hash).toBe("sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701");
  });

  it("computes exact SHA-256 salted hash matching cross-platform vector for default '1234'", async () => {
    const hash = await hashAdminPin("1234");
    expect(hash).toBe("sha256:2102f0d9ec5696c167b68056c4cb4c04f991f896f9f79dbb7e76ba46c7e6b625");
  });

  it("successfully verifies valid entered PIN against hashed stored PIN", async () => {
    const storedHash = "sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701";
    const isValid = await verifyAdminPin("3110", storedHash);
    expect(isValid).toBe(true);
  });

  it("rejects invalid PIN against hashed stored PIN", async () => {
    const storedHash = "sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701";
    expect(await verifyAdminPin("1234", storedHash)).toBe(false);
    expect(await verifyAdminPin("0000", storedHash)).toBe(false);
    expect(await verifyAdminPin("admin", storedHash)).toBe(false);
  });

  it("supports backward compatibility with legacy plain text PIN during migration", async () => {
    const legacyStored = "3110";
    expect(await verifyAdminPin("3110", legacyStored)).toBe(true);
    expect(await verifyAdminPin("1234", legacyStored)).toBe(false);
  });

  it("rejects empty or whitespace PIN inputs", async () => {
    const storedHash = "sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701";
    expect(await verifyAdminPin("", storedHash)).toBe(false);
    expect(await verifyAdminPin("   ", storedHash)).toBe(false);
    expect(await verifyAdminPin("3110", "")).toBe(false);
  });
});
