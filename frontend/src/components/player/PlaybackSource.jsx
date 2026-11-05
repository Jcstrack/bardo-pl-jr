import { lazy, Suspense } from 'react';
import Icon from '../ui/Icon.jsx';
import { parseMediaUrl } from '../../lib/mediaSources.js';
import { repeatEnd, repeatStart } from '../../lib/playbackRange.js';

const YouTubePlayer = lazy(() => import('../media/YouTubePlayer.jsx'));
const SpotifyPlayer = lazy(() => import('../media/SpotifyPlayer.jsx'));

export default function PlaybackSource({ active, live, captureMode, tabConnected, spotifyAuth, sourceIsLive, volume, startAt, autoPlayRef, youtubeRef, spotifyRef, repeat, loopStart, loopEnd, playEnd, playNext, playing, maximized, videoOpen, onVideoVisibility, loopSeekRef, onPlaying, onElapsed, onDuration, onStep, onAdvance, onMessage }) {
  let videoId = active?.videoId;
  if (active?.kind === 'youtube' && !videoId) {
    try { videoId = parseMediaUrl(active.src).videoId; }
    catch { /* El enlace inválido se puede corregir desde Editar canción. */ }
  }
  return (
    <>
      <div className="now-playing">
        <div className={"album-art " + (active?.tone || "violet")}>
          <span><Icon name={live ? "screen" : active?.kind === "youtube" ? "play" : "music"} size={25} /></span>
        </div>
        <div className="track-heading">
          <span className="section-label">{live ? "PESTAÑA COMPARTIDA" : "REPRODUCIENDO AHORA"}</span>
          <h2>{active?.title || "Tu música aquí"}</h2>
          <p>{active?.artist || "Añade una pista para empezar"}</p>
        </div>
      </div>
      {active?.kind === "youtube" && videoId && (
        <Suspense fallback={<p className="source-loading" role="status">Preparando audio de YouTube…</p>}><YouTubePlayer
          key={active.id + videoId}
          videoId={videoId}
          volume={volume}
          maximized={maximized}
          sourceUrl={active.src}
          videoOpen={videoOpen}
          onVideoVisibility={onVideoVisibility}
          autoPlayRef={autoPlayRef}
          startAt={startAt}
          playerRef={youtubeRef}
          onState={(state) => {
            if (state === 1) onPlaying(true);
            if (state === 2 || state === 0) onPlaying(false);
            if (state === 0) {
              if (repeat && youtubeRef.current) {
                youtubeRef.current.seekTo(repeatStart(loopStart, active?.playStart), true);
                youtubeRef.current.playVideo();
                return;
              }
              if (playEnd !== null) return;
              onStep(1, true);
            }
          }}
          onProgress={(current, total) => {
            onElapsed(Number.isFinite(current) ? current : 0);
            onDuration(Number.isFinite(total) && total > 0 ? total : 0);
            const cycleEnd = repeatEnd(loopEnd, playNext, playEnd, total, repeatStart(loopStart, active?.playStart));
            if (repeat && playing && cycleEnd > 0 && current >= cycleEnd - 0.15 && Date.now() - loopSeekRef.current > 850) {
              loopSeekRef.current = Date.now();
              youtubeRef.current?.seekTo(repeatStart(loopStart, active?.playStart), true);
              return;
            }
            if (!repeat && playNext !== null && playing && current >= playNext) {
              onAdvance();
              return;
            }
            if (!repeat && playEnd !== null && playing && current >= playEnd) {
              youtubeRef.current?.pauseVideo();
            }
          }}
          onError={(reason) => onMessage(reason === 'timeout' || reason === 'load'
            ? 'YouTube no terminó de cargar en este navegador. Muestra el video para reintentarlo o ábrelo en YouTube.'
            : reason === 'autoplay'
              ? 'El navegador bloqueó la reproducción automática. Pulsa Reproducir otra vez o muestra el video.'
              : 'Este video no permite reproducirse aquí. Prueba otro enlace o ábrelo en YouTube.')}
        /></Suspense>
      )}
      {active?.kind === "youtube" && !videoId && <p className="source-note">El enlace de YouTube no contiene un video válido. Edita la canción.</p>}
      {active?.kind === "spotify" && spotifyAuth.phase !== 'ready' && (
        <div className="spotify-login">
          <strong>{spotifyAuth.phase === 'unconfigured' ? 'Falta configurar Spotify' : 'Conecta tu cuenta de Spotify'}</strong>
          <p>{spotifyAuth.phase === 'unconfigured' ? 'Añade VITE_SPOTIFY_CLIENT_ID para habilitar el inicio de sesión.' : spotifyAuth.error || 'Inicia sesión para intentar reproducir esta canción.'}</p>
          {spotifyAuth.phase === 'login' && <button type="button" onClick={spotifyAuth.login}>Iniciar sesión en Spotify ↗</button>}
        </div>
      )}
      {active?.kind === "spotify" && spotifyAuth.phase === 'ready' && (
        <>
          <Suspense fallback={<p className="source-loading" role="status">Preparando Spotify…</p>}><SpotifyPlayer
            key={active.id + active.src}
            src={active.src}
            startAt={startAt}
            playerRef={spotifyRef}
            autoPlayRef={autoPlayRef}
            onState={onPlaying}
            onProgress={(current, total, isPlaying) => {
              onElapsed(Number.isFinite(current) ? current : 0);
              onDuration(Number.isFinite(total) && total > 0 ? total : 0);
              const cycleEnd = repeatEnd(loopEnd, playNext, playEnd, total, repeatStart(loopStart, active?.playStart));
              if (repeat && isPlaying && cycleEnd > 0 && current >= cycleEnd - 0.2 && Date.now() - loopSeekRef.current > 850) {
                loopSeekRef.current = Date.now();
                spotifyRef.current?.seek(Math.floor(repeatStart(loopStart, active?.playStart)));
                return;
              }
              if (!repeat && playNext !== null && isPlaying && current >= playNext) {
                onAdvance();
                return;
              }
              if (!repeat && playEnd !== null && isPlaying && current >= playEnd) {
                spotifyRef.current?.pause();
              }
            }}
            onError={() => onMessage("No se pudo abrir Spotify. Comprueba el enlace o ábrelo directamente allí.")}
          /></Suspense>
        </>
      )}
      {live && (
        <p className="source-note">{tabConnected
          ? "Pestaña conectada: la barra y los controles siguen el reproductor original."
          : captureMode === "monitor"
            ? "Para controlar el video original, conecta su pestaña desde la extensión Bardo."
            : "Reproduce y pausa el video en su pestaña original."}</p>
      )}
      {sourceIsLive && !live && <p className="source-note">Esta URL transmite audio en vivo y no informa una duración para mostrar una posición.</p>}
    </>
  );
}
