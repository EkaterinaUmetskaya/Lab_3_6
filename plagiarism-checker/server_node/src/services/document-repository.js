import fs from 'node:fs/promises';
import path from 'node:path';

const storageRoot = path.resolve('storage');
const docsDir = path.join(storageRoot, 'documents');

export async function ensureStorage() {
  await fs.mkdir(docsDir, { recursive: true });
}

export async function saveDocumentRecord(record) {
  await ensureStorage();
  const filePath = path.join(docsDir, `${record.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
  return record;
}

export async function listDocumentRecords() {
  await ensureStorage();
  const files = await fs.readdir(docsDir);
  const records = [];
  for (const file of files.filter((name) => name.endsWith('.json'))) {
    const raw = await fs.readFile(path.join(docsDir, file), 'utf8');
    records.push(JSON.parse(raw));
  }
  return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
