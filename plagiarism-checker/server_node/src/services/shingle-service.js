export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text) {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(' ') : [];
}

export function createShingles(text, size = 5) {
  const words = Array.isArray(text) ? text : tokenize(text);
  if (words.length < size) {
    return new Set(words.length ? [words.join(' ')] : []);
  }
  const shingles = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    shingles.add(words.slice(index, index + size).join(' '));
  }
  return shingles;
}

export function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function compareTexts(sourceText, targetText, shingleSize = 5) {
  const sourceShingles = createShingles(sourceText, shingleSize);
  const targetShingles = createShingles(targetText, shingleSize);
  const similarity = jaccardSimilarity(sourceShingles, targetShingles);
  return {
    shingleSize,
    sourceShingles: sourceShingles.size,
    targetShingles: targetShingles.size,
    similarity,
    similarityPercent: Number((similarity * 100).toFixed(2))
  };
}
