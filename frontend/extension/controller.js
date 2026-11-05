(() => {
  if (window.__bardoControllerInstalled) return;
  window.__bardoControllerInstalled = true;
  let repeat = false;
  let loopStart = null;
  let loopEnd = null;
  let playStart = null;
  let playEnd = null;
  let previousState = '';

  function media() {
    const elements = [...document.querySelectorAll('video, audio')];
    return elements.find((item) => !item.paused && !item.ended) ||
      elements.find((item) => Number.isFinite(item.duration) && item.duration > 0) || elements[0];
  }

  function state() {
    const item = media();
    return {
      url: location.href,
      title: document.title,
      playing: Boolean(item && !item.paused && !item.ended),
      elapsed: Number.isFinite(item?.currentTime) ? item.currentTime : 0,
      duration: Number.isFinite(item?.duration) ? item.duration : 0,
      hasMedia: Boolean(item),
      canSeek: Boolean(item && Number.isFinite(item.duration) && item.duration > 0),
    };
  }

  function publish(force = false) {
    const current = state();
    const serialized = JSON.stringify(current);
    if (force || previousState !== serialized) {
      previousState = serialized;
      chrome.runtime.sendMessage({ type: 'BARDO_SOURCE_STATE', state: current }).catch(() => {});
    }
    const item = media();
    if (item && playEnd !== null && !item.paused && item.currentTime >= playEnd) {
      item.pause();
      publish(true);
      return;
    }
    if (!item || !repeat || !Number.isFinite(item.duration) || !item.duration || item.paused) return;
    const end = loopEnd ?? item.duration;
    if (item.currentTime >= end - 0.15) {
      item.currentTime = loopStart ?? playStart ?? 0;
      item.play().catch(() => {});
    }
  }

  function siteButton(direction) {
    const selectors = location.hostname.includes('youtube.com')
      ? (direction > 0 ? ['.ytp-next-button'] : ['.ytp-prev-button'])
      : location.hostname.includes('spotify.com')
        ? (direction > 0 ? ['[data-testid="control-button-skip-forward"]'] : ['[data-testid="control-button-skip-back"]'])
        : [];
    return selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'BARDO_POLL') { publish(true); respond({ ok: true }); return; }
    if (message.type !== 'BARDO_COMMAND') return;
    const item = media();
    const value = message.value;
    try {
      if (message.command === 'toggle') {
        if (!item) throw new Error('No se encontró un reproductor HTML en esta pestaña.');
        if (item.paused) {
          if ((playStart !== null && item.currentTime < playStart - 0.25) ||
              (playEnd !== null && item.currentTime >= playEnd - 0.25)) item.currentTime = playStart ?? 0;
          item.play().catch(() => {});
        }
        else item.pause();
      } else if (message.command === 'step') {
        const button = siteButton(Number(value));
        if (!button) throw new Error('Esta página no expone un botón de pista anterior o siguiente.');
        button.click();
      } else if (message.command === 'seek') {
        if (!item || !Number.isFinite(item.duration)) throw new Error('Esta fuente no permite mover la posición.');
        item.currentTime = Math.max(0, Math.min(item.duration, Number(value)));
      } else if (message.command === 'repeat') {
        repeat = Boolean(value);
      } else if (message.command === 'loop') {
        loopStart = Number.isFinite(value?.start) ? value.start : null;
        loopEnd = Number.isFinite(value?.end) ? value.end : null;
      } else if (message.command === 'range') {
        playStart = Number.isFinite(value?.start) ? value.start : null;
        playEnd = Number.isFinite(value?.end) ? value.end : null;
      }
      publish(true);
      respond({ ok: true });
    } catch (error) { respond({ ok: false, error: error.message }); }
  });

  document.addEventListener('play', () => publish(true), true);
  document.addEventListener('pause', () => publish(true), true);
  document.addEventListener('loadedmetadata', () => publish(true), true);
  setInterval(publish, 400);
  publish(true);
})();
