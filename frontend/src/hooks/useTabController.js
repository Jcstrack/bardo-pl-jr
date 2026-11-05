import { useEffect, useState } from 'react';

export default function useTabController() {
  const [state, setState] = useState({ connected: false });
  const [error, setError] = useState('');

  useEffect(() => {
    const receive = (event) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'bardo-extension') return;
      if (event.data.type === 'state') setState(event.data.state);
      if (event.data.type === 'error') setError(event.data.message);
    };
    window.addEventListener('message', receive);
    const ping = () => window.postMessage({ source: 'bardo-web', type: 'hello' }, location.origin);
    ping();
    const interval = window.setInterval(ping, 3000);
    return () => { window.removeEventListener('message', receive); window.clearInterval(interval); };
  }, []);

  const command = (name, value) => {
    if (!state.connected) return false;
    setError('');
    window.postMessage({ source: 'bardo-web', type: 'command', command: name, value }, location.origin);
    return true;
  };
  return { ...state, error, command };
}
