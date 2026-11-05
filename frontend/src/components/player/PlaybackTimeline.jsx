import { useRef, useState } from 'react';
import { clamp, time } from '../../lib/playerMath.js';

export default function PlaybackTimeline({ active, mediaIsLive, duration, elapsed, pendingSeek, discordDelayed, discordPlaying, loopStart, loopEnd, playStart, playEnd, playNext, onSeek, onKeyboardSeek, onSetLoopMarker, onSetPlayMarker }) {
  const timelineRef = useRef(null);
  const markerDragRef = useRef(null);
  const scrubbingRef = useRef(false);
  const [scrub, setScrub] = useState(null);
  const scrubPosition = scrub?.activeId === active?.id ? scrub.position : null;
  // El punto principal sigue la posición solicitada. La marca secundaria
  // conserva la posición que el bot todavía está terminando de emitir.
  const shownElapsed = scrubPosition ?? pendingSeek ?? elapsed;
  const playFinish = playNext ?? playEnd;
  const positionAt = (clientX) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    return rect?.width ? clamp((clientX - rect.left) / rect.width, 0, 1) * duration : shownElapsed;
  };

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
            {playStart !== null && playFinish !== null && duration > 0 && (
              <div className={'playback-region' + (playNext !== null ? ' playback-region--next' : '')} style={{ left: (playStart / duration * 100) + '%', right: (100 - playFinish / duration * 100) + '%' }} />
            )}
            <input
              aria-label="Posición de la canción"
              title="Flechas: 1 segundo · Mayús + flechas: 10 segundos · Inicio/Fin: extremos"
              type="range"
              min="0"
              max={duration || 1}
              step="0.01"
              value={Math.min(shownElapsed, duration || 1)}
              disabled={!active || !duration}
              onPointerDown={(event) => {
                scrubbingRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                setScrub({ activeId: active?.id, position: positionAt(event.clientX) });
              }}
              onPointerMove={(event) => {
                if (scrubbingRef.current)
                  setScrub({ activeId: active?.id, position: positionAt(event.clientX) });
              }}
              onPointerUp={(event) => {
                if (!scrubbingRef.current) return;
                scrubbingRef.current = false;
                const target = positionAt(event.clientX);
                setScrub(null);
                onSeek(target);
              }}
              onPointerCancel={() => { scrubbingRef.current = false; setScrub(null); }}
              onChange={() => {
                // El valor nativo puede llegar después de pointerup y contener
                // la posición anterior. Los saltos se confirman solo al soltar.
              }}
              onKeyDown={(event) => {
                if (!duration || !active) return;
                onKeyboardSeek(event, shownElapsed);
              }}
              style={{ '--range-progress': (duration ? clamp((shownElapsed / duration) * 100, 0, 100) : 0) + '%' }}
            />
            {pendingSeek !== null && duration > 0 && scrubPosition === null && (
              <span className="seek-pending-marker" style={{ left: clamp(elapsed / duration * 100, 0, 100) + '%' }} aria-hidden="true" />
            )}
            {duration > 0 && ([
              ['loopStart', loopStart, 'Inicio de repetición', onSetLoopMarker],
              ['loopEnd', loopEnd, 'Fin de repetición', onSetLoopMarker],
              ['playStart', playStart, 'Inicio de reproducción', onSetPlayMarker],
              ['playEnd', playEnd, 'Pausar reproducción', onSetPlayMarker],
              ['playNext', playNext, 'Pasar a la siguiente canción', onSetPlayMarker],
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
