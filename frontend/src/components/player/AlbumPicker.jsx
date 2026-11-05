import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchTracks } from '../../lib/searchTracks.js';
import { albumIdsOf } from '../../lib/trackAlbums.js';
import Icon from '../ui/Icon.jsx';

export default function AlbumPicker({ albums, selectedAlbum, selectedAlbumId, tracks = [], onSwitch, onCreate, onEdit, onChooseTrack }) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const selectorRef = useRef(null);
  const moreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const selectorButtonRef = useRef(null);
  const searchRef = useRef(null);
  const searchButtonRef = useRef(null);
  const resultsRef = useRef(null);
  const inputRef = useRef(null);
  const searchId = useId();

  useEffect(() => {
    if (!open) return;
    selectorRef.current?.querySelector('[role="option"][aria-selected="true"]')?.focus();
    const closeOutside = (event) => {
      if (!selectorRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOutside = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    inputRef.current?.focus();
    const closeOutside = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        searchButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [searchOpen]);

  const results = useMemo(() => searchOpen ? searchTracks(tracks, query) : [], [tracks, query, searchOpen]);
  const highlightedIndex = Math.min(activeResultIndex, results.length - 1);
  useEffect(() => {
    if (highlightedIndex < 0) return;
    resultsRef.current?.querySelectorAll('[role="option"]')[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, query]);
  const chooseResult = (id) => {
    onChooseTrack?.(id);
    setSearchOpen(false);
    setQuery('');
    setActiveResultIndex(-1);
    searchButtonRef.current?.focus();
  };

  const handleSearchKeys = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      setActiveResultIndex((index) => event.key === 'ArrowDown'
        ? Math.min(index + 1, results.length - 1)
        : index < 0 ? results.length - 1 : Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && results.length) {
      event.preventDefault();
      chooseResult(results[Math.max(0, highlightedIndex)].track.id);
    }
  };

  const handleAlbumKeys = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      selectorButtonRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = [...event.currentTarget.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    options[next].focus();
    options[next].scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="album-toolbar">
      <span className="section-label">ÁLBUM</span>
      <div className="album-actions">
        <div className="album-selector" ref={selectorRef}>
          <button ref={selectorButtonRef} type="button" className="album-select-button" aria-label="Seleccionar álbum" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setSearchOpen(false); setOpen((old) => !old); }} disabled={!albums.length} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } else if (event.key === 'Escape') setOpen(false); }}>
            <span>{selectedAlbum?.name || 'Sin álbumes'}</span><Icon name="chevron" size={15} />
          </button>
          {open && <div className="album-menu" role="listbox" aria-label="Álbumes" onKeyDown={handleAlbumKeys}>
            {albums.map((album) => <button key={album.id} type="button" role="option" aria-selected={album.id === selectedAlbumId} onClick={() => { onSwitch(album.id); setOpen(false); setSearchOpen(false); setQuery(''); selectorButtonRef.current?.focus(); }}>{album.name}</button>)}
          </div>}
        </div>
        <div className="album-search" ref={searchRef}>
          <button ref={searchButtonRef} type="button" aria-label="Buscar canciones en todos los álbumes" aria-expanded={searchOpen} aria-controls={searchId} title="Buscar en toda la biblioteca" onClick={() => { setOpen(false); setActiveResultIndex(-1); setSearchOpen((old) => !old); }} disabled={!tracks.length}><Icon name="search" size={16} /></button>
          {searchOpen && <div className="album-search-popover" id={searchId}>
            <label htmlFor={searchId + '-input'}>Buscar en todos los álbumes</label>
            <input ref={inputRef} id={searchId + '-input'} type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={searchId + '-results'} aria-activedescendant={highlightedIndex >= 0 ? searchId + '-result-' + highlightedIndex : undefined} placeholder="Título o artista…" autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setActiveResultIndex(-1); }} onKeyDown={handleSearchKeys} />
            <div ref={resultsRef} className="album-search-results" id={searchId + '-results'} role="listbox" aria-label="Resultados de canciones" aria-live="polite">
              {results.length ? results.map(({ track }, index) => {
                const albumNames = albums.filter((album) => albumIdsOf(track).includes(album.id)).map((album) => album.name);
                return <button key={track.id} id={searchId + '-result-' + index} type="button" role="option" aria-selected={index === highlightedIndex} tabIndex={-1} onMouseEnter={() => setActiveResultIndex(index)} onClick={() => chooseResult(track.id)}><span className="album-search-copy"><strong>{track.title}</strong><small>{track.artist || 'Sin artista'}{albumNames.length ? ' · ' + albumNames.join(', ') : ''}</small></span><Icon name="play" size={13} /></button>;
              }) : <p>No hay canciones que coincidan.</p>}
            </div>
          </div>}
        </div>
        <div className="album-more" ref={moreRef}>
          <button ref={moreButtonRef} type="button" className="album-more-toggle" aria-label="Más opciones de álbum" aria-haspopup="menu" aria-expanded={moreOpen} title="Más opciones de álbum" onClick={() => { setOpen(false); setSearchOpen(false); setMoreOpen((old) => !old); }}><Icon name="more" size={17} /></button>
          {moreOpen && <div className="album-more-menu" role="menu" aria-label="Opciones de álbum">
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onEdit(); }} disabled={!selectedAlbum}><Icon name="edit" size={15} /> Administrar álbum</button>
            <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onCreate(); }}><Icon name="plus" size={15} /> Crear álbum</button>
          </div>}
        </div>
      </div>
    </div>
  );
}
