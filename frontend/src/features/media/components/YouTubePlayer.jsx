import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        apiPromise = null;
        reject(new Error('YouTube no respondió.'));
      }, 12000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout);
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        apiPromise = null;
        reject(new Error('No se pudo cargar YouTube.'));
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
}) {
  const hostRef = useRef(null);
  const previousVideoId = useRef(videoId);
  const [issue, setIssue] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({
    videoId,
    volume,
    autoPlayRef,
    startAt,
    onState,
    onProgress,
  });
  useEffect(() => {
    latest.current = {
      videoId,
      volume,
      autoPlayRef,
      startAt,
      onState,
      onProgress,
    };
  });

  useEffect(() => {
    if (previousVideoId.current === videoId) return;
    previousVideoId.current = videoId;
    setIssue(null);
    const player = playerRef.current;
    if (!player) return;
    const selection = { videoId, startSeconds: Math.max(0, startAt || 0) };
    try {
      if (autoPlayRef.current) player.loadVideoById(selection);
      else player.cueVideoById(selection);
    } catch {
      setIssue('load');
    }
  }, [videoId, startAt, autoPlayRef, playerRef]);

  useEffect(() => {
    let disposed = false;
    let player;
    const host = hostRef.current;
    const mount = document.createElement('div');
    host?.appendChild(mount);
    const readyTimeout = window.setTimeout(() => {
      if (!disposed && !playerRef.current) {
        setIssue('timeout');
        latest.current.onState(2);
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
          width: '200',
          height: '200',
          videoId,
          playerVars: {
            controls: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              window.clearTimeout(readyTimeout);
              setIssue(null);
              playerRef.current = event.target;
              event.target.setVolume(Math.round(latest.current.volume * 100));
              if (latest.current.videoId !== videoId) {
                const selection = {
                  videoId: latest.current.videoId,
                  startSeconds: Math.max(0, latest.current.startAt || 0),
                };
                if (latest.current.autoPlayRef.current) event.target.loadVideoById(selection);
                else event.target.cueVideoById(selection);
              } else {
                if (latest.current.startAt > 0) event.target.seekTo(latest.current.startAt, true);
                if (latest.current.autoPlayRef.current) event.target.playVideo();
              }
              reportProgress();
            },
            onStateChange: (event) => {
              if (event.data === 1) setIssue(null);
              reportProgress();
              latest.current.onState(event.data);
            },
            onError: (event) => {
              setIssue(event.data);
              latest.current.onState(2);
            },
            onAutoplayBlocked: () => {
              setIssue('autoplay');
              latest.current.onState(2);
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          window.clearTimeout(readyTimeout);
          setIssue('load');
          latest.current.onState(2);
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
  }, [playerRef, attempt]);

  useEffect(() => {
    try {
      playerRef.current?.setVolume(Math.round(volume * 100));
    } catch {
      /* aún no está listo */
    }
  }, [volume, playerRef]);

  const videoVisible = videoOpen;
  const closeVideo = () => onVideoVisibility(false);
  const retryable = issue === 'timeout' || issue === 'load';
  const issueText = issue === null
    ? ''
    : issue === 'autoplay'
      ? 'El navegador bloqueó el inicio automático. Pulsa Reproducir.'
      : retryable
        ? 'YouTube tardó en cargar. Reintenta con el video visible.'
        : issue === 100
          ? 'Video no encontrado o no disponible. Revisa el enlace de la canción.'
          : 'Este video no permite reproducirse aquí. Ábrelo en YouTube o prueba otro enlace.';
  useEffect(() => {
    if (!videoVisible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeVideo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoVisible, onVideoVisibility]);
  return (
    <>
      <div className="youtube-source-actions">
        {issueText && <span className="youtube-source-status" role="status">{issueText}</span>}
        {retryable && (
          <button
            type="button"
            className="youtube-reveal"
            onClick={() => {
              onVideoVisibility(true);
              setIssue(null);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          className="youtube-video-toggle"
          aria-label={videoVisible ? 'Ocultar video' : 'Mostrar video'}
          aria-pressed={videoVisible}
          title={videoVisible ? 'Ocultar video' : 'Mostrar video'}
          onClick={() => onVideoVisibility(!videoVisible)}
        >
          <Icon name={videoVisible ? 'videoOff' : 'video'} size={17} />
          {maximized && <span>{videoVisible ? 'Ocultar video' : 'Mostrar video'}</span>}
        </button>
        <a className="youtube-open" href={sourceUrl} target="_blank" rel="noopener noreferrer">
          Abrir en YouTube ↗
        </a>
      </div>
      <div
        className={
          videoVisible ? 'youtube-frame youtube-frame--inline' : 'youtube-frame youtube-frame--tiny'
        }
      >
        <div ref={hostRef} />
      </div>
    </>
  );
}
