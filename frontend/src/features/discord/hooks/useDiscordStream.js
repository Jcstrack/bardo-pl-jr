import { useCallback, useEffect, useRef, useState } from 'react';

const MIME = 'audio/webm;codecs=opus';
const PAIRING_KEY = 'bardo-discord-pairing-v1';
const SILENCE_MS = 2500;
const QUIET_AFTER_LEAVE_MS = 800;
const AUDIBLE_RMS = 0.0015;

function readPairing() {
  try {
    const token = sessionStorage.getItem(PAIRING_KEY);
    return /^[A-Za-z0-9_-]{43}$/.test(token || '') ? token : null;
  } catch {
    return null;
  }
}

function savePairing(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) return false;
  try {
    sessionStorage.setItem(PAIRING_KEY, token);
    return true;
  } catch {
    /* Almacenamiento deshabilitado. */
    return false;
  }
}

function clearPairing() {
  try {
    sessionStorage.removeItem(PAIRING_KEY);
  } catch {
    /* Almacenamiento deshabilitado. */
  }
}

function sendControl(session, value) {
  if (session.socket?.readyState === WebSocket.OPEN) session.socket.send(JSON.stringify(value));
}

function stopRecorder(session) {
  session.recording = false;
  if (session.recorder?.state !== 'inactive') session.recorder?.stop();
}

function releaseCapture(session) {
  const ownedStream = session.ownedStream;
  session.audioStream = null;
  session.ownedStream = null;
  window.clearInterval(session.activityTimer);
  session.activityTimer = null;
  stopRecorder(session);
  session.recorder = null;
  session.audioContext?.close().catch(() => {});
  session.audioContext = null;
  ownedStream?.getTracks().forEach((track) => track.stop());
  session.activitySent = false;
  session.currentlyAudible = false;
  session.waitForQuiet = false;
  if (session.authenticated) sendControl(session, { type: 'activity', active: false });
}

function releaseSession(session) {
  session.closed = true;
  releaseCapture(session);
  window.clearInterval(session.heartbeatTimer);
  session.socket?.close();
}

function monitorAudio(session) {
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType)
    throw new Error('Este navegador no permite detectar si la pestaña tiene audio.');
  const context = new AudioContextType();
  const source = context.createMediaStreamSource(session.audioStream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  session.audioContext = context;
  const samples = new Float32Array(analyser.fftSize);
  let loudSamples = 0;
  let quietSince = 0;
  let lastSoundAt = 0;
  context.resume().catch(() => {
    // La pestaña puede bloquear el contexto hasta la siguiente interacción.
  });
  session.activityTimer = window.setInterval(() => {
    if (session.closed || session.socket?.readyState !== WebSocket.OPEN) return;
    analyser.getFloatTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    const loud = Math.sqrt(energy / samples.length) >= AUDIBLE_RMS;
    const now = performance.now();
    session.currentlyAudible = loud;
    loudSamples = loud ? loudSamples + 1 : 0;
    if (loud) {
      lastSoundAt = now;
      quietSince = 0;
    } else if (!quietSince) quietSince = now;

    if (session.waitForQuiet) {
      if (!loud && now - quietSince >= QUIET_AFTER_LEAVE_MS) session.waitForQuiet = false;
      return;
    }
    if (loudSamples >= 2 && !session.activitySent) {
      session.activitySent = true;
      sendControl(session, { type: 'activity', active: true });
    } else if (session.activitySent && now - lastSoundAt >= SILENCE_MS) {
      session.activitySent = false;
      stopRecorder(session);
      sendControl(session, { type: 'activity', active: false });
    }
  }, 100);
}

function createSession() {
  return {
    socket: null,
    recorder: null,
    ownedStream: null,
    audioStream: null,
    authenticated: false,
    closed: false,
    recording: false,
    activitySent: false,
    currentlyAudible: false,
    waitForQuiet: false,
    audioContext: null,
    activityTimer: null,
    heartbeatTimer: null,
  };
}

