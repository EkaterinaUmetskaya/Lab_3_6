chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const host = safeHost(tab?.url || '');
  document.getElementById('currentHost').textContent = host || '-';
  chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_STATS', host }, (response) => {
    const stats = response?.stats || { activeSeconds: 0, eventCount: 0 };
    document.getElementById('activeTime').textContent = `${Math.round(stats.activeSeconds / 60)} мин.`;
    document.getElementById('eventCount').textContent = String(stats.eventCount || 0);
  });
});

function safeHost(url) {
  try { return new URL(url).host; } catch { return ''; }
}
