import path from 'node:path';

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const MOJIBAKE_RE = /[ÐÑÃÂ]/;

const transliterationMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function scoreCyrillic(value) {
  return (String(value).match(/[А-Яа-яЁё]/g) || []).length;
}

function scoreMojibake(value) {
  return (String(value).match(/[ÐÑÃÂ�]/g) || []).length;
}

export function restoreUtf8FileName(inputName) {
  const safeInput = path.basename(String(inputName || 'document.docx').replace(/[\\/]+/g, '_'));
  if (!MOJIBAKE_RE.test(safeInput)) return safeInput;

  const decoded = Buffer.from(safeInput, 'latin1').toString('utf8');
  if (scoreCyrillic(decoded) > scoreCyrillic(safeInput) && scoreMojibake(decoded) < scoreMojibake(safeInput)) {
    return decoded;
  }
  return safeInput;
}

export function makeStorageFileName(displayName, fallbackExtension = '.docx') {
  const parsed = path.parse(restoreUtf8FileName(displayName));
  const extension = (parsed.ext || fallbackExtension).toLowerCase();
  let base = parsed.name
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = transliterationMap[lower];
      if (!mapped) return char;
      return char === lower ? mapped : mapped.toUpperCase();
    })
    .join('')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  if (!base) base = 'document';
  return `${Date.now()}_${base}${extension}`;
}

export function fileExtension(name) {
  return path.extname(restoreUtf8FileName(name)).toLowerCase();
}
