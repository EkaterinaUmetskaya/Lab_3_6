(() => {
  const host = location.host;
  let eventCount = 0;
  let lastActiveAt = Date.now();
  let activeSecondsBuffer = 0;

  function markActive() {
    const now = Date.now();
    const delta = Math.min(10, Math.max(0, Math.round((now - lastActiveAt) / 1000)));
    activeSecondsBuffer += delta;
    lastActiveAt = now;
    eventCount += 1;
  }

  function flush() {
    if (!eventCount && !activeSecondsBuffer) return;
    chrome.runtime.sendMessage({ type: 'SAVE_ACTIVITY', host, payload: { activeSeconds: activeSecondsBuffer, eventCount } });
    eventCount = 0;
    activeSecondsBuffer = 0;
  }

  ['mousemove', 'keydown', 'click'].forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));
  setInterval(flush, 15000);
  window.addEventListener('beforeunload', flush);
})();
