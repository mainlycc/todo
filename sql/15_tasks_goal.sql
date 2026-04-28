-- Powiązanie zadań z celami (Goals) — uruchom w Supabase SQL Editor
-- Pozwala przypisać normalne zadanie (tabela `tasks`) do celu przez `goal_id`,
-- tak żeby pojawiało się na głównym wallu / w kolejce jak każde inne zadanie.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id UUID;

-- Opcjonalnie: indeks przyspieszający filtrowanie po celu
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);

-- Opcjonalnie: relacja (FK). Jeśli masz już `goals.id` jako UUID.
DO $$
BEGIN
  ALTER TABLE tasks
    ADD CONSTRAINT tasks_goal_id_fkey
    FOREIGN KEY (goal_id) REFERENCES goals(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

