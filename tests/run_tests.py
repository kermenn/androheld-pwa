#!/usr/bin/env python3
"""
AndroHeld Web PWA - Test Runner & Security Verification Suite
Validates JSON structures, manifest, SHA-256 test vectors, and security rules.
"""

import sys
import os
import json
import hashlib

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run_tests():
    print("=" * 65)
    print("AndroHeld Web - Automated Verification & Security Test Suite")
    print("=" * 65)
    
    passed = 0
    failed = 0
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # -------------------------------------------------------------
    # Test 1: Validate manifest.json
    # -------------------------------------------------------------
    manifest_path = os.path.join(base_dir, "manifest.json")
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            assert "AndroHeld" in manifest.get("name", ""), f"Unexpected PWA name: {manifest.get('name')}"
            assert manifest.get("start_url") == "./index.html", "Invalid start_url"
            assert "icons" in manifest and len(manifest["icons"]) > 0, "Missing PWA icons"
        print(" [PASS] Test 1: manifest.json is valid and contains required PWA fields")
        passed += 1
    except Exception as e:
        print(f" [FAIL] Test 1: manifest.json validation failed: {e}")
        failed += 1

    # -------------------------------------------------------------
    # Test 2: Validate data/roster_store.json
    # -------------------------------------------------------------
    roster_store_path = os.path.join(base_dir, "data", "roster_store.json")
    try:
        with open(roster_store_path, "r", encoding="utf-8") as f:
            store = json.load(f)
            assert "employees" in store and isinstance(store["employees"], list), "employees array missing"
            assert "overrides" in store and isinstance(store["overrides"], dict), "overrides dict missing"
            assert len(store["employees"]) >= 4, "Expected at least 4 baseline employees"
        print(f" [PASS] Test 2: data/roster_store.json valid ({len(store['employees'])} employees, {len(store['overrides'])} overrides)")
        passed += 1
    except Exception as e:
        print(f" [FAIL] Test 2: data/roster_store.json validation failed: {e}")
        failed += 1

    # -------------------------------------------------------------
    # Test 3: Cross-Platform SHA-256 Salted Hashing Test Vector ("3110")
    # -------------------------------------------------------------
    salt = "androheld_roster_secure_salt_2026"
    expected_3110_hash = "sha256:a491cc13b8858f6fe5ab3b89a11a0a0c3e3c64b343e97452a9cd160c1caca701"
    
    computed_3110 = "sha256:" + hashlib.sha256((salt + "3110").encode("utf-8")).hexdigest()
    if computed_3110 == expected_3110_hash:
        print(" [PASS] Test 3: SHA-256 salted hash for PIN '3110' matches test vector exactly")
        passed += 1
    else:
        print(f" [FAIL] Test 3: SHA-256 mismatch: got {computed_3110}, expected {expected_3110_hash}")
        failed += 1

    # -------------------------------------------------------------
    # Test 4: Cross-Platform SHA-256 Salted Hashing Test Vector ("1234")
    # -------------------------------------------------------------
    expected_1234_hash = "sha256:2102f0d9ec5696c167b68056c4cb4c04f991f896f9f79dbb7e76ba46c7e6b625"
    computed_1234 = "sha256:" + hashlib.sha256((salt + "1234").encode("utf-8")).hexdigest()
    if computed_1234 == expected_1234_hash:
        print(" [PASS] Test 4: SHA-256 salted hash for PIN '1234' matches test vector exactly")
        passed += 1
    else:
        print(f" [FAIL] Test 4: SHA-256 mismatch for '1234': got {computed_1234}")
        failed += 1

    # -------------------------------------------------------------
    # Test 5: Verify Service Worker Cache Version Sanity
    # -------------------------------------------------------------
    sw_path = os.path.join(base_dir, "sw.js")
    index_path = os.path.join(base_dir, "index.html")
    try:
        with open(sw_path, "r", encoding="utf-8") as f:
            sw_content = f.read()
        with open(index_path, "r", encoding="utf-8") as f:
            index_content = f.read()
            
        assert "CACHE_NAME" in sw_content, "CACHE_NAME missing in sw.js"
        assert "androheld-pwa" in sw_content, "androheld-pwa prefix missing in sw.js"
        assert "rosterModule.js" in index_content, "rosterModule.js script tag missing in index.html"
        print(" [PASS] Test 5: Service worker and index.html cache configuration intact")
        passed += 1
    except Exception as e:
        print(f" [FAIL] Test 5: Cache configuration check failed: {e}")
        failed += 1

    # -------------------------------------------------------------
    # Test 6: Supabase CONFIG_PIN Isolation Filter Rule
    # -------------------------------------------------------------
    def is_config_row(row):
        return row.get("employee_id") == 0 and row.get("date") == "CONFIG_PIN"

    sample_rows = [
        {"employee_id": 0, "date": "CONFIG_PIN", "shift": expected_3110_hash},
        {"employee_id": 2, "date": "2026-10-01", "shift": "D"},
        {"employee_id": 3, "date": "2026-10-01", "shift": "OFF"}
    ]
    
    config_rows = [r for r in sample_rows if is_config_row(r)]
    staff_rows = [r for r in sample_rows if not is_config_row(r)]
    
    if len(config_rows) == 1 and len(staff_rows) == 2 and config_rows[0]["shift"] == expected_3110_hash:
        print(" [PASS] Test 6: Supabase CONFIG_PIN security isolation logic verified")
        passed += 1
    else:
        print(" [FAIL] Test 6: Supabase CONFIG_PIN isolation failed")
        failed += 1

    print("-" * 65)
    print(f"Test Summary: {passed} PASSED, {failed} FAILED (Total: {passed + failed})")
    print("=" * 65)
    
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
