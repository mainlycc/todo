-- Projekty: deadline (data) dla projektu
-- Uruchom w Supabase SQL Editor po 02_projects.sql / 03_extended.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline TEXT;

