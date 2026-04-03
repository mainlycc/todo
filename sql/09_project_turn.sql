-- Projekty: czyja kolej w komunikacji (moja vs czekam na klienta)
-- Uruchom w Supabase SQL Editor po 08_project_priority.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS turn TEXT DEFAULT 'mine';
