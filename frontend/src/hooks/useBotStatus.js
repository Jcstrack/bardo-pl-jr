import { useEffect, useState } from 'react';

export default function useBotStatus(enabled = true, intervalMs = 3000) {
  const [status, setStatus] = useState({ state: 'checking', connected: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/bot/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('Bot no disponible');
        const next = await response.json();
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus({ state: 'offline', connected: false });
      }
    };
    refresh();
    const interval = window.setInterval(refresh, intervalMs);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [enabled, intervalMs]);

  return status;
}
