import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./components/ui/Icon.jsx";
import SiteHeader from "./components/layout/SiteHeader.jsx";
import PlayerWindowHeader from "./components/player/PlayerWindowHeader.jsx";
import MiniPlayer from "./components/player/MiniPlayer.jsx";
import MiniLibrary from "./components/player/MiniLibrary.jsx";
import PlaybackSource from "./components/player/PlaybackSource.jsx";
import PlaybackTimeline from "./components/player/PlaybackTimeline.jsx";
import TransportControls from "./components/player/TransportControls.jsx";
import VolumePopover from "./components/player/VolumePopover.jsx";
import RepeatMenu from "./components/player/RepeatMenu.jsx";
import PlaybackMenu from "./components/player/PlaybackMenu.jsx";
import { parseMediaUrl, urlsFromDrop } from "./lib/mediaSources.js";
import { clamp, keyboardSeekTarget } from "./lib/playerMath.js";
import { repeatEnd, repeatStart } from "./lib/playbackRange.js";
import { albumIdsOf, trackInAlbum } from "./lib/trackAlbums.js";
import useDiscordStream from "./hooks/useDiscordStream.js";
import useTabController from "./hooks/useTabController.js";
import useSpotifyAuth from "./hooks/useSpotifyAuth.js";
import useBotStatus from "./hooks/useBotStatus.js";
import useDiscordTimeline from "./hooks/useDiscordTimeline.js";
import {
  deleteAudioFile,
  loadAudioFile,
  readLibrary,
  saveAudioFile,
  writeLibrary,
} from "./lib/libraryStorage.js";
import {
  acceptInvite,
  clearOfflineChanges,
  establishLibrarySession,
  editorKeyFromBrowser,
  fetchSharedLibrary,
  importedHere,
  localOwnerKey,
  libraryChanges,
  markImported,
  markOfflineChanges,
  offlineChanges,
  sendLibraryChanges,
  sharedSnapshot,
  uploadSharedFile,
} from "./lib/sharedLibrary.js";
import "./styles/player.css";

const LibraryPanel = lazy(() => import('./components/player/LibraryPanel.jsx'));
const PlayerServices = lazy(() => import('./components/player/PlayerServices.jsx'));
const MusicModal = lazy(() => import('./components/player/MusicModal.jsx'));

const saved = readLibrary();
const CAPTURE_LOOPS_KEY = 'bardo-capture-loops-v1';
function captureLoops() {
  try { return JSON.parse(localStorage.getItem(CAPTURE_LOOPS_KEY) || '{}'); }
  catch { return {}; }
}
function saveCaptureLoop(url, markers) {
  if (!url) return;
  const loops = captureLoops();
  if (markers) loops[url] = markers;
  else delete loops[url];
  localStorage.setItem(CAPTURE_LOOPS_KEY, JSON.stringify(loops));
}
const initialAlbumId = saved?.albums.some(
  (album) => album.id === saved.selectedAlbumId,
)
  ? saved.selectedAlbumId
  : saved?.albums[0]?.id || null;
// La pista activa es independiente del álbum que el usuario está explorando.
const initialActiveId = saved?.tracks.some(
  (track) => track.id === saved.activeId,
)
  ? saved.activeId
  : saved?.tracks.find((track) => trackInAlbum(track, initialAlbumId))?.id || null;

