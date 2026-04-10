import type { LucideIcon } from 'lucide-react';
import {
  UserSearch,
  Sparkles,
  Shirt,
  Mail,
  Laptop,
  ShoppingBasket,
} from 'lucide-react';

/** Szybkie zadania na dziś — tylko ikona, pełny opis w atrybucie title. */
export const QUICK_TODAY_PRESETS: { title: string; Icon: LucideIcon; hint: string }[] = [
  { title: 'Szukanie klientów', Icon: UserSearch, hint: 'Dodaj zadanie: szukanie klientów' },
  { title: 'Sprzątanie', Icon: Sparkles, hint: 'Dodaj zadanie: sprzątanie' },
  { title: 'Pranie', Icon: Shirt, hint: 'Dodaj zadanie: pranie' },
  { title: 'Poczta i follow-up', Icon: Mail, hint: 'Dodaj zadanie: poczta i follow-up' },
  { title: 'Skupiona praca', Icon: Laptop, hint: 'Dodaj zadanie: skupiona praca' },
  { title: 'Zakupy', Icon: ShoppingBasket, hint: 'Dodaj zadanie: zakupy' },
];
