import Icon from '../../../components/ui/Icon.jsx';
import Notice from '../../../components/ui/Notice.jsx';

export default function MiniPlayer({
  active,
  live,
  tabConnected,
  captureMode,
  playing,
  canControlPlayback,
  playbackCount,
  volume,
  volumeOpen,
  volumeButtonRef,
  repeat,
  libraryOpen,
  message,
  onPrevious,
  onStep,
  onPlay,
  onPlayMenu,
  onVolumeToggle,
  onMuteToggle,
  onRepeatToggle,
  onRepeatMenu,
  onOpenLibrary,
  onShowVideo,
  onDismissMessage,
}) {
  return (
    <div className="mini-content">
      <div className="mini-summary">
        <div className={'mini-art ' + (active?.tone || 'violet')}>
          <Icon name={live ? 'screen' : active?.kind === 'youtube' ? 'play' : 'music'} size={17} />
        </div>
        <div className="mini-track">
          <small>{live ? 'AUDIO EN VIVO' : 'REPRODUCIENDO'}</small>
          <strong>{active?.title || 'Tu música aquí'}</strong>
        </div>
      </div>
      <div className="mini-controls">
        <button
          type="button"
          aria-label="Reiniciar o ir a la pista anterior"
          title="Una vez: reiniciar · dos veces: pista anterior"
          onClick={onPrevious}
          disabled={!active}
        >
          <Icon name="previous" size={15} />
        </button>
        <button
          type="button"
          className="mini-play"
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
          <Icon name={playing ? 'pause' : 'play'} size={17} />
        </button>
        <button
          type="button"
          aria-label="Siguiente pista"
          title="Siguiente pista"
          onClick={() => onStep(1)}
          disabled={!active || (!live && playbackCount < 2)}
        >
          <Icon name="next" size={15} />
        </button>
        <button
          ref={volumeButtonRef}
          type="button"
          aria-label="Volumen; clic derecho para silenciar o activar sonido"
          aria-expanded={volumeOpen}
          aria-controls="volume-slider"
          title="Volumen · clic derecho para silenciar"
          onClick={onVolumeToggle}
          onContextMenu={onMuteToggle}
          disabled={active?.kind === 'spotify' || (live && captureMode !== 'monitor')}
        >
          <Icon name={volume === 0 ? 'muted' : 'volume'} size={17} />
        </button>
        <button
          type="button"
          className={repeat ? 'mini-repeat active' : 'mini-repeat'}
          aria-label="Repetir esta canción"
          aria-pressed={repeat}
          title="Repetir · clic derecho para marcar un tramo"
          onClick={onRepeatToggle}
          onContextMenu={onRepeatMenu}
          disabled={!active}
        >
          <Icon name="repeat" size={16} />
        </button>
        {active?.kind === 'youtube' && (
          <button
            type="button"
            aria-label="Mostrar video"
            title="Mostrar video"
            onClick={onShowVideo}
          >
            <Icon name="video" size={16} />
          </button>
        )}
        <button
          type="button"
          className={libraryOpen ? 'mini-list-toggle active' : 'mini-list-toggle'}
          aria-label={libraryOpen ? 'Ocultar álbumes y canciones' : 'Mostrar álbumes y canciones'}
          aria-expanded={libraryOpen}
          aria-controls="mini-library"
          title="Álbumes y canciones"
          onClick={onOpenLibrary}
        >
          <Icon name="list" size={17} />
        </button>
      </div>
      <Notice message={message} onDismiss={onDismissMessage} />
    </div>
  );
}
