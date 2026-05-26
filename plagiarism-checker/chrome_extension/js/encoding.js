window.CourseGuardEncoding = (() => {
  function hasMojibake(value) {
    return /[ÐÑÃÂ]/.test(String(value || ''));
  }

  function latin1ToUtf8(value) {
    const bytes = Uint8Array.from(String(value), (char) => char.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function scoreCyrillic(value) {
    return (String(value).match(/[А-Яа-яЁё]/g) || []).length;
  }

  function scoreBroken(value) {
    return (String(value).match(/[ÐÑÃÂ�]/g) || []).length;
  }

  function fixFileName(value) {
    const text = String(value || 'document.docx');
    if (!hasMojibake(text)) return text;
    const decoded = latin1ToUtf8(text);
    return scoreCyrillic(decoded) > scoreCyrillic(text) && scoreBroken(decoded) < scoreBroken(text)
      ? decoded
      : text;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  return { fixFileName, escapeHtml };
})();
