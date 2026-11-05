if (document.querySelector('meta[name="bardo-app"][content="politanense-jr"]')) {
chrome.runtime.sendMessage({ type: 'BARDO_HELLO' }).catch(() => {});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'BARDO_STATE') {
    window.postMessage({ source: 'bardo-extension', type: 'state', state: message.state }, location.origin);
  }
});

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'bardo-web') return;
  if (event.data.type === 'hello') {
    chrome.runtime.sendMessage({ type: 'BARDO_HELLO' }).catch(() => {});
    return;
  }
  if (event.data.type !== 'command') return;
  chrome.runtime.sendMessage({ type: 'BARDO_COMMAND', command: event.data.command, value: event.data.value })
    .then((result) => {
      if (result?.ok === false) window.postMessage({ source: 'bardo-extension', type: 'error', message: result.error }, location.origin);
    })
    .catch(() => window.postMessage({ source: 'bardo-extension', type: 'error', message: 'La extensión no está disponible.' }, location.origin));
});
}
