import { createPortal } from 'react-dom';

export default function VolumePopover({ open, position, popoverRef, volume, onChange }) {
  if (!open || !position) return null;
  return createPortal(
    <div ref={popoverRef} className="volume-popover" id="volume-slider" style={position}>
      <input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onChange(Number(event.target.value))} style={{ '--range-progress': volume * 100 + '%' }} />
    </div>,
    document.body,
  );
}
