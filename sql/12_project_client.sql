-- Dodanie możliwości przypisania klienta do projektu
-- - client_name: nazwa klienta (także dla ręcznego wpisu)
-- - client_notion_page_id: opcjonalny identyfikator strony Notion, gdy klient wybrany z kopii `notion_clients`

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_notion_page_id TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_client_notion_page_id ON projects (client_notion_page_id);
