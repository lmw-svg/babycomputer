/**
 * Date parsing and formatting utilities for school extracurricular activity sessions.
 * Ensures date format is consistently D/M (e.g. "9/10", "16/3", "29/9", "6/10")
 * and prevents accidental single-number dates (such as "10" or "9").
 */

/**
 * Parses raw dates text (e.g. "2026年：29/9, 6/10, 13/10" or "9/10、16/10、23/10" or "10月9日")
 * into a clean list of session dates in "D/M" or "DD/MM" format.
 */
export function parseSessionDates(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText.trim();

  // 1. Direct regex extraction of D/M, DD/MM, YYYY/MM/DD, YYYY-MM-DD or Chinese dates (M月D日 / D日M月)
  const results: string[] = [];

  // Match Chinese dates: e.g. "10月9日" -> "9/10" or "9月10日" -> "10/9"
  const chineseDateRegex = /(\d{1,2})月(\d{1,2})日/g;
  let chMatch;
  const replacedText = text.replace(chineseDateRegex, (_, m, d) => {
    return ` ${d}/${m} `;
  });

  // Match standard ISO dates: e.g. "2026-10-09" or "2026/10/09" -> "9/10"
  const isoDateRegex = /\b\d{4}[-/](\d{1,2})[-/](\d{1,2})\b/g;
  const isoReplaced = replacedText.replace(isoDateRegex, (_, m, d) => {
    return ` ${parseInt(d, 10)}/${parseInt(m, 10)} `;
  });

  // Split by common delimiters (commas, ideographic commas, semicolons, whitespace, linebreaks)
  // CRITICAL: DO NOT split by '/' or '-' as they are internal date separators
  const tokens = isoReplaced
    .split(/[、,，;；\n\r\t&與及至和~～]+/g)
    .map(t => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    // Check if token contains a date like "9/10" or "16/3"
    // Also strip prefixes like "2026年：" or "堂數：" or "1."
    const dateMatch = token.match(/(\d{1,2})\s*[/／-]\s*(\d{1,2})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        results.push(`${day}/${month}`);
        continue;
      }
    }

    // Check if token is formatted as "D.M" (e.g. 9.10)
    const dotMatch = token.match(/(\d{1,2})\.(\d{1,2})/);
    if (dotMatch) {
      const day = parseInt(dotMatch[1], 10);
      const month = parseInt(dotMatch[2], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        results.push(`${day}/${month}`);
        continue;
      }
    }

    // If it's a descriptive phrase (e.g. "第1堂", "補堂A"), preserve if not pure digit
    const cleaned = token.replace(/^[0-9]+[.:：、\s]+/, '').trim();
    if (cleaned && !/^\d+$/.test(cleaned)) {
      results.push(cleaned);
    }
  }

  // If no date matched but user entered something like "9/10", extract all day/month patterns in text
  if (results.length === 0) {
    const allSlashDates = text.match(/\d{1,2}\s*[/／]\s*\d{1,2}/g);
    if (allSlashDates) {
      for (const d of allSlashDates) {
        const parts = d.split(/[/／]/);
        if (parts.length === 2) {
          const day = parseInt(parts[0].trim(), 10);
          const month = parseInt(parts[1].trim(), 10);
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            results.push(`${day}/${month}`);
          }
        }
      }
    }
  }

  // Deduplicate consecutive identical items while preserving order
  const uniqueResults: string[] = [];
  for (const r of results) {
    if (!uniqueResults.includes(r)) {
      uniqueResults.push(r);
    }
  }

  return uniqueResults;
}

/**
 * Formats an array of session date strings into standard text representation (joined by ideographic comma '、')
 */
export function formatSessionDatesText(dates: string[]): string {
  if (!dates || dates.length === 0) return '';
  return dates.join('、');
}

/**
 * Validates whether a date string is in valid format (e.g. "9/10", "16/3")
 * Rejects bare single numbers like "10" or "9"
 */
export function isValidSessionDate(dateStr: string): boolean {
  if (!dateStr || !dateStr.trim()) return false;
  const s = dateStr.trim();
  // Must not be a bare number like "10"
  if (/^\d{1,2}$/.test(s)) return false;
  // Accept "D/M", "DD/MM", "D-M", "M月D日" or descriptive session names
  if (/^\d{1,2}[/／-]\d{1,2}$/.test(s)) return true;
  return s.length > 0;
}

/**
 * Normalizes single date input (e.g. user types "9/10" or "2026-10-09" or "9-10" or "10月9日")
 */
export function normalizeSingleDateInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // If already "9/10" or "16/3"
  const slashMatch = trimmed.match(/^(\d{1,2})\s*[/／-]\s*(\d{1,2})$/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${d}/${m}`;
    }
  }

  // Chinese date "10月9日"
  const chMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (chMatch) {
    const m = parseInt(chMatch[1], 10);
    const d = parseInt(chMatch[2], 10);
    return `${d}/${m}`;
  }

  return trimmed;
}
