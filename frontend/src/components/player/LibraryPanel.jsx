import Icon from '../ui/Icon.jsx';
import AlbumPicker from './AlbumPicker.jsx';
import TrackList from './TrackList.jsx';
import Notice from '../ui/Notice.jsx';

export default function LibraryPanel({ albums, selectedAlbumId, selectedAlbum, albumTracks, allTracks, activeId, playing, captureMode, message, onSwitchAlbum, onCreateAlbum, onEditAlbum, onShareTab, onChooseTrack, onEditTrack, onRemoveTrack, onReorderTrack, onAddMusic, onDismissMessage }) {
  return (
    <>
      <AlbumPicker albums={albums} selectedAlbum={selectedAlbum} selectedAlbumId={selectedAlbumId} tracks={allTracks} onSwitch={onSwitchAlbum} onCreate={onCreateAlbum} onEdit={onEditAlbum} onChooseTrack={onChooseTrack} />
      <div className="playlist-header">
        <div>
          <span className="section-label">CANCIONES</span>
          <h3>{selectedAlbum?.name || 'Tu biblioteca'} <span>{albumTracks.length}</span></h3>
        </div>
        <button type="button" className="share-button" onClick={onShareTab} disabled={!selectedAlbum} title="Elegir una pestaña y compartir su audio"><Icon name="screen" size={13} /> Compartir pestaña</button>
      </div>
      <TrackList albumTracks={albumTracks} selectedAlbum={selectedAlbum} activeId={activeId} playing={playing} captureMode={captureMode} onChoose={onChooseTrack} onEdit={onEditTrack} onRemove={onRemoveTrack} onReorder={onReorderTrack} />
      <button type="button" className="add-button" onClick={selectedAlbum ? onAddMusic : onCreateAlbum}><Icon name="plus" size={15} /> {selectedAlbum ? 'Añadir música' : 'Crear álbum'}</button>
      <Notice message={message} onDismiss={onDismissMessage} />
    </>
  );
}
