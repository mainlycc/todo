-- Tabela projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    color TEXT,
    link TEXT,
    emoji TEXT,
    type TEXT,
    tasks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Włączenie Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Utworzenie polityk dostępu (Policies) - pozwalają na wszystkie operacje (odczyt, zapis, usuwanie)
CREATE POLICY "Allow all operations for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
