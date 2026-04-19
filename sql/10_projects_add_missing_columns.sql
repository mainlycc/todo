-- Uzupełnij kolumny w `projects`, jeśli tabela powstała ze starszego skryptu.
-- Bezpieczne wielokrotne uruchomienie (IF NOT EXISTS).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS turn TEXT DEFAULT 'mine';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]'::jsonb;
