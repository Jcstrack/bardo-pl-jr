import { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';

export default function AlbumPicker({ albums, selectedAlbum, selectedAlbumId, onSwitch, onCreate, onEdit }) {
  const [open, setOpen] = useState(false);
  const selectorRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (!selectorRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return (
    <div className="album-toolbar">
      <span className="section-label">ÁLBUM</span>
      <div className="album-actions">
        <div className="album-selector" ref={selectorRef}>
          <button type="button" className="album-select-button" aria-label="Seleccionar álbum" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((old) => !old)} disabled={!albums.length} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
            <span>{selectedAlbum?.name || 'Sin álbumes'}</span><Icon name="chevron" size={15} />
          </button>
          {open && <div className="album-menu" role="listbox" aria-label="Álbumes">
            {albums.map((album) => <button key={album.id} type="button" role="option" aria-selected={album.id === selectedAlbumId} onClick={() => { onSwitch(album.id); setOpen(false); }}>{album.name}</button>)}
          </div>}
        </div>
        <button type="button" aria-label="Crear álbum" title="Crear álbum" onClick={onCreate}><Icon name="plus" size={17} /></button>
        <button type="button" aria-label="Editar álbum" title="Editar álbum" onClick={onEdit} disabled={!selectedAlbum}><Icon name="edit" size={16} /></button>
      </div>
    </div>
  );
}
