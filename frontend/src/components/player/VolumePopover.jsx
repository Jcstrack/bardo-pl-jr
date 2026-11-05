import { createPortal } from 'react-dom';
import Icon from '../ui/Icon.jsx';

export default function VolumePopover({ open, position, popoverRef, volume, onChange, onMuteToggle }) {
  if (!open || !position) return null;
  return createPortal(
    <div ref={popoverRef} className="volume-popover" id="volume-slider" style={position}>
      <button type="button" className="volume-mute" aria-label={volume === 0 ? 'Activar sonido' : 'Silenciar'} aria-pressed={volume === 0} title={volume === 0 ? 'Activar sonido' : 'Silenciar'} onClick={onMuteToggle}><Icon name={volume === 0 ? 'muted' : 'volume'} size={17} /></button>
      <input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onChange(Number(event.target.value))} style={{ '--range-progress': volume * 100 + '%' }} />
    </div>,
    document.body,
  );
}
