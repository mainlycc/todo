-- Dodaje licznik (np. wysłane CV / zapytania) do zadań
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS metric_kind TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS metric_count INTEGER DEFAULT 0;

