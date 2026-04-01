-- Wpłaty: możliwość przypisania do projektu
-- Uruchom w Supabase SQL Editor po schema.sql i 02_projects.sql

-- UWAGA: `projects.id` jest typu TEXT, więc `payments.project_id` też musi być TEXT.
-- Jeśli wcześniej dodałeś błędną kolumnę UUID, odpal najpierw sekcję NAPRAWA.

-- NAPRAWA (jeśli już próbowałeś dodać UUID/FK i wysypało się):
-- (Supabase potrafi zostawić kolumnę lub constraint w częściowym stanie)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_project_id_fkey;
ALTER TABLE payments DROP COLUMN IF EXISTS project_id;

-- Poprawna wersja:
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;

