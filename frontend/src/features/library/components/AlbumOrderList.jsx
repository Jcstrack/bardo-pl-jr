import { useRef, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';

export default function AlbumOrderList({ tracks, onReorder, onEditTrack }) {
  const dragRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [target, setTarget] = useState(null);

  const updateDrop = (event) => {
    if (!dragRef.current) return;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('.album-order-row');
    const id = row?.dataset.trackId;
    if (!id || id === dragRef.current.id) {
      dragRef.current.target = null;
      setTarget(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const next = { id, after: event.clientY > rect.top + rect.height / 2 };
    dragRef.current.target = next;
    setTarget(next);
  };

  const stopDrag = (commit) => {
    const drag = dragRef.current;
    if (commit && drag?.target) onReorder(drag.id, drag.target.id, drag.target.after);
    dragRef.current = null;
    setDraggedId(null);
    setTarget(null);
  };

  return (
    <div className="album-order-list" role="list" aria-label="Orden de canciones">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          data-track-id={track.id}
          role="listitem"
          className={
            'album-order-row ' +
            (draggedId === track.id ? 'dragging ' : '') +
            (target?.id === track.id ? (target.after ? 'drop-after' : 'drop-before') : '')
          }
        >
          <span className="album-order-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="album-order-title" title={track.title}>
            {track.title}
            <small>{track.artist || 'Sin artista'}</small>
          </span>
          <button
            type="button"
            className="album-order-edit"
            aria-label={'Editar ' + track.title}
            title="Editar canción"
            onClick={() => onEditTrack(track)}
          >
            <Icon name="edit" size={15} />
          </button>
          <button
            type="button"
            className="album-order-grip"
            aria-label={'Mover ' + track.title + '. Arrastra o usa Alt y flechas arriba o abajo.'}
            title="Arrastrar para ordenar"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { id: track.id, target: null };
              setDraggedId(track.id);
            }}
            onPointerMove={updateDrop}
            onPointerUp={() => stopDrag(true)}
            onPointerCancel={() => stopDrag(false)}
            onKeyDown={(event) => {
              if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const adjacent = tracks[index + (event.key === 'ArrowDown' ? 1 : -1)];
              if (adjacent) onReorder(track.id, adjacent.id, event.key === 'ArrowDown');
            }}
          >
            <Icon name="grip" size={17} />
          </button>
        </div>
      ))}
      {!tracks.length && <p className="album-order-empty">Este álbum aún no tiene canciones.</p>}
    </div>
  );
}
