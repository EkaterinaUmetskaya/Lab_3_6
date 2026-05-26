(async function renderDocuments() {
  const cards = document.getElementById('documentsCards');
  const empty = document.getElementById('emptyState');
  const clearButton = document.getElementById('clearButton');
  clearButton.addEventListener('click', async () => { if (confirm('Сбросить журнал проверок?')) { await ExtensionDB.clear('documents'); location.reload(); } });
  const documents = await ExtensionDB.getDocuments();
  if (!documents.length) { empty.classList.remove('hidden'); return; }
  cards.innerHTML = documents.map((doc) => `
    <article class="doc-card">
      <h3>${TextTraceEncoding.escapeHtml(doc.fileName)}</h3>
      <p><b>Студент:</b> ${TextTraceEncoding.escapeHtml(doc.student?.fullName || '-')} / ${TextTraceEncoding.escapeHtml(doc.student?.group || '-')}</p>
      <p><b>Дата:</b> ${new Date(doc.uploadedAt).toLocaleString()}</p>
      <p><b>Максимальное совпадение:</b> ${doc.maxSimilarityPercent}%</p>
      <p><b>Сравнений:</b> ${doc.comparisons?.length || 0}; <b>статус:</b> ${doc.exactDuplicate ? 'повторная проверка' : 'новый документ'}</p>
    </article>`).join('');
})();
