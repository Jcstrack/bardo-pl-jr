import { createPortal } from 'react-dom';
import { time } from '../../lib/playerMath.js';

export default function PlaybackMenu({ position, duration, elapsed, playStart, playEnd, playNext, onSetMarker, onClear, onClose }) {
  if (!position) return null;
  const finishAt = Math.min(duration, Math.max(elapsed + 10, (playStart ?? 0) + 10));
  return createPortal(
    <div className="repeat-menu" style={position} role="menu" aria-label="Opciones de reproducción">
      <span className="repeat-menu-title">TRAMO DE REPRODUCCIÓN</span>
      <button type="button" role="menuitem" disabled={!duration} onClick={() => { onSetMarker('playStart', elapsed); onClose(); }}>Empezar aquí <small>{time(elapsed)}</small></button>
      <button type="button" role="menuitem" disabled={!duration} onClick={() => { onSetMarker('playEnd', finishAt); onClose(); }}>Pausar en <small>{time(finishAt)}</small></button>
      <button type="button" role="menuitem" disabled={!duration} onClick={() => { onSetMarker('playNext', finishAt); onClose(); }}>Siguiente en <small>{time(finishAt)}</small></button>
      <button type="button" role="menuitem" disabled={playStart === null && playEnd === null && playNext === null} onClick={onClear}>Quitar marcas</button>
    </div>,
    document.body,
  );
}
