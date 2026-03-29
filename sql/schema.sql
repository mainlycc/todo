-- Włącz rozszerzenie UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela recurring_tasks (szablony zadań cyklicznych)
CREATE TABLE IF NOT EXISTS recurring_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT,
    due_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela tasks (główne zadania)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT,
    notes TEXT,
    pomodoros_completed INTEGER DEFAULT 0,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_template_id UUID REFERENCES recurring_tasks(id) ON DELETE SET NULL,
    due_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela subtasks (podzadania)
-- Kluczowe: ON DELETE CASCADE sprawia, że usunięcie zadania usuwa też jego podzadania
CREATE TABLE IF NOT EXISTS subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela payments (płatności)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    net_amount NUMERIC NOT NULL,
    gross_amount NUMERIC NOT NULL,
    is_realized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela daily_notes (notatki dzienne)
CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Włączenie Row Level Security (RLS)
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

-- Utworzenie polityk dostępu (Policies) - pozwalają na wszystkie operacje (odczyt, zapis, usuwanie)
-- W środowisku produkcyjnym warto je ograniczyć tylko do zalogowanego użytkownika (auth.uid() = user_id)
CREATE POLICY "Allow all operations for recurring_tasks" ON recurring_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for subtasks" ON subtasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for daily_notes" ON daily_notes FOR ALL USING (true) WITH CHECK (true);
