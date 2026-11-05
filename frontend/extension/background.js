let sourceTabId = null;
const restored = chrome.storage.session.get('sourceTabId').then((value) => { sourceTabId = value.sourceTabId ?? null; });

async function broadcast(state) {
  const tabs = await chrome.tabs.query({ url: ['http://localhost/*', 'https://*.trycloudflare.com/*'] });
  for (const tab of tabs) chrome.tabs.sendMessage(tab.id, { type: 'BARDO_STATE', state }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'BARDO_SELECT') {
    const tabId = message.tabId;
    restored.then(() => chrome.scripting.executeScript({ target: { tabId }, files: ['controller.js'] }))
      .then(() => {
        sourceTabId = tabId;
        chrome.storage.session.set({ sourceTabId: tabId });
        chrome.tabs.sendMessage(tabId, { type: 'BARDO_POLL' }).catch(() => {});
        respond({ ok: true });
      })
      .catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'BARDO_COMMAND') {
    restored.then(() => {
      if (sourceTabId === null) { respond({ ok: false, error: 'Conecta primero la pestaña desde la extensión.' }); return; }
      chrome.tabs.sendMessage(sourceTabId, message)
      .then((result) => respond(result))
      .catch(() => respond({ ok: false, error: 'La pestaña conectada ya no está disponible.' }));
    });
    return true;
  }
  if (message.type === 'BARDO_SOURCE_STATE' && sender.tab?.id === sourceTabId) {
    broadcast({ ...message.state, connected: true, tabId: sourceTabId });
    return;
  }
  if (message.type === 'BARDO_HELLO') {
    restored.then(() => {
      if (sourceTabId !== null) chrome.tabs.sendMessage(sourceTabId, { type: 'BARDO_POLL' }).catch(() => {
        sourceTabId = null;
        chrome.storage.session.remove('sourceTabId');
        broadcast({ connected: false });
      });
      respond({ connected: sourceTabId !== null });
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== sourceTabId) return;
  sourceTabId = null;
  chrome.storage.session.remove('sourceTabId');
  broadcast({ connected: false });
});
