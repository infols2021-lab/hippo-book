// app/(app)/assignment/lib/normalize.ts

export function normalizeText(text: any): string {
  if (!text) return "";

  // 1. Приведение к строке, нижнему регистру и удаление начальных/конечных пробелов
  let normalized = String(text).toLowerCase().trim();

  // 2. Юникод-нормализация (NFC - решение Бага #16)
  // Собирает составные символы (например, base letter + diacritic) в единый codepoint, 
  // чтобы визуально одинаковые строки были равны и программно.
  normalized = normalized.normalize("NFC");

  // 3. Обработка кириллической "ё" (частая проблема ввода)
  normalized = normalized.replace(/ё/g, "е");

  // 4. Нормализация всех видов кавычек и апострофов
  // Включает машинные, типографские и грависы
  normalized = normalized.replace(/[''`´’‘]/g, "'");
  
  // Удаляем пробелы вокруг апострофов (например, "don ' t" -> "don't")
  normalized = normalized.replace(/\s*'\s*/g, "'");

  // 5. Удаление двойных пробелов
  normalized = normalized.replace(/\s+/g, " ");

  // 6. Умная нормализация омоглифов (Баг #16)
  // Учитывая фокус на экзамены по английскому, критически важно исправлять 
  // случайные кириллические буквы в английских словах (забыл переключить раскладку) и наоборот.
  
  const hasLatin = /[a-z]/.test(normalized);
  const hasCyrillic = /[а-я]/.test(normalized);

  if (hasLatin && hasCyrillic) {
    // Маппинг кириллица -> латиница
    const cyrillicToLatin: Record<string, string> = {
      'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y'
    };
    // Маппинг латиница -> кириллица
    const latinToCyrillic: Record<string, string> = {
      'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у'
    };

    const latinCount = (normalized.match(/[a-z]/g) || []).length;
    const cyrillicCount = (normalized.match(/[а-я]/g) || []).length;

    if (latinCount >= cyrillicCount) {
      // Слово скорее английское: заменяем затесавшиеся русские омоглифы
      // В регулярке ниже использованы строго кириллические буквы: а, с, е, о, р, х, у
      normalized = normalized.replace(/[асеорху]/g, match => cyrillicToLatin[match] || match);
    } else {
      // Слово скорее русское: заменяем затесавшиеся английские омоглифы
      // В регулярке ниже использованы строго латинские буквы: a, c, e, o, p, x, y
      normalized = normalized.replace(/[aceopxy]/g, match => latinToCyrillic[match] || match);
    }
  }

  return normalized;
}