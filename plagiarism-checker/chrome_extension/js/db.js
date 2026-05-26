window.TextTraceDB = (() => {
  const DB_NAME = window.ExtensionConfig?.dbName || 'texttrace-umetskaya-v2-indexeddb';
  const DB_VERSION = 2;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'documentKey' });
        if (!db.objectStoreNames.contains('activity')) db.createObjectStore('activity', { keyPath: 'host' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function put(storeName, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function saveDocumentResult(result) {
    const documentKey = result.documentKey || result.contentHash || result.documentId;
    const fixedName = window.TextTraceEncoding.fixFileName(result.fileName);
    return put('documents', { ...result, documentKey, fileName: fixedName, localSavedAt: new Date().toISOString() });
  }

  async function getDocuments() {
    const rows = await getAll('documents');
    return rows
      .map((row) => ({ ...row, fileName: window.TextTraceEncoding.fixFileName(row.fileName) }))
      .sort((a, b) => String(b.localSavedAt).localeCompare(String(a.localSavedAt)));
  }

  return { saveDocumentResult, getDocuments, put, getAll, clear };
})();
window.ExtensionDB = window.TextTraceDB;
