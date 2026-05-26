(async function renderDocuments() {
  const table = document.getElementById('documentsTable');
  const empty = document.getElementById('emptyState');
  const clearButton = document.getElementById('clearButton');
  const clearServerButton = document.getElementById('clearServerButton');
  clearButton.addEventListener('click', async () => { if (confirm('Очистить локальную историю IndexedDB?')) { await ExtensionDB.clear('documents'); location.reload(); } });
  clearServerButton.addEventListener('click', async () => {
    if (!confirm('Очистить базу документов на сервере?')) return;
    const response = await fetch(`${ExtensionConfig.apiBaseUrl}/documents`, { method: 'DELETE' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error || 'Не удалось очистить базу сервера');
      return;
    }
    alert('База сервера очищена');
  });
  const documents = await ExtensionDB.getDocuments();
  if (!documents.length) { empty.classList.remove('hidden'); return; }
  table.innerHTML = documents.map((doc) => {
    const bestMatch = doc.exactDuplicate
      ? doc.duplicateOf?.fileName
      : doc.comparisons?.[0]?.fileName;
    const bestMatchText = bestMatch ? CourseGuardEncoding.fixFileName(bestMatch) : '-';
    return `
    <tr>
      <td><b>${CourseGuardEncoding.escapeHtml(doc.fileName)}</b></td>
      <td>${CourseGuardEncoding.escapeHtml(doc.student?.fullName || '-')}<br><span class="muted">${CourseGuardEncoding.escapeHtml(doc.student?.group || '-')}</span></td>
      <td>${new Date(doc.uploadedAt).toLocaleString()}</td>
      <td>${doc.maxSimilarityPercent}%</td>
      <td>${CourseGuardEncoding.escapeHtml(bestMatchText)}</td>
      <td>${doc.comparisons?.length || 0}</td>
      <td>${doc.exactDuplicate ? 'повторная проверка' : 'новый документ'}</td>
    </tr>`;
  }).join('');
})();
