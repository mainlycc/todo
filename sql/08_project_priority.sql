-- Projekty: priorytet domyślny dla zadań w projekcie
-- Uruchom w Supabase SQL Editor po 04_project_deadline.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