export default function useDiscordStream(captureRef, activeId) {
  const [state, setState] = useState(() => ({
    phase: readPairing() ? 'restoring' : 'off',
    error: '',
  }));
  const [savedPairing, setSavedPairing] = useState(() => Boolean(readPairing()));
  const sessionRef = useRef(null);

  const openSocket = useCallback((session, credentials) => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/api/bot/stream`);
    session.socket = socket;
    socket.onopen = () => sendControl(session, credentials);
    socket.onmessage = ({ data }) => {
      if (sessionRef.current !== session) return;
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message.type === 'ready') {
        session.authenticated = true;
        setSavedPairing(savePairing(message.resumeToken));
        session.heartbeatTimer = window.setInterval(
          () => sendControl(session, { type: 'ping' }),
          20_000,
        );
        if (session.audioStream) {
          try {
            monitorAudio(session);
            setState({ phase: 'on', error: '' });
          } catch (error) {
            releaseCapture(session);
            setState({ phase: 'paired', error: error.message });
          }
        } else {
          setState({ phase: 'paired', error: '' });
        }
      } else if (message.type === 'record') {
        if (session.recorder?.state === 'inactive') {
          session.recording = true;
          session.recorder.start(100);
        }
      } else if (message.type === 'voice-lost') {
        stopRecorder(session);
        session.activitySent = false;
        session.waitForQuiet = true;
      } else if (message.type === 'voice-ready') {
        setState((old) => ({ ...old, error: '' }));
      } else if (message.type === 'audio-error' || message.type === 'voice-error') {
        stopRecorder(session);
        session.activitySent = false;
        session.waitForQuiet = true;
        setState((old) => ({
          ...old,
          error: message.message || 'No se pudo continuar la transmisión.',
        }));
      }
    };
    socket.onclose = (event) => {
      if (session.closed || sessionRef.current !== session) return;
      sessionRef.current = null;
      releaseSession(session);
      const invalid = event.code === 1008 || event.reason === 'Conexión desconectada';
      if (invalid) {
        clearPairing();
        setSavedPairing(false);
      }
      setState({
        phase: 'error',
        error: invalid
          ? 'La vinculación terminó. Usa /conectar para obtener otro código.'
          : 'Se interrumpió la conexión. Puedes reactivarla sin otro código.',
      });
    };
    socket.onerror = () => {
      if (sessionRef.current === session)
        setState((old) => ({ ...old, error: 'No se pudo conectar con el servicio del bot.' }));
    };
  }, []);

  useEffect(() => {
    const token = readPairing();
    if (token) {
      const session = createSession();
      sessionRef.current = session;
      try {
        openSocket(session, { resumeToken: token });
      } catch {
        sessionRef.current = null;
        queueMicrotask(() =>
          setState({ phase: 'error', error: 'No se pudo recuperar la vinculación con el bot.' }),
        );
      }
    }
    return () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) releaseSession(session);
    };
  }, [openSocket]);

  const stop = () => {
    const session = sessionRef.current;
    if (session?.authenticated) {
      releaseCapture(session);
      setState({ phase: 'paired', error: '' });
    } else {
      if (session) releaseSession(session);
      sessionRef.current = null;
      setState({ phase: 'off', error: '' });
    }
  };

  const resume = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.authenticated || session.closed || !session.audioStream) return;
    session.audioContext?.resume().catch(() => {});
    session.waitForQuiet = false;
    sendControl(session, { type: 'resume', active: session.currentlyAudible });
  }, []);

  const start = async (code) => {
    if (!window.MediaRecorder?.isTypeSupported(MIME)) {
      setState({
        phase: 'error',
        error: 'Este navegador no puede transmitir audio WebM Opus a Discord.',
      });
      return;
    }
    const current = sessionRef.current;
    if (current && !current.authenticated) return;
    const token = readPairing();
    if (!current && !token && !/^[A-F0-9]{12}$/i.test(code.trim())) {
      setState({
        phase: 'error',
        error: 'Escribe el código de 12 caracteres que entrega /conectar.',
      });
      return;
    }
    setState({ phase: 'connecting', error: '' });
    let ownedStream;
    let session = current;
    try {
      let audioStream = captureRef.current?.id === activeId ? captureRef.current.audioStream : null;
      if (!audioStream?.getAudioTracks().length) {
        ownedStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: {
            suppressLocalAudioPlayback: true,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          systemAudio: 'exclude',
        });
        audioStream = new MediaStream(ownedStream.getAudioTracks());
        const suppressed =
          ownedStream.getAudioTracks()[0]?.getSettings().suppressLocalAudioPlayback === true ||
          ownedStream.getVideoTracks()[0]?.getSettings().suppressLocalAudioPlayback === true;
        if (!suppressed)
          throw new Error(
            'Este navegador no pudo silenciar la pestaña capturada. Se canceló para evitar audio doble.',
          );
      }
      if (!audioStream.getAudioTracks().length)
        throw new Error('Comparte una pestaña y activa su audio para usar Modo Discord.');
      if (current && (sessionRef.current !== current || current.closed || !current.authenticated))
        throw new Error(
          'La vinculación terminó mientras elegías la pestaña. Usa /conectar de nuevo.',
        );
      const recorder = new MediaRecorder(audioStream, {
        mimeType: MIME,
        audioBitsPerSecond: 128_000,
      });
      if (!session) {
        session = createSession();
        sessionRef.current = session;
      }
      session.recorder = recorder;
      session.audioStream = audioStream;
      session.ownedStream = ownedStream;
      (ownedStream?.getTracks() || audioStream.getTracks()).forEach((track) => {
        track.addEventListener(
          'ended',
          () => {
            if (sessionRef.current !== session || session.audioStream !== audioStream) return;
            releaseCapture(session);
            setState({
              phase: 'paired',
              error: 'Terminó la captura de esta pestaña. Activa el audio de nuevo.',
            });
          },
          { once: true },
        );
      });
      recorder.ondataavailable = (event) => {
        if (!session.recording || !event.data.size || session.socket?.readyState !== WebSocket.OPEN)
          return;
        if (session.socket.bufferedAmount > 4 * 1024 * 1024) {
          releaseCapture(session);
          setState({
            phase: 'paired',
            error: 'La conexión acumuló demasiado audio. Activa Modo Discord otra vez.',
          });
          return;
        }
        session.socket.send(event.data);
      };
      if (session.authenticated) {
        monitorAudio(session);
        setState({ phase: 'on', error: '' });
      } else {
        openSocket(session, token ? { resumeToken: token } : { code: code.trim().toUpperCase() });
      }
    } catch (error) {
      ownedStream?.getTracks().forEach((track) => track.stop());
      if (session && !session.authenticated && sessionRef.current === session) {
        sessionRef.current = null;
        releaseSession(session);
      } else if (session?.audioStream) {
        releaseCapture(session);
      }
      setState({
        phase:
          session?.authenticated && !session.closed && sessionRef.current === session
            ? 'paired'
            : 'error',
        error:
          error.name === 'NotAllowedError' ? 'Cancelaste la selección de pestaña.' : error.message,
      });
    }
  };

  return {
    ...state,
    start,
    stop,
    resume,
    canResume: savedPairing || state.phase === 'paired' || state.phase === 'on',
  };
}
