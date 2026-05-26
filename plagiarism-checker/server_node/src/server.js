import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { config } from './config.js';
import { compareTexts, normalizeText } from './services/shingle-service.js';
import { restoreUtf8FileName } from './utils/file-name.js';

const storageRoot = path.resolve('storage');
const uploadsDir = path.join(storageRoot, 'uploads');
const docsDir = path.join(storageRoot, 'documents');

async function ensureStorage() {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(docsDir, { recursive: true });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(payload));
}

function badRequest(message, status = 422) { const error = new Error(message); error.statusCode = status; return error; }
function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || '');
  if (!boundaryMatch) throw badRequest('Не найден multipart boundary');
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const parts = [];
  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;
    const rawHeaders = buffer.slice(start, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;
    let next = buffer.indexOf(boundary, bodyStart);
    if (next === -1) break;
    let bodyEnd = next;
    if (buffer[bodyEnd - 2] === 13 && buffer[bodyEnd - 1] === 10) bodyEnd -= 2;
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(rawHeaders)?.[1] || '';
    const name = /name="([^"]+)"/i.exec(disposition)?.[1];
    const filenameRaw = /filename="([^"]*)"/i.exec(disposition)?.[1];
    if (name) parts.push({ name, filename: filenameRaw ? restoreUtf8FileName(filenameRaw) : null, data: buffer.slice(bodyStart, bodyEnd) });
    start = next;
  }
  return parts;
}
function safeFileName(fileName) { return restoreUtf8FileName(fileName || 'document.docx').replace(/[\\/:*?"<>|]+/g, '_'); }
function xmlToText(xml) { return xml.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim(); }
function readUInt(buffer, offset, size) { return size === 2 ? buffer.readUInt16LE(offset) : buffer.readUInt32LE(offset); }
function extractZipEntry(buffer, targetName) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) { if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; } }
  if (eocd === -1) throw badRequest('DOCX архив поврежден');
  const entries = readUInt(buffer, eocd + 10, 2);
  let offset = readUInt(buffer, eocd + 16, 4);
  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = readUInt(buffer, offset + 10, 2);
    const compressedSize = readUInt(buffer, offset + 20, 4);
    const fileNameLength = readUInt(buffer, offset + 28, 2);
    const extraLength = readUInt(buffer, offset + 30, 2);
    const commentLength = readUInt(buffer, offset + 32, 2);
    const localHeaderOffset = readUInt(buffer, offset + 42, 4);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    if (name === targetName) {
      const localNameLength = readUInt(buffer, localHeaderOffset + 26, 2);
      const localExtraLength = readUInt(buffer, localHeaderOffset + 28, 2);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return zlib.inflateRawSync(compressed);
      throw badRequest('Неподдерживаемый метод сжатия DOCX');
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw badRequest('В DOCX не найден word/document.xml');
}
function extractText(fileBuffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.docx') return xmlToText(extractZipEntry(fileBuffer, 'word/document.xml').toString('utf8'));
  if (ext === '.doc') return fileBuffer.toString('utf8').replace(/\0/g, ' ').replace(/\s+/g, ' ').trim();
  throw badRequest('Разрешены только файлы .doc и .docx');
}
async function listRecords() { await ensureStorage(); const files = await fs.readdir(docsDir); const records = []; for (const file of files.filter((name) => name.endsWith('.json'))) { records.push(JSON.parse(await fs.readFile(path.join(docsDir, file), 'utf8'))); } return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }
async function saveRecord(record) { await fs.writeFile(path.join(docsDir, `${record.id}.json`), JSON.stringify(record, null, 2), 'utf8'); }
function hashText(text) { return crypto.createHash('sha256').update(normalizeText(text), 'utf8').digest('hex'); }
async function handleCheck(req, res) {
  const chunks = []; let total = 0; const maxBytes = config.uploadLimitMb * 1024 * 1024 + 1024 * 1024;
  for await (const chunk of req) { total += chunk.length; if (total > maxBytes) throw badRequest('Размер файла не должен превышать 5 МБ', 413); chunks.push(chunk); }
  const parts = parseMultipart(Buffer.concat(chunks), req.headers['content-type']);
  const filePart = parts.find((part) => part.name === 'document');
  if (!filePart?.filename) throw badRequest('Document file is required');
  if (filePart.data.length > config.uploadLimitMb * 1024 * 1024) throw badRequest('Размер файла не должен превышать 5 МБ', 413);
  const fileName = safeFileName(filePart.filename); const ext = path.extname(fileName).toLowerCase();
  if (!['.doc', '.docx'].includes(ext)) throw badRequest('Разрешены только файлы .doc и .docx');
  const storedName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName}`;
  await fs.writeFile(path.join(uploadsDir, storedName), filePart.data);
  const text = extractText(filePart.data, fileName); const contentHash = hashText(text); const existing = await listRecords(); const duplicate = existing.find((document) => document.contentHash === contentHash);
  const comparisons = existing.filter((document) => document.contentHash !== contentHash).map((document) => ({ documentId: document.id, fileName: document.fileName, ...compareTexts(text, document.text, config.shingleSize) })).map(({ similarity, ...item }) => item).sort((a, b) => b.similarityPercent - a.similarityPercent);
  const student = Object.fromEntries(parts.filter((part) => part.name !== 'document').map((part) => [part.name, part.data.toString('utf8').trim()]));
  const uploadedAt = new Date().toISOString(); const documentId = duplicate?.id || crypto.randomUUID();
  const result = { documentId, documentKey: contentHash, contentHash, fileName, uploadedAt, maxSimilarityPercent: duplicate ? 100 : (comparisons[0]?.similarityPercent || 0), comparisons, exactDuplicate: Boolean(duplicate), duplicateOf: duplicate ? { documentId: duplicate.id, fileName: duplicate.fileName, uploadedAt: duplicate.createdAt } : null, student, drive: { enabled: false, message: 'Google Drive upload is disabled' } };
  if (!duplicate) await saveRecord({ id: documentId, contentHash, fileName, storageName: storedName, createdAt: uploadedAt, student, text, result });
  sendJson(res, 200, result);
}
async function router(req, res) {
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res, 200, { status: 'ok', service: 'CourseGuard standalone server', time: new Date().toISOString() });
    if (req.method === 'GET' && url.pathname === '/api/documents') return sendJson(res, 200, (await listRecords()).map(({ text, ...safe }) => safe));
    if (req.method === 'POST' && url.pathname === '/api/documents/check') return await handleCheck(req, res);
    sendJson(res, 404, { error: 'Not found', status: 404 });
  } catch (error) { sendJson(res, error.statusCode || 500, { error: error.message || 'Server error', status: error.statusCode || 500 }); }
}
await ensureStorage();
http.createServer(router).listen(config.port, () => console.log(`CourseGuard server started: http://localhost:${config.port}`));