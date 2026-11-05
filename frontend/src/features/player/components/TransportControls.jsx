import Icon from '../../../components/ui/Icon.jsx';

export default function TransportControls({
  active,
  live,
  tabConnected,
  captureMode,
  canControlPlayback,
  playbackCount,
  playing,
  repeat,
  volume,
  volumeOpen,
  volumeButtonRef,
  minimized,
  libraryOpen,
  onPrevious,
  onStep,
  onPlay,
  onPlayMenu,
  onRepeatToggle,
  onRepeatMenu,
  onVolumeToggle,
  onMuteToggle,
  onLibraryToggle,
}) {
  return (
    <div className="transport">
      <button
        type="button"
        className="control secondary"
        aria-label="Reiniciar o ir a la pista anterior"
        title="Una vez: reiniciar · dos veces: pista anterior"
        onClick={onPrevious}
        disabled={!active}
      >
        <Icon name="previous" size={18} />
      </button>
      <button
        type="button"
        className="control primary"
        aria-label={playing ? 'Pausar' : 'Reproducir'}
        title={
          live && !tabConnected
            ? 'Conecta la pestaña con la extensión Bardo'
            : (playing ? 'Pausar' : 'Reproducir') +
              ' · clic derecho para marcar inicio, pausa o siguiente'
        }
        onClick={onPlay}
        onContextMenu={onPlayMenu}
        disabled={!canControlPlayback}
      >
        <Icon name={playing ? 'pause' : 'play'} size={23} />
      </button>
      <button
        type="button"
        className="control secondary"
        aria-label="Siguiente pista"
        title="Siguiente pista"
        onClick={() => onStep(1)}
        disabled={!active || (!live && playbackCount < 2)}
      >
        <Icon name="next" size={18} />
      </button>
      <button
        type="button"
        className={'control repeat ' + (repeat ? 'active' : '')}
        aria-label="Repetir esta canción"
        aria-pressed={repeat}
        title="Repetir · clic derecho para marcar un tramo"
        onClick={onRepeatToggle}
        onContextMenu={onRepeatMenu}
        disabled={!active}
      >
        <Icon name="repeat" size={20} />
        <small>1</small>
      </button>
      <button
        ref={minimized ? null : volumeButtonRef}
        type="button"
        className={'control volume-toggle ' + (volumeOpen ? 'active' : '')}
        aria-label="Volumen; clic derecho para silenciar o activar sonido"
        aria-expanded={volumeOpen}
        aria-controls="volume-slider"
        title="Volumen · clic derecho para silenciar"
        onClick={onVolumeToggle}
        onContextMenu={onMuteToggle}
        disabled={active?.kind === 'spotify' || (live && captureMode !== 'monitor')}
      >
        <Icon name={volume === 0 ? 'muted' : 'volume'} size={20} />
      </button>
      <button
        type="button"
        className={'control library-toggle ' + (libraryOpen ? 'active' : '')}
        aria-label={libraryOpen ? 'Ocultar álbum y canciones' : 'Mostrar álbum y canciones'}
        aria-expanded={libraryOpen}
        title="Álbum y canciones"
        onClick={onLibraryToggle}
      >
        <Icon name="list" size={19} />
      </button>
    </div>
  );
}
