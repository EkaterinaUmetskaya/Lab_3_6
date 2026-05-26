import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { extractTextFromDocument } from './text-extractor.js';
import { compareTexts, normalizeText } from './shingle-service.js';
import { listDocumentRecords, saveDocumentRecord } from './document-repository.js';
import { archiveToGoogleDrive } from './drive-service.js';

function hashText(text) {
  return crypto.createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

function studentFromBody(body) {
  return {
    fullName: String(body.fullName || '').trim(),
    course: String(body.course || '').trim(),
    faculty: String(body.faculty || '').trim(),
    program: String(body.program || '').trim(),
    group: String(body.group || '').trim()
  };
}

export async function processUploadedDocument(file, body) {
  const fileName = file.displayName || file.originalname;
  const text = await extractTextFromDocument(file.path, fileName);
  const contentHash = hashText(text);
  const existingDocuments = await listDocumentRecords();
  const duplicate = existingDocuments.find((document) => document.contentHash === contentHash);

  const comparisons = existingDocuments
    .filter((document) => document.contentHash !== contentHash)
    .map((document) => {
      const comparison = compareTexts(text, document.text, config.shingleSize);
      return {
        documentId: document.id,
        fileName: document.fileName,
        similarityPercent: comparison.similarityPercent,
        shingleSize: comparison.shingleSize,
        sourceShingles: comparison.sourceShingles,
        targetShingles: comparison.targetShingles
      };
    })
    .sort((a, b) => b.similarityPercent - a.similarityPercent);

  const student = studentFromBody(body);
  const documentId = duplicate?.id || uuidv4();
  const result = {
    documentId,
    documentKey: contentHash,
    contentHash,
    fileName,
    uploadedAt: new Date().toISOString(),
    maxSimilarityPercent: duplicate ? 100 : (comparisons.length ? comparisons[0].similarityPercent : 0),
    comparisons,
    exactDuplicate: Boolean(duplicate),
    duplicateOf: duplicate ? { documentId: duplicate.id, fileName: duplicate.fileName, uploadedAt: duplicate.createdAt } : null
  };

  if (!duplicate) {
    await saveDocumentRecord({
      id: documentId,
      contentHash,
      fileName,
      storageName: file.filename,
      path: file.path,
      createdAt: result.uploadedAt,
      student,
      text,
      result
    });
  }

  const drive = await archiveToGoogleDrive({ student, file, result });
  return { ...result, student, drive };
}

export async function listServerDocuments() {
  const documents = await listDocumentRecords();
  return documents.map(({ text, ...safe }) => safe);
}
