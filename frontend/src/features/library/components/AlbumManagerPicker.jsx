import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';
import { albumIdsOf } from '../lib/trackAlbums.js';

export default function AlbumManagerPicker({ albums, selectedAlbum, tracks, onSwitchAlbum }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.focus();
    const closeOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const chooseAlbum = (id) => {
    onSwitchAlbum(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleListKeys = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...listRef.current.querySelectorAll('[role="option"]')];
    const index = options.indexOf(document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    options[next]?.focus();
    options[next]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div
      className="album-manager-select"
      ref={pickerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className="album-manager-trigger"
        aria-label="Álbum activo"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="album-manager-trigger-name">
          {selectedAlbum?.name || 'Selecciona un álbum'}
        </span>
        <span className="album-manager-trigger-count">
          {tracks.filter((track) => albumIdsOf(track).includes(selectedAlbum?.id)).length}
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div
          className="album-manager-menu"
          id={listId}
          role="listbox"
          aria-label="Álbumes disponibles"
          ref={listRef}
          onKeyDown={handleListKeys}
        >
          {albums.map((album) => {
            const count = tracks.filter((track) => albumIdsOf(track).includes(album.id)).length;
            const selected = album.id === selectedAlbum?.id;
            return (
              <button
                key={album.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => chooseAlbum(album.id)}
              >
                <span className="album-manager-option-name">{album.name}</span>
                <span className="album-manager-option-count">
                  {count} {count === 1 ? 'canción' : 'canciones'}
                </span>
                <span className="album-manager-option-check" aria-hidden="true">
                  {selected && <Icon name="check" size={15} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
