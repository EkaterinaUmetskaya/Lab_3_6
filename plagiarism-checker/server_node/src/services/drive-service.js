import fs from 'node:fs';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from '../config.js';

async function getDriveClient() {
  if (!config.googleDriveEnabled) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: config.googleServiceAccountJson,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

export async function archiveToGoogleDrive({ student, file, result }) {
  const drive = await getDriveClient();
  if (!drive) return { enabled: false, message: 'Google Drive upload is disabled' };

  const folderName = (student.fullName || 'Unknown student').replace(/[\/:*?"<>|]+/g, '_');
  const folderMetadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (config.googleDriveRootFolderId) folderMetadata.parents = [config.googleDriveRootFolderId];

  const folder = await drive.files.create({ requestBody: folderMetadata, fields: 'id, name' });
  const uploadedDoc = await drive.files.create({
    requestBody: { name: result.fileName, parents: [folder.data.id] },
    media: { mimeType: file.mimetype || 'application/octet-stream', body: fs.createReadStream(file.path) },
    fields: 'id, name, webViewLink'
  });

  const reportText = [
    `Student: ${student.fullName || '-'}`,
    `Course: ${student.course || '-'}`,
    `Faculty: ${student.faculty || '-'}`,
    `Program: ${student.program || '-'}`,
    `Group: ${student.group || '-'}`,
    `Document: ${result.fileName}`,
    `Max similarity: ${result.maxSimilarityPercent}%`,
    `Exact duplicate: ${result.exactDuplicate ? 'yes' : 'no'}`,
    '',
    'Comparisons:',
    ...result.comparisons.map((item) => `- ${item.fileName}: ${item.similarityPercent}%`)
  ].join('\n');

  const reportFile = await drive.files.create({
    requestBody: { name: 'student_and_check_result.txt', parents: [folder.data.id] },
    media: { mimeType: 'text/plain', body: Readable.from([reportText]) },
    fields: 'id, name, webViewLink'
  });

  return { enabled: true, folderId: folder.data.id, documentId: uploadedDoc.data.id, reportId: reportFile.data.id };
}
