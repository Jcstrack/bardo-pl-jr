import Icon from '../../../components/ui/Icon.jsx';
import AlbumPicker from './AlbumPicker.jsx';
import TrackList from './TrackList.jsx';

export default function MiniLibrary({
  albums,
  selectedAlbumId,
  selectedAlbum,
  albumTracks,
  allTracks,
  activeId,
  playing,
  captureMode,
  onSwitchAlbum,
  onCreateAlbum,
  onEditAlbum,
  onChooseTrack,
  onEditTrack,
  onRemoveTrack,
  onReorderTrack,
  onAddMusic,
}) {
  return (
    <div className="mini-library" id="mini-library" aria-label="Álbumes y canciones">
      <div className="mini-library-heading">
        <span>Tu biblioteca</span>
        <small>
          {albumTracks.length} {albumTracks.length === 1 ? 'canción' : 'canciones'}
        </small>
      </div>
      <AlbumPicker
        albums={albums}
        selectedAlbum={selectedAlbum}
        selectedAlbumId={selectedAlbumId}
        tracks={allTracks}
        onSwitch={onSwitchAlbum}
        onCreate={onCreateAlbum}
        onEdit={onEditAlbum}
        onChooseTrack={onChooseTrack}
      />
      <TrackList
        albumTracks={albumTracks}
        selectedAlbum={selectedAlbum}
        activeId={activeId}
        playing={playing}
        captureMode={captureMode}
        onChoose={onChooseTrack}
        onEdit={onEditTrack}
        onRemove={onRemoveTrack}
        onReorder={onReorderTrack}
      />
      <button
        type="button"
        className="add-button"
        onClick={selectedAlbum ? onAddMusic : onCreateAlbum}
      >
        <Icon name="plus" size={15} /> {selectedAlbum ? 'Añadir música' : 'Crear álbum'}
      </button>
    </div>
  );
}
