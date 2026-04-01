-- 7. Tabela daily_timelines (harmonogram dnia + wydarzenia z godziną)
-- Przechowuje zdarzenia jako JSONB (events[]), unikalne per user_id + date.
CREATE TABLE IF NOT EXISTS daily_timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date TEXT NOT NULL,
    wake_up_time TEXT,
    sleep_time TEXT,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

ALTER TABLE daily_timelines ENABLE ROW LEVEL SECURITY;

-- Uwaga: ponowne uruchomienie migracji nie może wysypać się na istniejącej policy
DROP POLICY IF EXISTS "Allow all operations for daily_timelines" ON daily_timelines;

CREATE POLICY "Allow all operations for daily_timelines"
  ON daily_timelines
  FOR ALL
  USING (true)
  WITH CHECK (true);

