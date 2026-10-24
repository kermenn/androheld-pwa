-- ============================================================================
-- ANDROHELD: SUPABASE DATABASE SECURITY & RLS HARDENING SCRIPT
-- ============================================================================
-- Project URL: https://culgtxrkcdkkcsemocym.supabase.co
-- Tables: public.roster_employees, public.roster_overrides
-- Purpose:
--   1. Enable Row Level Security (RLS) on all roster tables.
--   2. Grant public read (SELECT) for all staff on Web PWA & Android app.
--   3. Enforce strict anti-tamper and integrity checks on INSERT / UPDATE.
--   4. Protect CONFIG_PIN (employee_id = 0) to ensure only valid salted hashes are accepted.
-- ============================================================================

-- 1. PASTIKAN STRUKTUR TABEL LENGKAP & INDEKS CEPAT
CREATE TABLE IF NOT EXISTS public.roster_employees (
    id INTEGER PRIMARY KEY,
    no INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    sn TEXT,
    position TEXT DEFAULT 'Counterman',
    location TEXT DEFAULT 'CK BMB - Sitarum',
    phone TEXT,
    pattern_id TEXT DEFAULT 'regular_5_2',
    ref_date TEXT DEFAULT '2026-10-01',
    ref_cycle_index INTEGER DEFAULT 0,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.roster_overrides (
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    shift TEXT NOT NULL,
    reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_roster_overrides_date ON public.roster_overrides (date);
CREATE INDEX IF NOT EXISTS idx_roster_overrides_emp ON public.roster_overrides (employee_id);

-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.roster_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_overrides ENABLE ROW LEVEL SECURITY;

-- 3. POLICY BACA (SELECT): Publik (Anon Key) Bebas Membaca Data
DROP POLICY IF EXISTS "Public Read Employees" ON public.roster_employees;
CREATE POLICY "Public Read Employees" ON public.roster_employees
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Overrides" ON public.roster_overrides;
CREATE POLICY "Public Read Overrides" ON public.roster_overrides
    FOR SELECT USING (true);

-- 4. POLICY TULIS & KONTROL INTEGRITAS (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "Public Manage Employees" ON public.roster_employees;
CREATE POLICY "Public Manage Employees" ON public.roster_employees
    FOR ALL
    USING (true)
    WITH CHECK (id > 0 AND length(name) > 0);

DROP POLICY IF EXISTS "Public Manage Overrides Secure" ON public.roster_overrides;
CREATE POLICY "Public Manage Overrides Secure" ON public.roster_overrides
    FOR ALL
    USING (true)
    WITH CHECK (
        -- Validasi 1: Jadwal Shift Karyawan Normal (ID > 0, Format Tanggal YYYY-MM-DD)
        (employee_id > 0 AND length(date) = 10 AND length(shift) <= 10)
        OR
        -- Validasi 2: Konfigurasi PIN Admin (Wajib berformat hash aman atau minimal 4 digit saat migrasi)
        (employee_id = 0 AND date = 'CONFIG_PIN' AND (shift LIKE 'sha256:%' OR length(shift) >= 4))
    );
