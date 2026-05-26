const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectButton = document.getElementById('selectButton');
const uploadButton = document.getElementById('uploadButton');
const fileInfo = document.getElementById('fileInfo');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');
let selectedFile = null;

function setFile(file) {
  if (!file) return;
  const isValidType = /\.docx?$/i.test(file.name);
  if (!isValidType) return alert('Можно загрузить только DOC или DOCX файл.');
  if (file.size > ExtensionConfig.maxFileSizeBytes) return alert('Размер файла не должен превышать 5 МБ.');
  selectedFile = file;
  fileInfo.textContent = `${file.name} (${Math.round(file.size / 1024)} КБ)`;
}

selectButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('dragover'); setFile(event.dataTransfer.files[0]); });

function field(id) { return document.getElementById(id).value.trim(); }
function similarityClass(value) { return value >= 70 ? 'result-bad' : value >= 40 ? 'result-warn' : 'result-ok'; }

uploadButton.addEventListener('click', async () => {
  if (!selectedFile) return alert('Выберите файл курсовой работы.');
  const student = { fullName: field('fullName'), course: field('course'), faculty: field('faculty'), program: field('program'), group: field('group') };
  if (!student.fullName || !student.course || !student.faculty || !student.program || !student.group) return alert('Заполните все данные студента.');

  const formData = new FormData();
  formData.append('document', selectedFile, selectedFile.name);
  Object.entries(student).forEach(([key, value]) => formData.append(key, value));

  uploadButton.disabled = true;
  uploadButton.textContent = 'Проверка...';
  try {
    const response = await fetch(`${ExtensionConfig.apiBaseUrl}/documents/check`, { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка проверки');
    await ExtensionDB.saveDocumentResult(result);
    resultSection.classList.remove('hidden');
    const fileName = CourseGuardEncoding.escapeHtml(CourseGuardEncoding.fixFileName(result.fileName));
    const duplicateNote = result.exactDuplicate ? `<p class="result-warn">Повторная загрузка: такой текст уже был в базе. В историю обновлена одна запись, дубль не создан.</p>` : '';
    resultContent.innerHTML = `
      <p>Файл: <b>${fileName}</b></p>
      <p>Максимальное совпадение: <span class="${similarityClass(result.maxSimilarityPercent)}">${result.maxSimilarityPercent}%</span></p>
      <p>Сравнений с другими работами: ${result.comparisons.length}</p>
      ${duplicateNote}
      <p>Google Drive: ${result.drive?.enabled ? 'файл и отчёт отправлены' : 'отключен в .env'}</p>
      <ul>${result.comparisons.map(item => `<li>${CourseGuardEncoding.escapeHtml(CourseGuardEncoding.fixFileName(item.fileName))} - ${item.similarityPercent}%</li>`).join('')}</ul>`;
  } catch (error) {
    alert(error.message);
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = 'Загрузить и проверить';
  }
});
