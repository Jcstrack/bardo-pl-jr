import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';

export default function TrackList({
  albumTracks,
  selectedAlbum,
  activeId,
  playing,
  captureMode,
  onChoose,
  onEdit,
  onRemove,
  onReorder,
}) {
  const [draggedTrackId, setDraggedTrackId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const trackDragRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  const showContextMenu = (event, track) => {
    event.preventDefault();
    setContextMenu({
      track,
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 176)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 54)),
    });
  };

  const updateDrop = (event) => {
    if (!trackDragRef.current) return;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('.track-row');
    const targetId = row?.dataset.trackId;
    if (!targetId || targetId === trackDragRef.current.id) {
      trackDragRef.current.target = null;
      setDropTarget(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const target = { id: targetId, after: event.clientY > rect.top + rect.height / 2 };
    trackDragRef.current.target = target;
    setDropTarget(target);
  };

  const stopDrag = (commit) => {
    const drag = trackDragRef.current;
    if (commit && drag?.target) onReorder(drag.id, drag.target.id, drag.target.after);
    trackDragRef.current = null;
    setDraggedTrackId(null);
    setDropTarget(null);
  };

  const navigateWithKeyboard = (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest('.track-context-menu')
    )
      return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const rows = [...event.currentTarget.querySelectorAll(':scope > .track-row')];
    if (!rows.length) return;
    const currentIndex = rows.indexOf(event.target.closest('.track-row'));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : currentIndex < 0
            ? event.key === 'ArrowUp'
              ? rows.length - 1
              : 0
            : Math.max(
                0,
                Math.min(rows.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)),
              );
    const next = rows[nextIndex].querySelector('.track-title:not(:disabled)');
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div
      className="playlist"
      role="list"
      aria-label="Lista de reproducción. Usa flecha arriba o abajo para elegir una canción y Enter para reproducirla"
      tabIndex={albumTracks.length ? 0 : -1}
      onKeyDown={navigateWithKeyboard}
    >
      {albumTracks.length ? (
        albumTracks.map((track, index) => (
          <div
            key={track.id}
            data-track-id={track.id}
            role="listitem"
            className={
              'track-row ' +
              (track.id === activeId ? 'selected ' : '') +
              (track.id === draggedTrackId ? 'dragging ' : '') +
              (dropTarget?.id === track.id ? (dropTarget.after ? 'drop-after' : 'drop-before') : '')
            }
            onContextMenu={(event) => showContextMenu(event, track)}
          >
            <button
              type="button"
              className={'track-play ' + track.tone}
              onClick={() => onChoose(track.id)}
              aria-label={
                (track.id === activeId && playing ? 'Pausar ' : 'Reproducir ') + track.title
              }
              disabled={track.kind === 'capture' && captureMode === 'external'}
            >
              <Icon name={track.id === activeId && playing ? 'pause' : 'play'} size={14} />
            </button>
            <button
              type="button"
              className="track-title"
              onClick={() => onChoose(track.id)}
              onKeyDown={(event) => {
                if (event.shiftKey && event.key === 'F10') showContextMenu(event, track);
              }}
              aria-label={'Reproducir ' + track.title}
              title="Clic para reproducir · clic derecho para editar"
            >
              <span className="track-copy">
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </span>
            </button>
            <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
            <button
              type="button"
              className="track-grip"
              aria-label={'Mover ' + track.title + '. Arrastra o usa Alt y flechas arriba o abajo.'}
              title="Arrastrar para ordenar"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                trackDragRef.current = { id: track.id, target: null };
                setDraggedTrackId(track.id);
              }}
              onPointerMove={updateDrop}
              onPointerUp={() => stopDrag(true)}
              onPointerCancel={() => stopDrag(false)}
              onKeyDown={(event) => {
                if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const target = albumTracks[index + (event.key === 'ArrowDown' ? 1 : -1)];
                if (target) onReorder(track.id, target.id, event.key === 'ArrowDown');
              }}
            >
              <Icon name="grip" size={14} />
            </button>
            <button
              type="button"
              className="remove-button"
              aria-label={'Quitar ' + track.title + ' de este álbum'}
              title="Quitar de este álbum"
              onClick={() => onRemove(track.id)}
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty-list">
          <Icon name="music" size={20} />
          <span>
            {selectedAlbum
              ? 'Este álbum está vacío. Añade un enlace o un archivo de audio.'
              : 'Crea tu primer álbum para empezar.'}
          </span>
        </div>
      )}
      {contextMenu && (
        <div
          className="track-context-menu"
          role="menu"
          style={{ left: contextMenu.left, top: contextMenu.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onEdit(contextMenu.track);
              setContextMenu(null);
            }}
          >
            <Icon name="edit" size={14} /> Editar canción
          </button>
        </div>
      )}
    </div>
  );
}
