import Icon from '../ui/Icon.jsx';

export default function PlayerWindowHeader({ minimized, maximized, onDragStart, onDragMove, onDragEnd, onExpand, onMaximize, onMinimize, onClose }) {
  return (
    <div className="drag-bar" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
      <div className="drag-brand"><span className="live-dot" /> SONORA PLAYER</div>
      <div className="window-actions">
        <span className="drag-hint" aria-hidden="true"><Icon name="grip" size={14} /></span>
        {minimized ? (
          <button type="button" aria-label="Expandir reproductor" title="Expandir reproductor" onClick={onExpand}><Icon name="expand" size={15} /></button>
        ) : (
          <>
            <button type="button" aria-label="Minimizar reproductor" title="Minimizar reproductor" onClick={onMinimize}><Icon name="minus" size={16} /></button>
            <button type="button" aria-label={maximized ? "Restaurar ventana flotante" : "Maximizar reproductor"} title={maximized ? "Restaurar ventana flotante" : "Maximizar reproductor"} onClick={maximized ? onExpand : onMaximize}><Icon name={maximized ? "restore" : "maximize"} size={15} /></button>
          </>
        )}
        <button type="button" aria-label="Cerrar reproductor" title="Cerrar reproductor" onClick={onClose}><Icon name="close" size={15} /></button>
      </div>
    </div>
  );
}
