import { useEffect, useRef, useState } from 'react';

// La posición visible corresponde al audio que ya alcanzó la salida del bot.
// Tras un salto se descartan todas las muestras anteriores. Solo se muestra la
// nueva posición cuando la fuente confirmó el salto y pasó el búfer del bot.
export default function useDiscordTimeline(elapsed, activeId, enabled, botPlaying, bufferMs = 1200, seekRequest = null) {
  const [display, setDisplay] = useState({ position: elapsed, pendingTarget: null });
  const [clock, setClock] = useState(0);
  const samples = useRef([]);
  const source = useRef(activeId);
  const lastRequestId = useRef(null);
  const lastFailedId = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setClock((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (source.current !== activeId) {
      source.current = activeId;
      samples.current = [];
      lastRequestId.current = null;
      lastFailedId.current = null;
      setDisplay({ position: elapsed, pendingTarget: null });
      return;
    }
    if (!enabled) {
      samples.current = [];
      lastRequestId.current = null;
      setDisplay((old) => old.position === elapsed && old.pendingTarget === null
        ? old : { position: elapsed, pendingTarget: null });
      return;
    }

    const now = performance.now();
    const request = seekRequest?.activeId === activeId ? seekRequest : null;
    const requested = request && lastRequestId.current !== request.id;
    if (requested) {
      lastRequestId.current = request.id;
      samples.current = [];
    }
    if (request?.failed && lastFailedId.current !== request.id) {
      lastFailedId.current = request.id;
      samples.current = [];
    }
    if (!request || request.confirmedAt || request.failed) samples.current.push({ at: now, elapsed });
    const threshold = now - bufferMs;
    let ready = null;
    while (samples.current.length && samples.current[0].at <= threshold) ready = samples.current.shift();

    setDisplay((old) => {
      const position = botPlaying && ready ? ready.elapsed : old.position;
      const pendingTarget = request?.failed || (request?.confirmedAt && botPlaying && ready)
        ? null : requested ? request.target : old.pendingTarget;
      return position === old.position && pendingTarget === old.pendingTarget
        ? old : { position, pendingTarget };
    });
  }, [elapsed, activeId, enabled, botPlaying, bufferMs, seekRequest, clock]);

  return display;
}
