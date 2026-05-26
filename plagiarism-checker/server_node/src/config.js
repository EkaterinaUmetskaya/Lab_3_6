import fs from 'node:fs';
function loadEnvFile() {
  if (!fs.existsSync('.env')) return;
  const raw = fs.readFileSync('.env', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = valueParts.join('=').trim();
  }
}
loadEnvFile();
export const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB || 5),
  shingleSize: Number(process.env.SHINGLE_SIZE || 5),
  googleDriveEnabled: String(process.env.GOOGLE_DRIVE_ENABLED || 'false') === 'true',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './service-account.json',
  googleDriveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null
};