import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, createShingles, compareTexts } from '../src/services/shingle-service.js';
import { restoreUtf8FileName } from '../src/utils/file-name.js';

test('normalizeText removes punctuation and normalizes cyrillic ё', () => {
  assert.equal(normalizeText('Ёжик, ТЕСТ!!!'), 'ежик тест');
});

test('createShingles builds groups of words', () => {
  const shingles = createShingles('один два три четыре', 2);
  assert.deepEqual([...shingles], ['один два', 'два три', 'три четыре']);
});

test('compareTexts returns high percent for similar text', () => {
  const result = compareTexts('один два три четыре пять шесть', 'один два три четыре пять семь', 3);
  assert.ok(result.similarityPercent > 30);
});

test('restoreUtf8FileName repairs mojibake cyrillic names', () => {
  assert.equal(restoreUtf8FileName('ÐÑÑÐµÑ Ð¡ÐµÑÐ¸ Ð»Ð°Ð± 7.docx'), 'Отчет Сети лаб 7.docx');
});
