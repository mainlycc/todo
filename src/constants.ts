/** Wspólny identyfikator użytkownika (tryb bez logowania) — musi być zgodny z politykami RLS / insertami w Supabase */
export const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Opcje pola Select „Typ notatki” w bazie Pomysły w Notion — nazwy muszą być identyczne jak w Notion.
 * Opcjonalnie w `.env`: NOTION_POMYSLY_NOTE_TYPE_PROPERTY — dokładna nazwa kolumny z API, jeśli nie wykryje się „Typ notatki”.
 */
export const IDEA_NOTE_TYPE_OPTIONS = [
  'Pomysł',
  'Inspiracja',
  'Pomysł na biznes',
  'Przemyślenia osobiste',
  'Prompt',
  'Notatka edukacyjna',
] as const;

export type IdeaNoteType = (typeof IDEA_NOTE_TYPE_OPTIONS)[number];
