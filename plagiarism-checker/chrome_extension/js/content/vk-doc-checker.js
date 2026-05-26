(() => {
  const API_URL = 'http://localhost:3000/api/documents/check';
  const BUTTON_CLASS = 'vk-courseguard-check';

  function isDocLink(link) { return /\.docx?(\?|#|$)/i.test(link.href || ''); }

  function enhanceLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      if (!isDocLink(link) || link.dataset.lab6Enhanced) return;
      link.dataset.lab6Enhanced = '1';
      const button = document.createElement('button');
      button.className = BUTTON_CLASS;
      button.textContent = 'проверить';
      button.type = 'button';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await checkVkDocument(link.href, link.textContent || 'vk-document.docx', button);
      });
      link.insertAdjacentElement('afterend', button);
    });
  }

  async function checkVkDocument(url, title, button) {
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'проверка...';
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Не удалось скачать файл со страницы ВК');
      const blob = await response.blob();
      if (blob.size > 5 * 1024 * 1024) throw new Error('Файл больше 5 МБ');
      const fileName = cleanFileName(title, url);
      const formData = new FormData();
      formData.append('document', new File([blob], fileName), fileName);
      formData.append('fullName', 'VK document user');
      formData.append('course', '-');
      formData.append('faculty', '-');
      formData.append('program', '-');
      formData.append('group', '-');
      const checkResponse = await fetch(API_URL, { method: 'POST', body: formData });
      const result = await checkResponse.json();
      if (!checkResponse.ok) throw new Error(result.error || 'Ошибка проверки');
      chrome.runtime.sendMessage({ type: 'SAVE_DOCUMENT_RESULT', payload: result });
      alert(`Проверка завершена. Максимальное совпадение: ${result.maxSimilarityPercent}%`);
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function cleanFileName(title, url) {
    const fromUrl = decodeURIComponent((url.split('/').pop() || '').split('?')[0]);
    const candidate = /\.docx?$/i.test(fromUrl) ? fromUrl : title;
    return candidate.replace(/[^a-zA-Z0-9а-яА-ЯЁё_.-]+/g, '_') || 'vk-document.docx';
  }

  enhanceLinks();
  new MutationObserver(enhanceLinks).observe(document.documentElement, { childList: true, subtree: true });
})();