function App() {
  const [albums, setAlbums] = useState(saved?.albums || []);
  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbumId);
  const [tracks, setTracks] = useState(saved?.tracks || []);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(Boolean(saved?.repeat));
  const [libraryOpen, setLibraryOpen] = useState(saved?.libraryOpen ?? true);
  const [miniLibraryOpen, setMiniLibraryOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [volume, setVolume] = useState(
    Number.isFinite(saved?.volume) ? saved.volume : 0.8,
  );
  const [elapsed, setElapsed] = useState(0);
  const [seekRequest, setSeekRequest] = useState(null);
  const [duration, setDuration] = useState(0);
  const [sourceIsLive, setSourceIsLive] = useState(false);
  const [view, setView] = useState(
    ["closed", "minimized", "expanded", "maximized"].includes(saved?.view)
      ? saved.view
      : "closed",
  );
  const [position, setPosition] = useState(
    () =>
      saved?.position || {
        x: Math.max(
          12,
          (window.innerWidth - Math.min(420, window.innerWidth - 24)) / 2,
        ),
        y: Math.min(72, Math.max(12, (window.innerHeight - 600) / 2)),
      },
  );
  const [modal, setModal] = useState(null);
  const [albumName, setAlbumName] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [editorKey, setEditorKey] = useState(editorKeyFromBrowser);
  const [accessRole, setAccessRole] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingAlbumIds, setEditingAlbumIds] = useState([]);
  const [playbackAlbumId, setPlaybackAlbumId] = useState(() => {
    const initialTrack = saved?.tracks.find((track) => track.id === initialActiveId);
    return trackInAlbum(initialTrack, initialAlbumId) ? initialAlbumId : initialTrack?.albumId ?? initialAlbumId;
  });
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumePosition, setVolumePosition] = useState(null);
  const [repeatMenu, setRepeatMenu] = useState(null);
  const [playbackMenu, setPlaybackMenu] = useState(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const audioRef = useRef(null);
  const youtubeRef = useRef(null);
  const spotifyRef = useRef(null);
  const loopSeekRef = useRef(false);
  const pendingSeekRef = useRef(null);
  const keyboardSeekRef = useRef({ activeId: null, value: 0, at: 0 });
  const seekCandidateRef = useRef(null);
  const confirmedSeekRef = useRef(null);
  const previousTapRef = useRef({ activeId: null, at: 0 });
  const advanceMarkerRef = useRef(null);
  const advanceAtMarkerRef = useRef(null);
  const fileRef = useRef(null);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const volumeButtonRef = useRef(null);
  const volumePopoverRef = useRef(null);
  const previousVolumeRef = useRef(volume > 0 ? volume : 0.8);
  const dragRef = useRef(null);
  const dragDepthRef = useRef(0);
  const captureRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const removedTrackIdsRef = useRef(new Set());
  const autoPlayRef = useRef(false);
  const sharedBaselineRef = useRef({ albums: [], tracks: [] });
  const serverRevisionRef = useRef(0);
  const pendingChangesRef = useRef([]);
  const pendingLibraryRef = useRef(null);
  const processingChangesRef = useRef(false);
  const currentTracksRef = useRef(tracks);
  const currentAlbumsRef = useRef(albums);
  currentTracksRef.current = tracks;
  currentAlbumsRef.current = albums;
  const reportElapsed = useCallback((value) => {
    const current = Number.isFinite(value) ? value : 0;
    const finishAt = currentTracksRef.current.find((track) => track.id === activeId)?.playNext;
    if (advanceMarkerRef.current === activeId && Number.isFinite(finishAt) && current < finishAt - 1)
      advanceMarkerRef.current = null;
    const recent = confirmedSeekRef.current;
    if (recent) {
      const age = performance.now() - recent.at;
      if (age < 2000) {
        if (recent.target > recent.from && current < recent.target - 1) return;
        if (recent.target < recent.from && current > recent.target + age / 1000 + 1) return;
      } else confirmedSeekRef.current = null;
    }
    const pending = pendingSeekRef.current;
    if (pending?.activeId === activeId) {
      if (Math.abs(current - pending.target) > 0.9) {
        seekCandidateRef.current = null;
        if (performance.now() < pending.until) return;
        setSeekRequest({ ...pending, failed: true });
        setMessage('La fuente no confirmó el salto. Revisa si permite adelantar.');
      } else {
        const candidate = seekCandidateRef.current;
        if (candidate?.id !== pending.id) {
          seekCandidateRef.current = { id: pending.id, at: performance.now() };
          return;
        }
        if (performance.now() - candidate.at < 200) return;
        const confirmedAt = performance.now();
        confirmedSeekRef.current = { from: pending.from, target: pending.target, at: confirmedAt };
        setSeekRequest({ ...pending, confirmedAt });
      }
      pendingSeekRef.current = null;
      seekCandidateRef.current = null;
    }
    setElapsed(current);
  }, [activeId]);
  const discordStream = useDiscordStream(captureRef, activeId);
  const botTimeline = useBotStatus(discordStream.phase === 'on', 400);
  const discordTimeline = useDiscordTimeline(elapsed, activeId, discordStream.phase === 'on', Boolean(botTimeline.streaming), botTimeline.bufferMs || 1200, seekRequest);
  useEffect(() => {
    if (!seekRequest || seekRequest.confirmedAt || seekRequest.failed) return undefined;
    const timer = window.setTimeout(() => {
      if (pendingSeekRef.current?.id !== seekRequest.id) return;
      pendingSeekRef.current = null;
      seekCandidateRef.current = null;
      setSeekRequest({ ...seekRequest, failed: true });
      setMessage('La fuente no confirmó el salto. Revisa si permite adelantar.');
    }, Math.max(0, seekRequest.until - performance.now()));
    return () => window.clearTimeout(timer);
  }, [seekRequest]);
  const tabController = useTabController();
  const spotifyAuth = useSpotifyAuth();
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId);
  const albumTracks = useMemo(
    () => tracks.filter((track) => trackInAlbum(track, selectedAlbumId)),
    [tracks, selectedAlbumId],
  );
  const searchableTracks = useMemo(() => tracks.filter((track) => track.kind !== 'capture'), [tracks]);
  // No ligar la canción que suena al álbum seleccionado en la interfaz.
  const active = tracks.find((track) => track.id === activeId);
  // Siguiente/anterior siguen la lista del álbum de la canción en reproducción.
  const queueAlbumId = active && trackInAlbum(active, playbackAlbumId) ? playbackAlbumId : active?.albumId;
  const playbackTracks = active
    ? tracks.filter((track) => trackInAlbum(track, queueAlbumId))
    : albumTracks;
  const live = active?.kind === "capture";
  const mediaIsLive = (live && !(tabController.connected && tabController.duration > 0)) || sourceIsLive;
  const loopStart = Number.isFinite(active?.loopStart) ? active.loopStart : null;
  const loopEnd = Number.isFinite(active?.loopEnd) ? active.loopEnd : null;
  const playStart = Number.isFinite(active?.playStart) ? active.playStart : null;
  const playEnd = Number.isFinite(active?.playEnd) ? active.playEnd : null;
  const playNext = Number.isFinite(active?.playNext) ? active.playNext : null;
  const captureMode =
    live && captureRef.current?.id === activeId
      ? captureRef.current.mode
      : null;
  const canControlPlayback = Boolean(active && (!live || captureMode === "monitor" || tabController.connected));
  const editingTrack = tracks.find((track) => track.id === editingId);

  useEffect(() => {
    if (!seekRequest || seekRequest.confirmedAt || seekRequest.failed) return undefined;
    if (active?.kind !== 'youtube' && !(live && tabController.connected)) return undefined;
    const timer = window.setTimeout(() => {
      if (pendingSeekRef.current?.id !== seekRequest.id) return;
      if (live) tabController.command('seek', seekRequest.target);
      else youtubeRef.current?.seekTo(seekRequest.target, true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [seekRequest, active?.kind, live, tabController.connected]);

  useEffect(() => {
    const acceptNavigationInvite = () => {
      const invited = new URLSearchParams(window.location.hash.slice(1)).get('invite');
      if (/^[a-f0-9]{64}$/i.test(invited || '')) window.location.reload();
    };
    window.addEventListener('hashchange', acceptNavigationInvite);
    return () => window.removeEventListener('hashchange', acceptNavigationInvite);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreLibrary = async () => {
      let accessKey = editorKey;
      const ownerKey = await localOwnerKey();
      if (ownerKey && ownerKey !== accessKey) {
        accessKey = acceptInvite(ownerKey);
        setEditorKey(ownerKey);
      }
      const restored = await Promise.all(
        (saved?.tracks || [])
          .filter((track) => track.kind === "file")
          .map(async (track) => {
            try {
              const file = await loadAudioFile(track.id);
              return file
                ? { id: track.id, file, src: URL.createObjectURL(file) }
                : { id: track.id, missing: !track.serverSrc };
            } catch {
              return { id: track.id, missing: !track.serverSrc };
            }
          }),
      );
      if (cancelled) {
        restored.forEach((item) => {
          if (item.src) URL.revokeObjectURL(item.src);
        });
        return;
      }
      restored.forEach((item) => {
        if (item.src) objectUrlsRef.current.add(item.src);
      });
      const localTracks = (saved?.tracks || []).map((track) => {
          const file = restored.find((item) => item.id === track.id);
          return file
            ? {
                ...track,
                src: track.serverSrc || file.src || null,
                missing: Boolean(file.missing),
              }
            : track;
        });
      try {
        const access = accessKey ? await establishLibrarySession(accessKey) : null;
        let remote = await fetchSharedLibrary(accessKey);
        setAccessRole(access?.role || null);
        if (!accessKey && saved?.albums?.length && !importedHere()) {
          setTracks(localTracks);
          setMessage('Tus canciones locales siguen aquí. Abre tu enlace de invitación para compartirlas con la red.');
          setHydrated(true);
          return;
        }
        if (!accessKey) markImported();
        let pendingFiles = [];
        if (accessKey && saved && (!importedHere() || offlineChanges() || remote.revision === 0 || localTracks.some((track) => track.kind === 'file' && !track.serverSrc))) {
          const missingAlbums = saved.albums.filter((album) => !remote.albums.some((item) => item.id === album.id));
          const existingIds = new Set(remote.tracks.map((track) => track.id));
          const importTracks = [];
          for (const track of localTracks) {
            if (existingIds.has(track.id)) continue;
            if (track.kind === 'file' && !track.serverSrc) {
              const file = restored.find((item) => item.id === track.id)?.file;
              if (!file) { pendingFiles.push(track); continue; }
              try {
                const uploaded = await uploadSharedFile(accessKey, track.id, file);
                track.serverSrc = uploaded.src;
                track.src = uploaded.src;
              } catch { pendingFiles.push(track); continue; }
            }
            importTracks.push(track);
          }
          const merged = sharedSnapshot([...remote.albums, ...missingAlbums], [...remote.tracks, ...importTracks]);
          const changes = libraryChanges(sharedSnapshot(remote.albums, remote.tracks), merged);
          if (changes) remote = await sendLibraryChanges(accessKey, changes);
          if (!pendingFiles.length) { markImported(); clearOfflineChanges(); }
        }
        if (cancelled) return;
        sharedBaselineRef.current = sharedSnapshot(remote.albums, remote.tracks);
        serverRevisionRef.current = remote.revision;
        setAlbums(remote.albums);
        setTracks([...remote.tracks, ...pendingFiles]);
        setSelectedAlbumId((old) => remote.albums.some((item) => item.id === old) ? old : remote.albums[0]?.id ?? null);
        setActiveId((old) => remote.tracks.some((item) => item.id === old) ? old : remote.tracks[0]?.id ?? null);
        setSyncReady(Boolean(accessKey));
        setRemoteReady(true);
        if (pendingFiles.length) setMessage('Algunos archivos locales aún no se pudieron subir. Se conservan en este navegador.');
      } catch (error) {
        if (cancelled) return;
        setTracks(localTracks);
        setMessage(error.status === 401 ? 'Abre una invitación para entrar en la biblioteca. Tus canciones locales siguen guardadas.' : `Biblioteca compartida sin conexión: ${error.message}. Tus canciones locales se conservan.`);
      }
      setHydrated(true);
    };
    restoreLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!syncReady) return;
    const current = sharedSnapshot(albums, tracks);
    const changes = libraryChanges(sharedBaselineRef.current, current);
    if (!changes) return;
    sharedBaselineRef.current = current;
    pendingChangesRef.current.push(changes);
    if (processingChangesRef.current) return;
    processingChangesRef.current = true;
    const flush = async () => {
      let latest = null;
      while (pendingChangesRef.current.length) {
        try {
          const result = await sendLibraryChanges(editorKey, pendingChangesRef.current[0]);
          latest = result;
          serverRevisionRef.current = Math.max(serverRevisionRef.current, result.revision);
          pendingChangesRef.current.shift();
        } catch (error) {
          if (error.status === 401) {
            markOfflineChanges();
            setSyncReady(false);
            setMessage('Esta invitación ya no permite editar. Pega una invitación nueva en Compartir biblioteca.');
            processingChangesRef.current = false;
            return;
          }
          markOfflineChanges();
          setMessage(`No se pudo guardar en este ordenador: ${error.message}. Se reintentará.`);
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }
      }
      processingChangesRef.current = false;
      if (latest && !libraryChanges(sharedBaselineRef.current, sharedSnapshot(currentAlbumsRef.current, currentTracksRef.current))) {
        sharedBaselineRef.current = sharedSnapshot(latest.albums, latest.tracks);
        setAlbums(latest.albums);
        setTracks([...latest.tracks, ...currentTracksRef.current.filter((track) => track.kind === 'capture' || (track.kind === 'file' && !track.serverSrc))]);
        setSelectedAlbumId((old) => latest.albums.some((item) => item.id === old) ? old : latest.albums[0]?.id ?? null);
      }
    };
    flush();
  }, [syncReady, editorKey, albums, tracks]);

  useEffect(() => {
    if (!remoteReady) return;
    const poll = async () => {
      if (processingChangesRef.current || pendingChangesRef.current.length) return;
      try {
        const remote = await fetchSharedLibrary(editorKey);
        if (remote.revision <= serverRevisionRef.current || processingChangesRef.current) return;
        if (libraryChanges(sharedBaselineRef.current, sharedSnapshot(currentAlbumsRef.current, currentTracksRef.current))) return;
        serverRevisionRef.current = remote.revision;
        sharedBaselineRef.current = sharedSnapshot(remote.albums, remote.tracks);
        setAlbums(remote.albums);
        setTracks([...remote.tracks, ...currentTracksRef.current.filter((track) => track.kind === 'capture' || (track.kind === 'file' && !track.serverSrc))]);
        setSelectedAlbumId((old) => remote.albums.some((item) => item.id === old) ? old : remote.albums[0]?.id ?? null);
        setActiveId((old) => remote.tracks.some((item) => item.id === old) || currentTracksRef.current.some((item) => item.id === old && item.kind === 'capture') ? old : remote.tracks[0]?.id ?? null);
      } catch { /* La copia local permanece disponible mientras vuelve la red. */ }
    };
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [remoteReady, editorKey]);

  useEffect(() => {
    if (!hydrated) return;
    pendingLibraryRef.current = { albums, selectedAlbumId, tracks, activeId, repeat, libraryOpen, volume, view, position };
    const timer = window.setTimeout(() => {
      try {
        writeLibrary(pendingLibraryRef.current);
        pendingLibraryRef.current = null;
        if (editorKey && !syncReady) markOfflineChanges();
      } catch {
        setMessage("No se pudieron guardar los cambios en este navegador.");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    editorKey,
    syncReady,
    albums,
    selectedAlbumId,
    tracks,
    activeId,
    repeat,
    libraryOpen,
    volume,
    view,
    position,
  ]);

  useEffect(() => {
    const flushOnExit = () => {
      if (!pendingLibraryRef.current) return;
      try { writeLibrary(pendingLibraryRef.current); }
      catch { /* La copia del servidor permanece disponible. */ }
    };
    window.addEventListener('pagehide', flushOnExit);
    return () => window.removeEventListener('pagehide', flushOnExit);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (captureRef.current && captureRef.current.id !== activeId) {
      const oldId = captureRef.current.id;
      captureRef.current.stream.getTracks().forEach((item) => {
        item.onended = null;
        item.stop();
      });
      captureRef.current = null;
      setTracks((old) => old.filter((item) => item.id !== oldId));
    }
    audio.pause();
    audio.srcObject = null;
    audio.removeAttribute("src");
    audio.load();
    setPlaying(false);
    pendingSeekRef.current = null;
    keyboardSeekRef.current = { activeId: null, value: 0, at: 0 };
    seekCandidateRef.current = null;
    confirmedSeekRef.current = null;
    advanceMarkerRef.current = null;
    previousTapRef.current = { activeId: null, at: 0 };
    setVideoOpen(false);
    setElapsed(0);
    setDuration(0);
    setSourceIsLive(false);
    // Este efecto solo debe ejecutarse cuando cambia la fuente real, no al navegar entre álbumes.
    const track = active;
    if (!track || track.kind === "youtube" || track.kind === "spotify") return;
    if (track.kind === "capture") {
      if (
        captureRef.current?.id === track.id &&
        captureRef.current.mode === "monitor"
      )
        audio.srcObject = captureRef.current.audioStream;
      else return;
    } else if (track.src) {
      audio.src = track.src;
      audio.loop = repeat && loopStart === null && loopEnd === null && playStart === null && playEnd === null && playNext === null;
    } else return;
    const initializePosition = () => {
        if (track.kind !== 'capture' && playStart !== null && playStart > 0) audio.currentTime = playStart;
    };
    audio.addEventListener('loadedmetadata', initializePosition, { once: true });
    if (autoPlayRef.current) {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() =>
          setMessage(
            "No se pudo iniciar esta fuente. Revisa el enlace o pulsa reproducir de nuevo.",
          ),
        );
    }
    return () => audio.removeEventListener('loadedmetadata', initializePosition);
    // La fuente se reemplaza únicamente al cambiar la pista activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (["youtube", "spotify", "capture"].includes(active?.kind)) return;
    let timer;
    const sync = () => {
      const total = audio.duration;
      setDuration(Number.isFinite(total) && total > 0 ? total : 0);
      setSourceIsLive(total === Infinity);
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const cycleEnd = repeatEnd(loopEnd, playNext, playEnd, null, repeatStart(loopStart, playStart));
      if (repeat && cycleEnd !== null && current >= cycleEnd && !audio.paused) {
        audio.currentTime = repeatStart(loopStart, playStart);
        reportElapsed(audio.currentTime);
        return;
      }
      if (!repeat && playNext !== null && current >= playNext && !audio.paused) {
        advanceAtMarkerRef.current?.();
        return;
      }
      if (!repeat && playEnd !== null && current >= playEnd && !audio.paused) {
        audio.pause();
        setPlaying(false);
        reportElapsed(current);
      } else reportElapsed(current);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
      sync();
    };
    const start = () => {
      window.clearInterval(timer);
      sync();
      if (!document.hidden) timer = window.setInterval(sync, 100);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!audio.paused) start();
      else sync();
    };
    audio.addEventListener("play", start);
    audio.addEventListener("playing", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("durationchange", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("seeked", sync);
    document.addEventListener("visibilitychange", onVisibility);
    if (!audio.paused) start();
    else sync();
    return () => {
      window.clearInterval(timer);
      audio.removeEventListener("play", start);
      audio.removeEventListener("playing", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("durationchange", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("seeked", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeId, active?.kind, active?.src, repeat, loopStart, loopEnd, playStart, playEnd, playNext, reportElapsed]);

  useEffect(() => {
    audioRef.current.volume = volume;
    audioRef.current.loop = repeat && !live && loopStart === null && loopEnd === null && playStart === null && playEnd === null && playNext === null;
  }, [volume, repeat, live, loopStart, loopEnd, playStart, playEnd, playNext]);

  useEffect(() => {
    if (active?.kind === "spotify") setVolumeOpen(false);
  }, [active?.kind]);

  useEffect(() => {
    if (!live || !tabController.connected) return;
    setPlaying(tabController.playing);
    reportElapsed(tabController.elapsed || 0);
    setDuration(tabController.duration || 0);
    if (tabController.title) setTracks((old) => {
      if (!old.some((track) => track.id === activeId && track.title !== tabController.title)) return old;
      return old.map((track) => track.id === activeId
        ? { ...track, title: tabController.title, artist: 'Pestaña conectada' }
        : track);
    });
  }, [live, activeId, tabController.connected, tabController.playing, tabController.elapsed, tabController.duration, tabController.title, reportElapsed]);

  useEffect(() => {
    if (live && tabController.error) setMessage(tabController.error);
  }, [live, tabController.error]);

  useEffect(() => {
    if (!live || !tabController.connected || repeat || playNext === null) return;
    if (tabController.elapsed < playNext - 1) {
      if (advanceMarkerRef.current === activeId) advanceMarkerRef.current = null;
    } else if (tabController.playing && tabController.elapsed >= playNext) {
      advanceAtMarkerRef.current?.();
    }
  }, [live, activeId, tabController.connected, tabController.elapsed, tabController.playing, repeat, playNext]);

  useEffect(() => {
    if (!live || !tabController.connected || !tabController.url) return;
    const markers = captureLoops()[tabController.url];
    setTracks((old) => {
      const current = old.find((track) => track.id === activeId);
      if (!current || current.sourceUrl === tabController.url) return old;
      return old.map((track) => {
        if (track.id !== activeId) return track;
        const { loopStart: _start, loopEnd: _end, playStart: _playStart, playEnd: _playEnd, playNext: _playNext, ...rest } = track;
        return { ...rest, sourceUrl: tabController.url, ...markers };
      });
    });
  }, [live, activeId, tabController.connected, tabController.url]);

  useEffect(() => {
    if (!live || !tabController.connected) return;
    if (repeat) {
      tabController.command('range', { start: playStart, end: null });
      tabController.command('loop', { start: loopStart, end: repeatEnd(loopEnd, playNext, playEnd, null, repeatStart(loopStart, playStart)) });
      tabController.command('repeat', true);
    } else {
      tabController.command('repeat', false);
      tabController.command('loop', { start: loopStart, end: loopEnd });
      tabController.command('range', { start: playStart, end: playEnd });
    }
    // Los comandos se envían al cambiar la configuración, no en cada avance de tiempo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, tabController.connected, repeat, loopStart, loopEnd, playStart, playEnd, playNext]);

  useEffect(() => {
    const resize = () => {
      if (view === "maximized") return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      setPosition((old) => ({
        x: clamp(old.x, 12, window.innerWidth - rect.width - 12),
        y: clamp(old.y, 12, window.innerHeight - rect.height - 12),
      }));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [view]);

  useEffect(() => {
    if (view === "maximized") return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition((old) => ({
      x: clamp(old.x, 12, window.innerWidth - rect.width - 12),
      y: clamp(old.y, 12, window.innerHeight - rect.height - 12),
    }));
  }, [active?.kind, albumTracks.length, view, miniLibraryOpen]);

  useEffect(() => {
    if (!volumeOpen || view === "closed") return;
    const updatePosition = () => {
      const button = volumeButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = 146;
      const height = 42;
      const gap = 8;
      const below = rect.bottom + gap + height <= window.innerHeight - 8;
      const panelRect = panelRef.current?.getBoundingClientRect();
      let left = clamp(rect.right - width, 8, window.innerWidth - width - 8);
      let top = rect.bottom + gap;
      if (
        !below &&
        panelRect &&
        panelRect.right + gap + width <= window.innerWidth - 8
      ) {
        left = panelRect.right + gap;
        top = clamp(
          rect.top + (rect.height - height) / 2,
          8,
          window.innerHeight - height - 8,
        );
      } else if (!below) {
        const panelTop = panelRect?.top ?? rect.top;
        top =
          panelTop - height - gap >= 8
            ? panelTop - height - gap
            : Math.max(8, rect.top - height - gap);
      }
      setVolumePosition({ left, top });
    };
    const closeOutside = (event) => {
      if (volumeButtonRef.current?.contains(event.target)) return;
      if (volumePopoverRef.current?.contains(event.target)) return;
      setVolumeOpen(false);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [
    volumeOpen,
    view,
    position.x,
    position.y,
    active?.kind,
    albumTracks.length,
  ]);

  useEffect(
    () => () => {
      if (captureRef.current)
        captureRef.current.stream.getTracks().forEach((item) => item.stop());
      objectUrlsRef.current.forEach((value) => URL.revokeObjectURL(value));
    },
    [],
  );

  const expandPlayer = (requestedKind) => {
    const kind =
      typeof requestedKind === "string" ? requestedKind : active?.kind;
    const targetHeight = kind === "youtube" ? 780 : 620;
    setPosition((old) => ({
      x: old.x,
      y: clamp(old.y, 12, window.innerHeight - targetHeight - 12),
    }));
    setView("expanded");
  };

  const maximizePlayer = () => {
    setVolumeOpen(false);
    setView("maximized");
  };

  const changeVideoVisibility = useCallback((visible) => {
    setVideoOpen(visible);
    if (visible) {
      setVolumeOpen(false);
      setView((old) => old === "minimized" ? "expanded" : old);
    }
  }, []);

  const toggleMiniLibrary = () => {
    if (!miniLibraryOpen) {
      setPosition((old) => ({
        ...old,
        y: Math.min(old.y, Math.max(12, window.innerHeight - 500)),
      }));
    }
    setMiniLibraryOpen((old) => !old);
  };

  const seekActive = (value, origin = 'pointer') => {
    if (origin !== 'keyboard') keyboardSeekRef.current = { activeId: null, value: 0, at: 0 };
    const next = clamp(value, 0, duration || value);
    if (playNext !== null && next < playNext - 0.5) advanceMarkerRef.current = null;
    const request = { id: crypto.randomUUID(), activeId, from: elapsed, target: next, until: performance.now() + 8000 };
    pendingSeekRef.current = request;
    seekCandidateRef.current = null;
    confirmedSeekRef.current = null;
    setSeekRequest(request);
    if (live && tabController.connected) tabController.command('seek', next);
    else if (active?.kind === "youtube") youtubeRef.current?.seekTo(next, true);
    else if (active?.kind === "spotify") spotifyRef.current?.seek(Math.floor(next));
    else if (audioRef.current && !live) audioRef.current.currentTime = next;
    if (discordStream.phase !== 'on') setElapsed(next);
  };

  const seekWithKeyboard = (event, visiblePosition) => {
    if (!active || !duration || mediaIsLive || event.altKey || event.ctrlKey || event.metaKey) return;
    const now = performance.now();
    const previous = keyboardSeekRef.current;
    const base = previous.activeId === activeId && now - previous.at < 2000
      ? previous.value : visiblePosition;
    const target = keyboardSeekTarget(event.key, base, duration, event.shiftKey);
    if (target === null) return;
    event.preventDefault();
    keyboardSeekRef.current = { activeId, value: target, at: now };
    seekActive(target, 'keyboard');
  };

  const handlePlayerKeyDown = (event) => {
    if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    if (event.target.closest('input, textarea, select, [contenteditable], .playlist, .album-toolbar, .track-context-menu, .repeat-menu, .playback-menu')) return;
    seekWithKeyboard(event, discordTimeline.pendingTarget ?? discordTimeline.position);
  };

  const setLoopMarker = (kind, value) => {
    if (!editorKey && !live) return setMessage('Se necesita una invitación para editar esta canción.');
    if (!active || !duration || mediaIsLive) return;
    const next = kind === "loopStart"
      ? clamp(value, 0, (loopEnd ?? duration) - 0.25)
      : clamp(value, (loopStart ?? 0) + 0.25, duration);
    setTracks((old) => old.map((track) =>
      track.id === active.id ? { ...track, [kind]: next } : track,
    ));
    if (live) saveCaptureLoop(tabController.url, { ...captureLoops()[tabController.url], [kind]: next });
    setRepeat(true);
  };

  const clearLoopMarkers = () => {
    if (!editorKey && !live) return setMessage('Se necesita una invitación para editar esta canción.');
    if (!active) return;
    if (live) {
      const { loopStart: _start, loopEnd: _end, ...rest } = captureLoops()[tabController.url] || {};
      saveCaptureLoop(tabController.url, Object.keys(rest).length ? rest : null);
    }
    setTracks((old) => old.map((track) => {
      if (track.id !== active.id) return track;
      const { loopStart: _start, loopEnd: _end, ...rest } = track;
      return rest;
    }));
    setRepeatMenu(null);
  };

  const openRepeatMenu = (event) => {
    event.preventDefault();
    if (!active || mediaIsLive) return;
    setRepeatMenu({
      left: clamp(event.clientX, 8, window.innerWidth - 218),
      top: clamp(event.clientY, 8, window.innerHeight - 146),
    });
  };

  const setPlayMarker = (kind, value) => {
    if (!editorKey && !live) return setMessage('Se necesita una invitación para editar esta canción.');
    if (!active || !duration || mediaIsLive) return;
    const next = kind === 'playStart'
      ? clamp(value, 0, (playNext ?? playEnd ?? duration) - 0.25)
      : clamp(value, (playStart ?? 0) + 0.25, duration);
    advanceMarkerRef.current = null;
    setTracks((old) => old.map((track) => {
      if (track.id !== active.id) return track;
      const updated = { ...track, [kind]: next };
      if (kind === 'playEnd') delete updated.playNext;
      if (kind === 'playNext') delete updated.playEnd;
      return updated;
    }));
    if (live) {
      const updated = { ...captureLoops()[tabController.url], [kind]: next };
      if (kind === 'playEnd') delete updated.playNext;
      if (kind === 'playNext') delete updated.playEnd;
      saveCaptureLoop(tabController.url, updated);
    }
  };

  const clearPlayMarkers = () => {
    if (!editorKey && !live) return setMessage('Se necesita una invitación para editar esta canción.');
    if (!active) return;
    advanceMarkerRef.current = null;
    if (live) {
      const { playStart: _start, playEnd: _end, playNext: _next, ...rest } = captureLoops()[tabController.url] || {};
      saveCaptureLoop(tabController.url, Object.keys(rest).length ? rest : null);
    }
    setTracks((old) => old.map((track) => {
      if (track.id !== active.id) return track;
      const { playStart: _start, playEnd: _end, playNext: _next, ...rest } = track;
      return rest;
    }));
    setPlaybackMenu(null);
  };

  const openPlaybackMenu = (event) => {
    event.preventDefault();
    if (!active || mediaIsLive) return;
    setPlaybackMenu({
      left: clamp(event.clientX, 8, window.innerWidth - 218),
      top: clamp(event.clientY, 8, window.innerHeight - 188),
    });
  };

  const moveTrack = (id, targetId, after = false) => {
    if (!editorKey) return setMessage('Se necesita una invitación para ordenar canciones.');
    if (!id || !targetId || id === targetId) return;
    setTracks((old) => {
      const moving = old.find((track) => track.id === id);
      const target = old.find((track) => track.id === targetId);
      if (!moving || !target || !trackInAlbum(moving, selectedAlbumId) || !trackInAlbum(target, selectedAlbumId)) return old;
      const next = old.filter((track) => track.id !== id);
      next.splice(next.findIndex((track) => track.id === targetId) + (after ? 1 : 0), 0, moving);
      return next;
    });
  };

  const toggleMute = (event) => {
    event?.preventDefault();
    setVolume((current) => {
      if (current > 0) {
        previousVolumeRef.current = current;
        return 0;
      }
      return previousVolumeRef.current || 0.8;
    });
  };

  useEffect(() => {
    if (!repeatMenu) return;
    const close = (event) => {
      if (!event.target.closest?.(".repeat-menu")) setRepeatMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [repeatMenu]);

  useEffect(() => {
    if (!playbackMenu) return;
    const close = (event) => {
      if (!event.target.closest?.('.repeat-menu')) setPlaybackMenu(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [playbackMenu]);


  const togglePlay = async () => {
    if (!canControlPlayback) return;
    const restartAt = repeat ? repeatStart(loopStart, playStart) : playStart ?? 0;
    const finishAt = repeat ? repeatEnd(loopEnd, playNext, playEnd, duration || null, restartAt) : playNext ?? playEnd;
    if (live && tabController.connected) {
      tabController.command('toggle');
      return;
    }
    if (active.kind === "file" && !active.src)
      return setMessage(
        "No se encontró el archivo guardado. Quita esta pista y vuelve a cargarla.",
      );
    if (active.kind === "youtube") {
      // El video permanece montado aunque esté reducido o el panel esté minimizado.
      if (!youtubeRef.current) {
        autoPlayRef.current = true;
        return setMessage("Preparando YouTube; la canción comenzará al terminar de cargar.");
      }
      try {
        if (playing) {
          youtubeRef.current.pauseVideo();
          autoPlayRef.current = false;
        } else {
          const current = youtubeRef.current.getCurrentTime();
          if ((restartAt > 0 && current < restartAt - 0.25) || (finishAt !== null && current >= finishAt - 0.25))
            youtubeRef.current.seekTo(restartAt, true);
          youtubeRef.current.playVideo();
          autoPlayRef.current = true;
        }
      } catch {
        setMessage("No se pudo cambiar la reproducción de YouTube.");
      }
      return;
    }
    if (active.kind === "spotify") {
      if (!spotifyRef.current) return setMessage("Spotify aún se está cargando. También puedes usar el botón del recuadro de Spotify.");
      if (playing) spotifyRef.current.pause();
      else {
        if ((restartAt > 0 && elapsed < restartAt - 0.25) || (finishAt !== null && elapsed >= finishAt - 0.25))
          spotifyRef.current.seek(Math.floor(restartAt));
        spotifyRef.current.play();
      }
      autoPlayRef.current = !playing;
      return;
    }
    const audio = audioRef.current;
    if (!audio.paused) {
      audio.pause();
      autoPlayRef.current = false;
      setPlaying(false);
      return;
    }
    try {
      if ((restartAt > 0 && audio.currentTime < restartAt - 0.25) || (finishAt !== null && audio.currentTime >= finishAt - 0.25))
        audio.currentTime = restartAt;
      await audio.play();
      autoPlayRef.current = true;
      setPlaying(true);
      setMessage("");
    } catch {
      setMessage(
        "No se pudo reproducir. Usa un enlace directo a un archivo de audio.",
      );
    }
  };

  const choose = (id) => {
    const next = tracks.find((item) => item.id === id);
    if (!next) return;
    const songAlbumId = trackInAlbum(next, selectedAlbumId)
      ? selectedAlbumId
      : albumIdsOf(next).find((albumId) => albums.some((album) => album.id === albumId));
    if (songAlbumId) {
      setSelectedAlbumId(songAlbumId);
      setPlaybackAlbumId(songAlbumId);
    }
    if (id === activeId) {
      if (!playing) togglePlay();
      return;
    }
    // Cambiar de pista no expande el reproductor.
    autoPlayRef.current = true;
    setActiveId(next.id);
  };

  const edit = (track) => {
    setEditingId(track.id);
    setEditingAlbumIds(albumIdsOf(track));
    setTitle(track.title);
    setUrl(["url", "youtube", "spotify"].includes(track.kind) ? track.src : "");
    setMessage("");
    setModal("edit");
  };

  const saveEdit = (event) => {
    event.preventDefault();
    if (!editorKey) return setMessage('Se necesita una invitación para editar canciones.');
    if (!editingTrack) return;
    if (!editingAlbumIds.length) return setMessage("Elige al menos un álbum para esta canción.");
    try {
      const source =
        ["url", "youtube", "spotify"].includes(editingTrack.kind)
          ? parseMediaUrl(url)
          : {};
      const updated = {
        ...editingTrack,
        ...source,
        title: title.trim() || editingTrack.title,
        albumIds: editingAlbumIds,
        albumId: editingAlbumIds.includes(editingTrack.albumId) ? editingTrack.albumId : editingAlbumIds[0],
      };
      if (activeId === editingId && updated.src !== editingTrack.src)
        autoPlayRef.current = playing;
      setTracks((old) =>
        old.map((item) => (item.id === editingId ? updated : item)),
      );
      setModal(null);
      setEditingId(null);
      setPlaybackAlbumId((old) => editingAlbumIds.includes(old) ? old : editingAlbumIds[0]);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const step = (direction, automatic = false) => {
    if (live) {
      if (!tabController.command('step', direction)) setMessage('Conecta la pestaña original desde la extensión Bardo para cambiar de pista.');
      return;
    }
    // Si cambiaste de álbum visualmente, la cola de reproducción permanece en
    // el álbum al que pertenece la canción que estás escuchando.
    if (!playbackTracks.length) return;
    const index = playbackTracks.findIndex((item) => item.id === activeId);
    if (automatic && (index < 0 || index === playbackTracks.length - 1)) {
      autoPlayRef.current = false;
      audioRef.current?.pause();
      youtubeRef.current?.pauseVideo();
      spotifyRef.current?.pause();
      setPlaying(false);
      return;
    }
    const nextIndex =
      index < 0
        ? direction >= 0
          ? 0
          : playbackTracks.length - 1
        : (index + direction + playbackTracks.length) % playbackTracks.length;
    const next = playbackTracks[nextIndex];
    autoPlayRef.current = true;
    setActiveId(next.id);
  };

  advanceAtMarkerRef.current = () => {
    if (repeat) return;
    if (advanceMarkerRef.current === activeId) return;
    advanceMarkerRef.current = activeId;
    step(1, true);
  };

  const previousOrRestart = () => {
    if (!active) return;
    if (live && (!tabController.connected || !duration)) {
      setMessage('Conecta una pestaña con línea de tiempo desde la extensión Bardo para reiniciar la canción.');
      return;
    }
    if (!live && !duration) return;
    const now = performance.now();
    const doubleTap = previousTapRef.current.activeId === activeId && now - previousTapRef.current.at <= 1500;
    previousTapRef.current = { activeId, at: doubleTap ? 0 : now };
    if (doubleTap && (live || playbackTracks.length > 1)) step(-1);
    else seekActive(playStart ?? 0);
  };

  const minimizePlayer = () => {
    // Nunca llamar a pauseVideo ni desmontar YouTubePlayer aquí.
    setVideoOpen(false);
    setVolumeOpen(false);
    setMiniLibraryOpen(false);
    setView("minimized");
  };

  const closePlayer = () => {
    setVideoOpen(false);
    discordStream.stop();
    audioRef.current?.pause();
    if (active?.kind === "youtube") youtubeRef.current?.pauseVideo();
    if (active?.kind === "spotify") spotifyRef.current?.pause();
    if (captureRef.current) {
      const capturedId = captureRef.current.id;
      captureRef.current.stream.getTracks().forEach((item) => {
        item.onended = null;
        item.stop();
      });
      captureRef.current = null;
      setTracks((old) => old.filter((item) => item.id !== capturedId));
      if (activeId === capturedId)
        setActiveId(
          albumTracks.find((item) => item.id !== capturedId)?.id ?? null,
        );
    }
    autoPlayRef.current = false;
    setPlaying(false);
    setVolumeOpen(false);
    setModal(null);
    setMiniLibraryOpen(false);
    setView("closed");
  };

  const switchAlbum = (id) => {
    if (id === selectedAlbumId) return;
    // Navegar por la biblioteca NO modifica la canción ni su tiempo actual.
    // Tampoco pausa YouTube, <audio> ni la captura de una pestaña.
    setSelectedAlbumId(id);
    setVolumeOpen(false);
    setMessage("");
  };

  const createAlbum = (event) => {
    event.preventDefault();
    if (!editorKey) return setMessage('Se necesita una invitación para crear álbumes.');
    const name = albumName.trim();
    if (!name) return;
    const album = { id: crypto.randomUUID(), name };
    setAlbums((old) => [...old, album]);
    switchAlbum(album.id);
    setAlbumName("");
    setModal(null);
  };

  const renameAlbum = (event) => {
    event.preventDefault();
    if (!editorKey) return setMessage('Se necesita una invitación para editar álbumes.');
    const name = albumName.trim();
    if (!selectedAlbum || !name) return;
    setAlbums((old) =>
      old.map((album) =>
        album.id === selectedAlbumId ? { ...album, name } : album,
      ),
    );
    setModal(null);
  };

  const deleteAlbum = () => {
    if (!editorKey) return setMessage('Se necesita una invitación para eliminar álbumes.');
    if (!selectedAlbum) return;
    if (
      !window.confirm(
        "¿Eliminar el álbum “" + selectedAlbum.name + "”? Las canciones compartidas con otros álbumes se conservarán.",
      )
    )
      return;
    const removed = tracks.filter((track) => trackInAlbum(track, selectedAlbumId) && albumIdsOf(track).length === 1);
    removed.forEach((track) => {
      if (track.kind === "file") {
        removedTrackIdsRef.current.add(track.id);
        if (track.src) {
          URL.revokeObjectURL(track.src);
          objectUrlsRef.current.delete(track.src);
        }
        deleteAudioFile(track.id).catch(() =>
          setMessage("No se pudo borrar un archivo guardado."),
        );
      }
    });
    const remainingAlbums = albums.filter(
      (album) => album.id !== selectedAlbumId,
    );
    setTracks((old) => old.flatMap((track) => {
      if (!trackInAlbum(track, selectedAlbumId)) return [track];
      const remainingIds = albumIdsOf(track).filter((id) => id !== selectedAlbumId);
      return remainingIds.length ? [{ ...track, albumIds: remainingIds, albumId: remainingIds.includes(track.albumId) ? track.albumId : remainingIds[0] }] : [];
    }));
    setAlbums(remainingAlbums);
    // Borrar otro álbum no debe interrumpir la pista en reproducción.
    // Si se borra precisamente la pista que suena, sí se detiene.
    if (removed.some((track) => track.id === activeId)) {
      autoPlayRef.current = false;
      setActiveId(null);
    }
    setSelectedAlbumId(remainingAlbums[0]?.id ?? null);
    if (playbackAlbumId === selectedAlbumId) {
      setPlaybackAlbumId(albumIdsOf(active).find((id) => id !== selectedAlbumId) ?? remainingAlbums[0]?.id ?? null);
    }
    setModal(null);
  };

  const remove = (id) => {
    if (!editorKey) return setMessage('Se necesita una invitación para quitar canciones.');
    const track = tracks.find((item) => item.id === id);
    if (!track) return;
    const remainingIds = albumIdsOf(track).filter((albumId) => albumId !== selectedAlbumId);
    if (remainingIds.length) {
      setTracks((old) => old.map((item) => item.id === id
        ? { ...item, albumIds: remainingIds, albumId: remainingIds.includes(item.albumId) ? item.albumId : remainingIds[0] }
        : item));
      if (id === activeId && playbackAlbumId === selectedAlbumId) setPlaybackAlbumId(remainingIds[0]);
      return;
    }
    if (track.kind === "file") {
      removedTrackIdsRef.current.add(id);
      if (track.src) {
        URL.revokeObjectURL(track.src);
        objectUrlsRef.current.delete(track.src);
      }
      deleteAudioFile(id).catch(() =>
        setMessage("No se pudo borrar el archivo guardado."),
      );
    }
    if (track?.kind === "capture" && captureRef.current?.id === id) {
      captureRef.current.stream.getTracks().forEach((item) => {
        item.onended = null;
        item.stop();
      });
      captureRef.current = null;
    }
    const remaining = albumTracks.filter((item) => item.id !== id);
    setTracks((old) => old.filter((item) => item.id !== id));
    if (id === activeId) {
      autoPlayRef.current = playing && remaining.length > 0;
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const ensureDropAlbum = () => {
    if (selectedAlbumId) return selectedAlbumId;
    const id = albums[0]?.id || crypto.randomUUID();
    if (!albums.length) setAlbums((old) => [...old, { id, name: "Mi música" }]);
    setSelectedAlbumId(id);
    return id;
  };

  const addFiles = (fileList, fromDrop = false) => {
    if (!editorKey) return setMessage('Abre un enlace de invitación para agregar música.');
    const files = Array.from(fileList).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name),
    );
    if (!files.length) {
      if (fromDrop) expandPlayer();
      return setMessage("Suelta archivos de audio como MP3, WAV, OGG o M4A.");
    }
    const destinationId = fromDrop ? ensureDropAlbum() : selectedAlbumId;
    if (!destinationId) {
      setAlbumName("");
      setModal("album-add");
      return setMessage("Crea un álbum antes de añadir música.");
    }
    const added = files.map((file) => {
      const id = crypto.randomUUID();
      const src = URL.createObjectURL(file);
      objectUrlsRef.current.add(src);
      return {
        id,
        albumId: destinationId,
        albumIds: [destinationId],
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "Archivo local",
        src,
        kind: "file",
        tone: "green",
        stored: false,
      };
    });
    setTracks((old) => [...old, ...added]);
    // Añadir archivos no cambia la pista activa. Si la biblioteca estaba
    // vacía, seleccionamos el primero sin iniciar reproducción automática.
    if (!activeId) {
      autoPlayRef.current = false;
      setActiveId(added[0].id);
    }
    if (view === "closed") expandPlayer(added[0].kind);
    setModal(null);
    setMessage("Guardando audio…");
    Promise.allSettled(
      added.map(async (track, index) => {
        await saveAudioFile(track.id, files[index]).catch(() => {});
        return uploadSharedFile(editorKey, track.id, files[index]);
      }),
    ).then((results) => {
      const failed = new Set(
        results.flatMap((result, index) =>
          result.status === "rejected" ? [added[index].id] : [],
        ),
      );
      added.forEach((track, index) => {
        if (
          results[index].status === "fulfilled" &&
          removedTrackIdsRef.current.has(track.id)
        ) {
          deleteAudioFile(track.id).catch(() => {});
        }
      });
      setTracks((old) =>
        old.map((track) => {
          if (!added.some((item) => item.id === track.id)) return track;
          if (failed.has(track.id)) return { ...track, stored: false };
          const result = results[added.findIndex((item) => item.id === track.id)];
          return { ...track, serverSrc: result.value.src, stored: true };
        }),
      );
      if (failed.size)
        setMessage(
          "Algunos archivos quedaron pendientes de subir. Se conservan en este navegador y se reintentará al recargar.",
        );
      else setMessage((old) => (old === "Guardando audio…" ? "" : old));
    });
  };

  const addLink = (event) => {
    event.preventDefault();
    if (!editorKey) return setMessage('Abre un enlace de invitación para agregar música.');
    if (!selectedAlbumId)
      return setMessage("Crea un álbum antes de añadir música.");
    let source;
    try {
      source = parseMediaUrl(url);
    } catch (error) {
      return setMessage(error.message);
    }
    const item = {
      id: crypto.randomUUID(),
      albumId: selectedAlbumId,
      albumIds: [selectedAlbumId],
      ...source,
      title: title.trim() || source.fallbackTitle,
      tone: source.kind === "spotify" ? "green" : source.kind === "youtube" ? "violet" : "orange",
    };
    setTracks((old) => [...old, item]);
    // Añadir un enlace solo actualiza la biblioteca; no pausa ni reemplaza
    // lo que está sonando.
    if (!activeId) {
      autoPlayRef.current = false;
      setActiveId(item.id);
    }
    setUrl("");
    setTitle("");
    setModal(null);
    setMessage("");
  };

  const addDroppedUrls = (dataTransfer) => {
    if (!editorKey) return setMessage('Abre un enlace de invitación para agregar música.');
    const urls = urlsFromDrop(dataTransfer);
    if (!urls.length) {
      expandPlayer();
      return setMessage(
        "Arrastra un archivo de audio o un enlace de YouTube o audio directo.",
      );
    }
    const sources = [];
    let errorMessage = "";
    urls.forEach((value) => {
      try {
        sources.push(parseMediaUrl(value));
      } catch (error) {
        errorMessage = error.message;
      }
    });
    if (!sources.length) {
      expandPlayer();
      return setMessage(
        errorMessage || "No se reconoció ningún enlace de audio.",
      );
    }
    const destinationId = ensureDropAlbum();
    const added = sources.map((source) => ({
      id: crypto.randomUUID(),
      albumId: destinationId,
      albumIds: [destinationId],
      ...source,
      title: source.fallbackTitle,
      tone: source.kind === "spotify" ? "green" : source.kind === "youtube" ? "violet" : "orange",
    }));
    setTracks((old) => [...old, ...added]);
    // Arrastrar enlaces no interrumpe una canción existente.
    if (!activeId) {
      autoPlayRef.current = false;
      setActiveId(added[0].id);
    }
    if (view === "closed") expandPlayer(added[0].kind);
    setModal(null);
    setMessage(
      errorMessage
        ? "Algunos enlaces no se pudieron añadir: " + errorMessage
        : "",
    );
  };

  const supportsDrop = (dataTransfer) =>
    !Array.from(dataTransfer.types).includes("application/x-sonora-track") &&
    Array.from(dataTransfer.types).some((type) =>
      ["Files", "text/uri-list", "text/plain"].includes(type),
    );
  const onDragEnter = (event) => {
    if (!supportsDrop(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDropActive(true);
  };
  const onDragOver = (event) => {
    if (!supportsDrop(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (event) => {
    if (!supportsDrop(event.dataTransfer)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDropActive(false);
  };
  const onDrop = (event) => {
    if (Array.from(event.dataTransfer.types).includes("application/x-sonora-track")) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    if (event.dataTransfer.files.length)
      addFiles(event.dataTransfer.files, true);
    else addDroppedUrls(event.dataTransfer);
  };

  const shareTab = async () => {
    if (!selectedAlbumId) {
      setAlbumName("");
      setModal("album-add");
      return setMessage("Crea un álbum antes de compartir una pestaña.");
    }
    setModal(null);
    if (!navigator.mediaDevices?.getDisplayMedia)
      return setMessage(
        "La captura requiere Chrome o Edge en localhost o HTTPS.",
      );
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: {
          suppressLocalAudioPlayback: true,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        systemAudio: "exclude",
      });
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach((item) => item.stop());
        return setMessage(
          "No llegó audio. Elige una pestaña y activa “Compartir audio de la pestaña”.",
        );
      }
      if (captureRef.current) {
        const oldId = captureRef.current.id;
        captureRef.current.stream.getTracks().forEach((item) => {
          item.onended = null;
          item.stop();
        });
        setTracks((old) => old.filter((item) => item.id !== oldId));
      }
      const id = crypto.randomUUID();
      const suppressed =
        stream.getAudioTracks()[0].getSettings().suppressLocalAudioPlayback ===
          true ||
        stream.getVideoTracks()[0]?.getSettings().suppressLocalAudioPlayback ===
          true;
      if (!suppressed) {
        stream.getTracks().forEach((item) => item.stop());
        setMessage(
          "Tu navegador no puede silenciar la pestaña original. Para evitar audio doble, usa el enlace de YouTube en Añadir música.",
        );
        return;
      }
      const mode = "monitor";
      captureRef.current = {
        id,
        stream,
        audioStream: new MediaStream(stream.getAudioTracks()),
        mode,
      };
      stream.getTracks().forEach((item) => {
        item.onended = () => {
          if (captureRef.current?.id !== id) return;
          captureRef.current = null;
          setTracks((old) => old.filter((track) => track.id !== id));
          setActiveId((old) => (old === id ? null : old));
          setPlaying(false);
          setMessage("La pestaña dejó de compartir audio.");
        };
      });
      setTracks((old) => [
        ...old,
        {
          id,
          albumId: selectedAlbumId,
          albumIds: [selectedAlbumId],
          title: "Pestaña compartida",
          artist: "Audio en vivo del navegador",
          kind: "capture",
          tone: "violet",
        },
      ]);
      autoPlayRef.current = mode === "monitor";
      setActiveId(id);
      setMessage("");
    } catch (error) {
      if (error?.name !== "NotAllowedError")
        setMessage(
          "No se pudo compartir la pestaña. Revisa los permisos del navegador.",
        );
    }
  };

  const dragStart = (event) => {
    if (view === "maximized") return;
    if (event.button !== 0) return;
    if (event.target.closest("button")) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragMove = (event) => {
    if (!dragRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPosition({
      x: clamp(
        event.clientX - dragRef.current.x,
        12,
        window.innerWidth - rect.width - 12,
      ),
      y: clamp(
        event.clientY - dragRef.current.y,
        12,
        window.innerHeight - rect.height - 12,
      ),
    });
  };

  const openCreateAlbum = () => {
    if (!editorKey) return setMessage('Abre un enlace de invitación para crear álbumes.');
    setAlbumName("");
    setMessage("");
    setModal("album-add");
  };
  const openEditAlbum = () => {
    if (!editorKey) return setMessage('Abre un enlace de invitación para editar álbumes.');
    setAlbumName(selectedAlbum?.name || "");
    setMessage("");
    setModal("album-edit");
  };
  const switchManagedAlbum = (id) => {
    switchAlbum(id);
    setAlbumName(albums.find((album) => album.id === id)?.name || '');
  };
  const openAddMusic = () => {
    if (!editorKey) return setMessage('Abre un enlace de invitación para agregar música.');
    setUrl("");
    setTitle("");
    setMessage("");
    setModal("add");
  };

  return (
    <div
      className={"app-shell " + (view === "closed" ? "" : "player-visible")}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <SiteHeader />

      {dropActive && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <span><Icon name="music" size={28} /></span>
            <strong>Suelta para escuchar</strong>
            <small>Archivos de audio o enlaces de música</small>
          </div>
        </div>
      )}

      {view === "closed" && (
        <button
          type="button"
          className="player-launcher"
          aria-label="Abrir reproductor"
          title="Abrir reproductor"
          onClick={expandPlayer}
        >
          <Icon name="music" size={25} />
        </button>
      )}

      {view !== "closed" && (
        <section
          ref={panelRef}
          className={
            "player " +
            (view === "minimized" ? "player-mini" : view === "maximized" ? "player-maximized" : "player-expanded")
          }
          style={view === "maximized" ? undefined : {
            left: position.x,
            top: position.y,
            maxHeight: "calc(100svh - " + (position.y + 12) + "px)",
          }}
          aria-label="Reproductor de música"
          onKeyDown={handlePlayerKeyDown}
        >
          <PlayerWindowHeader minimized={view === "minimized"} maximized={view === "maximized"} onDragStart={dragStart} onDragMove={dragMove} onDragEnd={() => { dragRef.current = null; }} onExpand={expandPlayer} onMaximize={maximizePlayer} onMinimize={minimizePlayer} onClose={closePlayer} />

          {view === "minimized" && <>
            <MiniPlayer active={active} live={live} tabConnected={tabController.connected} captureMode={captureMode} playing={playing} canControlPlayback={canControlPlayback} playbackCount={playbackTracks.length} volume={volume} volumeOpen={volumeOpen} volumeButtonRef={volumeButtonRef} repeat={repeat} libraryOpen={miniLibraryOpen} message={message} onPrevious={previousOrRestart} onStep={step} onPlay={togglePlay} onPlayMenu={openPlaybackMenu} onVolumeToggle={() => setVolumeOpen((old) => !old)} onMuteToggle={toggleMute} onRepeatToggle={() => setRepeat((old) => !old)} onRepeatMenu={openRepeatMenu} onOpenLibrary={toggleMiniLibrary} onShowVideo={() => changeVideoVisibility(true)} onDismissMessage={() => setMessage("")} />
            {miniLibraryOpen && <MiniLibrary albums={albums} selectedAlbumId={selectedAlbumId} selectedAlbum={selectedAlbum} albumTracks={albumTracks} allTracks={searchableTracks} activeId={activeId} playing={playing} captureMode={captureMode} onSwitchAlbum={switchAlbum} onCreateAlbum={openCreateAlbum} onEditAlbum={openEditAlbum} onChooseTrack={choose} onEditTrack={edit} onRemoveTrack={remove} onReorderTrack={moveTrack} onAddMusic={openAddMusic} />}
          </>}

          {/* Mantenemos el contenido montado al minimizar: el iframe no se reinicia. */}
          <div
            ref={contentRef}
            className={videoOpen ? "player-content player-content--video" : "player-content"}
            aria-hidden={view === "minimized"}
            inert={view === "minimized"}
          >
            <div className={videoOpen ? "playback-area playback-area--video" : "playback-area"}><PlaybackSource active={active} live={live} captureMode={captureMode} tabConnected={tabController.connected} spotifyAuth={spotifyAuth} sourceIsLive={sourceIsLive} volume={volume} startAt={pendingSeekRef.current?.activeId === activeId ? pendingSeekRef.current.target : playStart ?? 0} autoPlayRef={autoPlayRef} youtubeRef={youtubeRef} spotifyRef={spotifyRef} repeat={repeat} loopStart={loopStart} loopEnd={loopEnd} playEnd={playEnd} playNext={playNext} playing={playing} maximized={view === "maximized"} videoOpen={videoOpen} onVideoVisibility={changeVideoVisibility} loopSeekRef={loopSeekRef} onPlaying={setPlaying} onElapsed={reportElapsed} onDuration={setDuration} onStep={step} onAdvance={() => advanceAtMarkerRef.current?.()} onMessage={setMessage} />

            <PlaybackTimeline active={active} mediaIsLive={mediaIsLive} duration={duration} elapsed={discordTimeline.position} pendingSeek={discordTimeline.pendingTarget} discordDelayed={discordStream.phase === 'on'} discordPlaying={Boolean(botTimeline.streaming)} loopStart={loopStart} loopEnd={loopEnd} playStart={playStart} playEnd={playEnd} playNext={playNext} onSeek={seekActive} onKeyboardSeek={seekWithKeyboard} onSetLoopMarker={setLoopMarker} onSetPlayMarker={setPlayMarker} />

            <TransportControls active={active} live={live} tabConnected={tabController.connected} captureMode={captureMode} canControlPlayback={canControlPlayback} playbackCount={playbackTracks.length} playing={playing} repeat={repeat} volume={volume} volumeOpen={volumeOpen} volumeButtonRef={volumeButtonRef} minimized={view === "minimized"} libraryOpen={libraryOpen} onPrevious={previousOrRestart} onStep={step} onPlay={togglePlay} onPlayMenu={openPlaybackMenu} onRepeatToggle={() => setRepeat((old) => !old)} onRepeatMenu={openRepeatMenu} onVolumeToggle={() => setVolumeOpen((old) => !old)} onMuteToggle={toggleMute} onLibraryToggle={() => setLibraryOpen((old) => !old)} /></div>

            {libraryOpen && view !== "minimized" && <>
              <div className="library-area"><Suspense fallback={<p className="source-loading" role="status">Cargando biblioteca…</p>}><LibraryPanel albums={albums} selectedAlbumId={selectedAlbumId} selectedAlbum={selectedAlbum} albumTracks={albumTracks} allTracks={searchableTracks} activeId={activeId} playing={playing} captureMode={captureMode} message={message} onSwitchAlbum={switchAlbum} onCreateAlbum={openCreateAlbum} onEditAlbum={openEditAlbum} onShareTab={shareTab} onChooseTrack={choose} onEditTrack={edit} onRemoveTrack={remove} onReorderTrack={moveTrack} onAddMusic={openAddMusic} onDismissMessage={() => setMessage("")} /></Suspense></div>
              <div className="services-area"><Suspense fallback={null}><PlayerServices discordStream={discordStream} editorKey={editorKey} accessRole={accessRole} maximized={view === "maximized"} /></Suspense></div>
            </>}
          </div>
        </section>
      )}

      <VolumePopover open={volumeOpen} position={volumePosition} popoverRef={volumePopoverRef} volume={volume} onChange={setVolume} onMuteToggle={toggleMute} />

      <RepeatMenu position={repeatMenu} duration={duration} elapsed={elapsed} loopStart={loopStart} loopEnd={loopEnd} onSetMarker={setLoopMarker} onClear={clearLoopMarkers} onClose={() => setRepeatMenu(null)} />
      <PlaybackMenu position={playbackMenu} duration={duration} elapsed={elapsed} playStart={playStart} playEnd={playEnd} playNext={playNext} onSetMarker={setPlayMarker} onClear={clearPlayMarkers} onClose={() => setPlaybackMenu(null)} />

      {modal && <Suspense fallback={null}><MusicModal modal={modal} albumName={albumName} onAlbumNameChange={setAlbumName} selectedAlbum={selectedAlbum} albumTracks={albumTracks} allTracks={searchableTracks} onSwitchAlbum={switchManagedAlbum} onOpenCreateAlbum={openCreateAlbum} onReorderTrack={moveTrack} onEditTrack={edit} editingTrack={editingTrack} albums={albums} editingAlbumIds={editingAlbumIds} onEditingAlbumIdsChange={setEditingAlbumIds} url={url} onUrlChange={setUrl} title={title} onTitleChange={setTitle} message={message} onClearMessage={() => setMessage("")} onClose={() => setModal(null)} onCreateAlbum={createAlbum} onRenameAlbum={renameAlbum} onDeleteAlbum={deleteAlbum} onAddLink={addLink} onSaveEdit={saveEdit} onUploadClick={() => fileRef.current.click()} onShareTab={shareTab} /></Suspense>}

      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
        multiple
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={() => {
          if (repeat) {
            seekActive(repeatStart(loopStart, playStart));
            audioRef.current.play().catch(() => setPlaying(false));
          } else if (playEnd !== null) {
            setPlaying(false);
          } else {
            step(1, true);
          }
        }}
        onError={() => {
          if (active && !["capture", "youtube", "spotify"].includes(active.kind))
            setMessage(
              "No se pudo cargar el audio. Comprueba que la URL apunte directamente a un archivo reproducible.",
            );
        }}
      />
    </div>
  );
}

export default App;
