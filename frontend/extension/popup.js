document.getElementById('connect').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ type: 'BARDO_SELECT', tabId: tab.id });
  status.textContent = result.ok ? 'Pestaña conectada. Vuelve a Bardo.' : `No se pudo conectar: ${result.error}`;
});
