import { useEffect, useRef } from "react";

let apiPromise;
function loadSpotifyApi() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = (api) => {
        previous?.(api);
        resolve(api);
      };
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("No se pudo cargar Spotify."));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export default function SpotifyPlayer({ src, startAt, playerRef, autoPlayRef, onState, onProgress, onError }) {
  const hostRef = useRef(null);
  const latest = useRef({ autoPlayRef, startAt, onState, onProgress, onError });
  useEffect(() => {
    latest.current = { autoPlayRef, startAt, onState, onProgress, onError };
  });

  useEffect(() => {
    let disposed = false;
    let controller;
    const mount = document.createElement("div");
    hostRef.current.appendChild(mount);
    loadSpotifyApi().then((api) => {
      if (disposed) return;
      api.createController(mount, { url: src, width: "100%", height: 152 }, (created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        controller = created;
        playerRef.current = created;
        created.addListener("playback_update", ({ data }) => {
          latest.current.onState(!data.isPaused);
          latest.current.onProgress(data.position / 1000, data.duration / 1000, !data.isPaused);
        });
        created.addListener("ready", () => {
          if (latest.current.startAt > 0) created.seek(Math.floor(latest.current.startAt));
          if (latest.current.autoPlayRef.current) created.play();
        });
      });
    }).catch(() => {
      if (!disposed) latest.current.onError();
    });
    return () => {
      disposed = true;
      if (playerRef.current === controller) playerRef.current = null;
      controller?.pause();
      controller?.destroy();
      mount.remove();
    };
  }, [src, playerRef]);

  return <div className="spotify-frame" ref={hostRef} />;
}
