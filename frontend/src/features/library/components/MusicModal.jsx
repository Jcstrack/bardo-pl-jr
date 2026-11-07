import { useEffect, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';
import AlbumManagerPicker from './AlbumManagerPicker.jsx';
import AlbumOrderList from './AlbumOrderList.jsx';

export default function MusicModal({
  modal,
  albumName,
  onAlbumNameChange,
  selectedAlbum,
  albumTracks,
  allTracks,
  onSwitchAlbum,
  onOpenCreateAlbum,
  onReorderTrack,
  onEditTrack,
  editingTrack,
  editFromAlbumManager,
  onBackToAlbumManager,
  albums,
  editingAlbumIds,
  onEditingAlbumIdsChange,
  url,
  onUrlChange,
  title,
  onTitleChange,
  message,
  onClearMessage,
  onClose,
  onCreateAlbum,
  onRenameAlbum,
  onDeleteAlbum,
  deletingAlbum,
  onAddLink,
  onSaveEdit,
  onUploadClick,
  onShareTab,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [modal, selectedAlbum?.id]);
  useEffect(() => {
    if (!modal) return;
    const closeEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeEscape);
    return () => document.removeEventListener('keydown', closeEscape);
  }, [modal, onClose]);
  if (!modal) return null;
  const isAlbum = modal.startsWith('album');

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={
          'add-modal ' +
          (modal === 'edit'
            ? 'add-modal--edit'
            : modal === 'album-edit'
              ? 'add-modal--album-manager'
              : '')
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-header-main">
            {modal === 'edit' && editFromAlbumManager && (
              <button
                type="button"
                className="modal-back"
                aria-label="Volver a administrar álbumes"
                title="Volver a administrar álbumes"
                onClick={onBackToAlbumManager}
              >
                <Icon name="back" size={18} />
              </button>
            )}
            <div>
              <span className="section-label">
                {isAlbum ? 'TU BIBLIOTECA' : modal === 'add' ? 'NUEVA FUENTE' : 'MODIFICAR PISTA'}
              </span>
              <h2 id="modal-title">
                {modal === 'album-add'
                  ? 'Crear álbum'
                  : modal === 'album-edit'
                    ? 'Administrar álbumes'
                    : modal === 'add'
                      ? 'Añadir música'
                      : 'Editar canción'}
              </h2>
            </div>
          </div>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {isAlbum ? (
          <>
            {modal === 'album-edit' && (
              <div className="album-manager-picker">
                <span className="album-manager-label">Álbum activo</span>
                <div className="album-manager-picker-row">
                  <AlbumManagerPicker
                    albums={albums}
                    selectedAlbum={selectedAlbum}
                    tracks={allTracks}
                    onSwitchAlbum={onSwitchAlbum}
                  />
                  <button type="button" className="album-manager-new" onClick={onOpenCreateAlbum}>
                    <Icon name="plus" size={16} /> Nuevo
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={modal === 'album-add' ? onCreateAlbum : onRenameAlbum}>
              <label htmlFor="album-name">Nombre del álbum</label>
              <input
                id="album-name"
                type="text"
                maxLength="80"
                placeholder="Por ejemplo: Favoritas"
                value={albumName}
                onChange={(event) => onAlbumNameChange(event.target.value)}
                required
                autoFocus
              />
              {message && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <button type="submit" className="submit-button">
                {modal === 'album-add' ? 'Crear álbum' : 'Guardar nombre'} <span>→</span>
              </button>
            </form>
            {modal === 'album-edit' && (
              <>
                <div className="album-order-heading">
                  <div>
                    <span className="section-label">CANCIONES</span>
                    <h3>
                      Orden de reproducción <span>{albumTracks.length}</span>
                    </h3>
                  </div>
                  <p>Arrastra el icono o usa Alt + ↑/↓.</p>
                </div>
                <AlbumOrderList
                  tracks={albumTracks}
                  onReorder={onReorderTrack}
                  onEditTrack={onEditTrack}
                />
                {confirmDelete ? (
                  <div className="album-delete-confirm" role="group" aria-label="Confirmar eliminación del álbum">
                    <p>
                      ¿Eliminar «{selectedAlbum?.name}»? Las canciones que también estén en otros álbumes se conservarán.
                    </p>
                    <div className="album-delete-actions">
                      <button type="button" onClick={() => setConfirmDelete(false)} disabled={deletingAlbum}>
                        Cancelar
                      </button>
                      <button type="button" className="delete-album" onClick={onDeleteAlbum} disabled={deletingAlbum}>
                        {deletingAlbum ? 'Eliminando…' : 'Sí, eliminar álbum'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="delete-album" onClick={() => setConfirmDelete(true)}>
                    Eliminar álbum
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <form onSubmit={modal === 'add' ? onAddLink : onSaveEdit}>
              {(modal === 'add' || ['url', 'youtube', 'spotify'].includes(editingTrack?.kind)) && (
                <>
                  <label htmlFor="audio-url">Enlace de YouTube, Spotify o archivo de audio</label>
                  <input
                    id="audio-url"
                    type="url"
                    placeholder="YouTube, open.spotify.com/track/... o canción.mp3"
                    value={url}
                    onChange={(event) => {
                      onUrlChange(event.target.value);
                      onClearMessage();
                    }}
                    required
                  />
                </>
              )}
              <label htmlFor="audio-title">
                {modal === 'add' ? 'Nombre opcional' : 'Nombre de la canción'}
              </label>
              <input
                id="audio-title"
                type="text"
                placeholder="Mi canción"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
              />
              {modal === 'edit' && (
                <fieldset className="track-albums">
                  <legend>Guardar en álbumes</legend>
                  <p className="track-albums-hint">Puedes seleccionar más de un álbum.</p>
                  <div className="track-album-options">
                    {albums.map((album) => (
                      <label key={album.id} className="track-album-option">
                        <input
                          type="checkbox"
                          checked={editingAlbumIds.includes(album.id)}
                          onChange={(event) =>
                            onEditingAlbumIdsChange((current) =>
                              event.target.checked
                                ? [...current, album.id]
                                : current.filter((id) => id !== album.id),
                            )
                          }
                        />
                        <span className="track-album-check-visual" aria-hidden="true">
                          <Icon name="check" size={13} />
                        </span>
                        <span className="track-album-name" title={album.name}>
                          {album.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {message && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <button type="submit" className="submit-button">
                {modal === 'add' ? 'Añadir a la lista' : 'Guardar cambios'} <span>→</span>
              </button>
            </form>
            {modal === 'add' && (
              <>
                <p className="modal-help">
                  Acepta canciones o episodios de Spotify, enlaces de YouTube y URLs directas a MP3,
                  WAV u OGG. Spotify puede pedir inicio de sesión o limitar la escucha a una vista
                  previa.
                </p>
                <div className="modal-divider">
                  <span>O ELIGE OTRA OPCIÓN</span>
                </div>
                <div className="modal-options">
                  <button type="button" onClick={onUploadClick}>
                    <span>
                      <Icon name="upload" size={19} />
                    </span>
                    <div>
                      <strong>Subir archivos</strong>
                      <small>Audio guardado en tu dispositivo</small>
                    </div>
                    <b>→</b>
                  </button>
                  <button type="button" onClick={onShareTab}>
                    <span>
                      <Icon name="screen" size={19} />
                    </span>
                    <div>
                      <strong>Compartir pestaña</strong>
                      <small>Elige una pestaña y activa su audio</small>
                    </div>
                    <b>→</b>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
