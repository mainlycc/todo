-- Typ notatki (jak Select „Typ notatki” w Notion) — uruchom w Supabase SQL Editor po sql/13_ideas.sql
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS note_type TEXT;
