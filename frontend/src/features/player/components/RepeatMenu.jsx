import { createPortal } from 'react-dom';
import { time } from '../lib/playerMath.js';

export default function RepeatMenu({
  position,
  duration,
  elapsed,
  loopStart,
  loopEnd,
  onSetMarker,
  onClear,
  onClose,
}) {
  if (!position) return null;
  const finishAt = Math.min(duration, Math.max(elapsed + 10, (loopStart ?? 0) + 10));
  return createPortal(
    <div className="repeat-menu" style={position} role="menu" aria-label="Opciones de repetición">
      <span className="repeat-menu-title">REPETIR TRAMO</span>
      <button
        type="button"
        role="menuitem"
        disabled={!duration}
        onClick={() => {
          onSetMarker('loopStart', elapsed);
          onClose();
        }}
      >
        Marcar inicio <small>{time(elapsed)}</small>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!duration}
        onClick={() => {
          onSetMarker('loopEnd', finishAt);
          onClose();
        }}
      >
        Marcar fin <small>{time(finishAt)}</small>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={loopStart === null && loopEnd === null}
        onClick={onClear}
      >
        Quitar marcas
      </button>
    </div>,
    document.body,
  );
}
