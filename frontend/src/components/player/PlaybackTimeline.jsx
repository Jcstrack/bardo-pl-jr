import { useRef, useState } from 'react';
import { clamp, time } from '../../lib/playerMath.js';

export default function PlaybackTimeline({ active, mediaIsLive, duration, elapsed, pendingSeek, discordDelayed, discordPlaying, loopStart, loopEnd, playStart, playEnd, onSeek, onSetLoopMarker, onSetPlayMarker }) {
  const timelineRef = useRef(null);
  const markerDragRef = useRef(null);
  const scrubbingRef = useRef(false);
  const scrubValueRef = useRef(null);
  const ignoreTrailingChangeRef = useRef(0);
  const [scrub, setScrub] = useState(null);
  const scrubPosition = scrub?.activeId === active?.id ? scrub.position : null;
  // El punto principal sigue la posición solicitada. La marca secundaria
  // conserva la posición que el bot todavía está terminando de emitir.
  const shownElapsed = scrubPosition ?? pendingSeek ?? elapsed;

  return (
    <div className="timeline">
      {mediaIsLive ? (
        <div className="live-timeline" role="status"><span className="live-timeline-dot" /> EN VIVO <small>Sin línea de tiempo disponible</small></div>
      ) : (
        <>
          <div className="timeline-track" ref={timelineRef}>
            {(loopStart !== null || loopEnd !== null) && duration > 0 && (
              <div className="loop-region" style={{ left: ((loopStart ?? 0) / duration * 100) + '%', right: (100 - (loopEnd ?? duration) / duration * 100) + '%' }} />
            )}
            {(playStart !== null || playEnd !== null) && duration > 0 && (
              <div className="playback-region" style={{ left: ((playStart ?? 0) / duration * 100) + '%', right: (100 - (playEnd ?? duration) / duration * 100) + '%' }} />
            )}
            <input
              aria-label="Posición de la canción"
              type="range"
              min="0"
              max={duration || 1}
              step="0.01"
              value={Math.min(shownElapsed, duration || 1)}
              disabled={!active || !duration}
              onPointerDown={(event) => {
                scrubbingRef.current = true;
                scrubValueRef.current = null;
                ignoreTrailingChangeRef.current = 0;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (!scrubbingRef.current) return;
                scrubbingRef.current = false;
                const rect = event.currentTarget.getBoundingClientRect();
                const nativeValue = Number(event.currentTarget.value);
                const target = scrubValueRef.current ?? (Math.abs(nativeValue - shownElapsed) > 0.01
                  ? nativeValue
                  : rect.width ? clamp((event.clientX - rect.left) / rect.width, 0, 1) * duration : nativeValue);
                scrubValueRef.current = null;
                // Algunos navegadores emiten un último change después de pointerup.
                // Ese evento puede contener el valor anterior del control gobernado
                // por React y enviaría un segundo salto hacia atrás.
                ignoreTrailingChangeRef.current = performance.now() + 300;
                setScrub(null);
                onSeek(target);
              }}
              onPointerCancel={() => { scrubbingRef.current = false; scrubValueRef.current = null; ignoreTrailingChangeRef.current = performance.now() + 300; setScrub(null); }}
              onChange={(event) => {
                const target = Number(event.target.value);
                if (scrubbingRef.current) {
                  scrubValueRef.current = target;
                  setScrub({ activeId: active?.id, position: target });
                }
                else if (performance.now() >= ignoreTrailingChangeRef.current) onSeek(target);
              }}
              onKeyDown={() => { ignoreTrailingChangeRef.current = 0; }}
              style={{ '--range-progress': (duration ? clamp((shownElapsed / duration) * 100, 0, 100) : 0) + '%' }}
            />
            {pendingSeek !== null && duration > 0 && scrubPosition === null && (
              <span className="seek-pending-marker" style={{ left: clamp(elapsed / duration * 100, 0, 100) + '%' }} aria-hidden="true" />
            )}
            {duration > 0 && ([
              ['loopStart', loopStart, 'Inicio de repetición', onSetLoopMarker],
              ['loopEnd', loopEnd, 'Fin de repetición', onSetLoopMarker],
              ['playStart', playStart, 'Inicio de reproducción', onSetPlayMarker],
              ['playEnd', playEnd, 'Término de reproducción', onSetPlayMarker],
            ]).map(([kind, value, label, onMove]) => value !== null && (
              <button
                key={kind}
                type="button"
                className={'loop-marker ' + kind}
                style={{ left: (value / duration * 100) + '%' }}
                aria-label={label + ': ' + time(value) + '. Arrastra o usa las flechas.'}
                title={label + ': ' + time(value)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  markerDragRef.current = kind;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (markerDragRef.current !== kind) return;
                  const rect = timelineRef.current.getBoundingClientRect();
                  onMove(kind, (event.clientX - rect.left) / rect.width * duration);
                }}
                onPointerUp={() => { markerDragRef.current = null; }}
                onPointerCancel={() => { markerDragRef.current = null; }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  onMove(kind, value + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1));
                }}
              />
            ))}
          </div>
          <div className="time-row"><span>{time(shownElapsed)}</span><span>{time(duration)}</span></div>
          {discordDelayed && <div className="timeline-caption" role="status">{pendingSeek !== null ? `Destino ${time(pendingSeek)} · bot en ${time(elapsed)}` : discordPlaying ? 'Posición estimada de la salida del bot' : 'Esperando audio del bot…'}</div>}
        </>
      )}
    </div>
  );
}
