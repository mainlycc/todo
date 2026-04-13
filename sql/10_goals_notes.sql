-- Notatki HTML (TipTap) przy każdym celu — uruchom w Supabase SQL Editor po wcześniejszych migracjach
ALTER TABLE goals ADD COLUMN IF NOT EXISTS notes TEXT;
