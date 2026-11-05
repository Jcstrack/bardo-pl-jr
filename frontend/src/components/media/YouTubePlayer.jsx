import { useEffect, useRef, useState } from "react";
import Icon from '../ui/Icon.jsx';

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        apiPromise = null;
        reject(new Error("YouTube no respondió."));
      }, 12000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout);
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        apiPromise = null;
        reject(new Error("No se pudo cargar YouTube."));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export default function YouTubePlayer({
  videoId,
  volume,
  maximized,
  sourceUrl,
  videoOpen,
  onVideoVisibility,
  autoPlayRef,
  startAt,
  playerRef,
  onState,
  onProgress,
  onError,
}) {
  const hostRef = useRef(null);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({
    volume,
    autoPlayRef,
    startAt,
    onState,
    onProgress,
    onError,
  });
  useEffect(() => {
    latest.current = {
      volume,
      autoPlayRef,
      startAt,
      onState,
      onProgress,
      onError,
    };
  });

  useEffect(() => {
    let disposed = false;
    let player;
    const host = hostRef.current;
    const mount = document.createElement('div');
    host?.appendChild(mount);
    const readyTimeout = window.setTimeout(() => {
      if (!disposed && !playerRef.current) {
        setStalled(true);
        latest.current.onError('timeout');
      }
    }, 15000);
    const reportProgress = () => {
      if (!playerRef.current || disposed) return;
      try {
        latest.current.onProgress(
          playerRef.current.getCurrentTime(),
          playerRef.current.getDuration(),
        );
      } catch {
        /* el iframe aún se está cargando */
      }
    };
    loadYouTubeApi()
      .then((YT) => {
        if (disposed || !host) return;
        player = new YT.Player(mount, {
          width: "256",
          height: "200",
          videoId,
          playerVars: {
            controls: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              window.clearTimeout(readyTimeout);
              setStalled(false);
              playerRef.current = event.target;
              event.target.setVolume(Math.round(latest.current.volume * 100));
              if (latest.current.startAt > 0)
                event.target.seekTo(latest.current.startAt, true);
              reportProgress();
              if (latest.current.autoPlayRef.current) event.target.playVideo();
            },
            onStateChange: (event) => {
              reportProgress();
              latest.current.onState(event.data);
            },
            onError: (event) => { setStalled(true); latest.current.onError(event.data); },
            onAutoplayBlocked: () => { setStalled(true); latest.current.onError('autoplay'); },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          window.clearTimeout(readyTimeout);
          setStalled(true);
          latest.current.onError("load");
        }
      });
    const interval = window.setInterval(reportProgress, 100);
    return () => {
      disposed = true;
      window.clearTimeout(readyTimeout);
      window.clearInterval(interval);
      if (playerRef.current === player) playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* el iframe ya se cerró */
      }
      mount.remove();
      host?.replaceChildren();
    };
  }, [videoId, playerRef, attempt]);

  useEffect(() => {
    try {
      playerRef.current?.setVolume(Math.round(volume * 100));
    } catch {
      /* aún no está listo */
    }
  }, [volume, playerRef]);

  const videoVisible = videoOpen;
  const closeVideo = () => onVideoVisibility(false);
  useEffect(() => {
    if (!videoVisible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeVideo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoVisible, onVideoVisibility]);
  return <>
    {stalled && !videoVisible && <button type="button" className="youtube-reveal" onClick={() => { onVideoVisibility(true); setStalled(false); setAttempt((value) => value + 1); }}>Mostrar video para intentar reproducir</button>}
    <div className="youtube-source-actions">
      <button type="button" className="youtube-video-toggle" aria-label={videoVisible ? 'Ocultar video' : 'Mostrar video'} aria-pressed={videoVisible} title={videoVisible ? 'Ocultar video' : 'Mostrar video'} onClick={() => onVideoVisibility(!videoVisible)}><Icon name={videoVisible ? 'videoOff' : 'video'} size={17} />{maximized && <span>{videoVisible ? 'Ocultar video' : 'Mostrar video'}</span>}</button>
      <a className="youtube-open" href={sourceUrl} target="_blank" rel="noopener noreferrer">Abrir en YouTube ↗</a>
    </div>
    <div className={videoVisible ? 'youtube-frame youtube-frame--inline' : 'youtube-frame youtube-frame--tiny'}>
      <div ref={hostRef} />
    </div>
  </>;
}
