const DB_NAME = 'texttrace-umetskaya-v2-indexeddb';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('activity')) db.createObjectStore('activity', { keyPath: 'host' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'documentKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getActivity(host) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activity', 'readonly');
    const req = tx.objectStore('activity').get(host);
    req.onsuccess = () => resolve(req.result || { host, activeSeconds: 0, eventCount: 0, updatedAt: null });
    req.onerror = () => reject(req.error);
  });
}

async function saveActivity(host, patch) {
  const current = await getActivity(host);
  const next = { host, activeSeconds: Number(current.activeSeconds || 0) + Number(patch.activeSeconds || 0), eventCount: Number(current.eventCount || 0) + Number(patch.eventCount || 0), updatedAt: new Date().toISOString() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activity', 'readwrite');
    tx.objectStore('activity').put(next);
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
  });
}

async function saveDocumentResult(result) {
  const documentKey = result.documentKey || result.contentHash || result.documentId;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put({ ...result, documentKey, localSavedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SAVE_ACTIVITY') {
    saveActivity(message.host, message.payload).then((stats) => sendResponse({ ok: true, stats }));
    return true;
  }
  if (message?.type === 'GET_ACTIVITY_STATS') {
    getActivity(message.host).then((stats) => sendResponse({ ok: true, stats }));
    return true;
  }
  if (message?.type === 'SAVE_DOCUMENT_RESULT') {
    saveDocumentResult(message.payload).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
