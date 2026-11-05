import Icon from '../ui/Icon.jsx';

export default function MusicModal({ modal, albumName, onAlbumNameChange, editingTrack, albums, editingAlbumIds, onEditingAlbumIdsChange, url, onUrlChange, title, onTitleChange, message, onClearMessage, onClose, onCreateAlbum, onRenameAlbum, onDeleteAlbum, onAddLink, onSaveEdit, onUploadClick, onShareTab }) {
  if (!modal) return null;
  const isAlbum = modal.startsWith('album');

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div>
            <span className="section-label">{isAlbum ? 'TU BIBLIOTECA' : modal === 'add' ? 'NUEVA FUENTE' : 'MODIFICAR PISTA'}</span>
            <h2 id="modal-title">{modal === 'album-add' ? 'Crear álbum' : modal === 'album-edit' ? 'Editar álbum' : modal === 'add' ? 'Añadir música' : 'Editar canción'}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        {isAlbum ? (
          <>
            <form onSubmit={modal === 'album-add' ? onCreateAlbum : onRenameAlbum}>
              <label htmlFor="album-name">Nombre del álbum</label>
              <input id="album-name" type="text" maxLength="80" placeholder="Por ejemplo: Favoritas" value={albumName} onChange={(event) => onAlbumNameChange(event.target.value)} required autoFocus />
              {message && <p className="form-error" role="alert">{message}</p>}
              <button type="submit" className="submit-button">{modal === 'album-add' ? 'Crear álbum' : 'Guardar nombre'} <span>→</span></button>
            </form>
            {modal === 'album-edit' && <button type="button" className="delete-album" onClick={onDeleteAlbum}>Eliminar álbum</button>}
          </>
        ) : (
          <>
            <form onSubmit={modal === 'add' ? onAddLink : onSaveEdit}>
              {(modal === 'add' || ['url', 'youtube', 'spotify'].includes(editingTrack?.kind)) && (
                <>
                  <label htmlFor="audio-url">Enlace de YouTube, Spotify o archivo de audio</label>
                  <input id="audio-url" type="url" placeholder="YouTube, open.spotify.com/track/... o canción.mp3" value={url} onChange={(event) => { onUrlChange(event.target.value); onClearMessage(); }} required />
                </>
              )}
              <label htmlFor="audio-title">{modal === 'add' ? 'Nombre opcional' : 'Nombre de la canción'}</label>
              <input id="audio-title" type="text" placeholder="Mi canción" value={title} onChange={(event) => onTitleChange(event.target.value)} />
              {modal === 'edit' && <fieldset className="track-albums">
                <legend>Guardar en álbumes</legend>
                <div className="track-album-options">
                  {albums.map((album) => <label key={album.id} className="track-album-option">
                    <input type="checkbox" checked={editingAlbumIds.includes(album.id)} onChange={(event) => onEditingAlbumIdsChange((current) => event.target.checked ? [...current, album.id] : current.filter((id) => id !== album.id))} />
                    <span>{album.name}</span>
                  </label>)}
                </div>
              </fieldset>}
              {message && <p className="form-error" role="alert">{message}</p>}
              <button type="submit" className="submit-button">{modal === 'add' ? 'Añadir a la lista' : 'Guardar cambios'} <span>→</span></button>
            </form>
            {modal === 'add' && (
              <>
                <p className="modal-help">Acepta canciones o episodios de Spotify, enlaces de YouTube y URLs directas a MP3, WAV u OGG. Spotify puede pedir inicio de sesión o limitar la escucha a una vista previa.</p>
                <div className="modal-divider"><span>O ELIGE OTRA OPCIÓN</span></div>
                <div className="modal-options">
                  <button type="button" onClick={onUploadClick}><span><Icon name="upload" size={19} /></span><div><strong>Subir archivos</strong><small>Audio guardado en tu dispositivo</small></div><b>→</b></button>
                  <button type="button" onClick={onShareTab}><span><Icon name="screen" size={19} /></span><div><strong>Compartir pestaña</strong><small>Elige una pestaña y activa su audio</small></div><b>→</b></button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
