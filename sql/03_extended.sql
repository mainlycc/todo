-- Rozszerzenie schematu: harmonogramy, cele, karty zasad, kolejność zadań, typ projektu
-- Uruchom w Supabase SQL Editor po schema.sql i 02_projects.sql

-- Harmonogram dnia (wcześniej używany w aplikacji bez definicji w repozytorium)
CREATE TABLE IF NOT EXISTS daily_timelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date TEXT NOT NULL,
    wake_up_time TEXT,
    sleep_time TEXT,
    events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

ALTER TABLE daily_timelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for daily_timelines" ON daily_timelines;
CREATE POLICY "Allow all operations for daily_timelines" ON daily_timelines FOR ALL USING (true) WITH CHECK (true);

-- Cele (wcześniej tylko localStorage)
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subtasks JSONB DEFAULT '[]'::jsonb,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for goals" ON goals;
CREATE POLICY "Allow all operations for goals" ON goals FOR ALL USING (true) WITH CHECK (true);

-- Karty zasad
CREATE TABLE IF NOT EXISTS rule_cards (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE rule_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for rule_cards" ON rule_cards;
CREATE POLICY "Allow all operations for rule_cards" ON rule_cards FOR ALL USING (true) WITH CHECK (true);

-- Kolejność zadań na listach (dzień / kolejka)
CREATE TABLE IF NOT EXISTS user_task_order (
    user_id UUID PRIMARY KEY,
    order_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_task_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for user_task_order" ON user_task_order;
CREATE POLICY "Allow all operations for user_task_order" ON user_task_order FOR ALL USING (true) WITH CHECK (true);

-- Projekty: typ OWN/CLI (używany w UI)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT;
