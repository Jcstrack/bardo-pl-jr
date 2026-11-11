import { useCallback, useEffect, useRef, useState } from 'react';

const MIME = 'audio/webm;codecs=opus';
const SILENCE_MS = 2500;
const QUIET_AFTER_LEAVE_MS = 800;
const AUDIBLE_RMS = 0.0015;

function sendControl(session, value) {
  if (session.socket.readyState === WebSocket.OPEN) session.socket.send(JSON.stringify(value));
}

function stopRecorder(session) {
  session.recording = false;
  if (session.recorder?.state !== 'inactive') session.recorder.stop();
}

function releaseSession(session) {
  session.closed = true;
  window.clearInterval(session.activityTimer);
  window.clearInterval(session.heartbeatTimer);
  stopRecorder(session);
  session.audioContext?.close().catch(() => {});
  session.ownedStream?.getTracks().forEach((track) => track.stop());
  session.socket.close();
}

function monitorAudio(session, audioStream) {
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) throw new Error('Este navegador no permite detectar si la pestaña tiene audio.');
  const context = new AudioContextType();
  const source = context.createMediaStreamSource(audioStream);
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
    if (session.closed || session.socket.readyState !== WebSocket.OPEN) return;
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

export default function useDiscordStream(captureRef, activeId) {
  const [state, setState] = useState({ phase: 'off', error: '' });
  const sessionRef = useRef(null);

  const stopCurrent = () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) releaseSession(session);
  };

  const stop = () => {
    stopCurrent();
    setState({ phase: 'off', error: '' });
  };

  const resume = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.closed) return;
    session.audioContext?.resume().catch(() => {});
    session.waitForQuiet = false;
    sendControl(session, { type: 'resume', active: session.currentlyAudible });
  }, []);

  const start = async (code) => {
    if (!/^[A-F0-9]{12}$/i.test(code.trim())) {
      setState({ phase: 'error', error: 'Escribe el código de 12 caracteres que entrega /conectar.' });
      return;
    }
    if (!window.MediaRecorder?.isTypeSupported(MIME)) {
      setState({ phase: 'error', error: 'Este navegador no puede transmitir audio WebM Opus a Discord.' });
      return;
    }
    stopCurrent();
    setState({ phase: 'connecting', error: '' });
    let ownedStream;
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
          throw new Error('Este navegador no pudo silenciar la pestaña capturada. Se canceló para evitar audio doble.');
      }
      if (!audioStream.getAudioTracks().length)
        throw new Error('Comparte una pestaña y activa su audio para usar Modo Discord.');
      const recorder = new MediaRecorder(audioStream, { mimeType: MIME, audioBitsPerSecond: 128_000 });
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/api/bot/stream`);
      const session = {
        recorder, socket, ownedStream, closed: false, recording: false,
        activitySent: false, currentlyAudible: false, waitForQuiet: false,
        audioContext: null, activityTimer: null, heartbeatTimer: null,
      };
      sessionRef.current = session;
      (ownedStream?.getTracks() || audioStream.getTracks()).forEach((track) => {
        track.addEventListener('ended', () => {
          if (sessionRef.current !== session) return;
          stopCurrent();
          setState({ phase: 'error', error: 'Terminó la captura de esta pestaña.' });
        }, { once: true });
      });
      recorder.ondataavailable = (event) => {
        if (!session.recording || !event.data.size || socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount > 4 * 1024 * 1024) {
          stopCurrent();
          setState({ phase: 'error', error: 'La conexión acumuló demasiado audio. Ejecuta /conectar y vuelve a activar Modo Discord.' });
          return;
        }
        socket.send(event.data);
      };
      socket.onopen = () => sendControl(session, { code: code.trim().toUpperCase() });
      socket.onmessage = ({ data }) => {
        if (sessionRef.current !== session) return;
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === 'ready') {
          try { monitorAudio(session, audioStream); }
          catch (error) {
            setState({ phase: 'on', error: error.message });
            return;
          }
          session.heartbeatTimer = window.setInterval(() => sendControl(session, { type: 'ping' }), 20_000);
          setState({ phase: 'on', error: '' });
        } else if (message.type === 'record') {
          if (recorder.state === 'inactive') {
            session.recording = true;
            recorder.start(100);
          }
        } else if (message.type === 'voice-lost') {
          stopRecorder(session);
          session.activitySent = false;
          session.waitForQuiet = true;
        } else if (message.type === 'voice-ready') {
          setState({ phase: 'on', error: '' });
        } else if (message.type === 'audio-error' || message.type === 'voice-error') {
          stopRecorder(session);
          session.activitySent = false;
          session.waitForQuiet = true;
          setState({ phase: 'on', error: message.message || 'No se pudo continuar la transmisión.' });
        }
      };
      socket.onclose = (event) => {
        if (session.closed || sessionRef.current !== session) return;
        stopCurrent();
        setState({ phase: 'error', error: event.reason || 'Se cerró la vinculación. Usa /conectar para obtener otro código.' });
      };
      socket.onerror = () => {
        if (sessionRef.current === session)
          setState({ phase: 'error', error: 'No se pudo conectar con el servicio del bot.' });
      };
    } catch (error) {
      ownedStream?.getTracks().forEach((track) => track.stop());
      setState({ phase: 'error', error: error.name === 'NotAllowedError' ? 'Cancelaste la selección de pestaña.' : error.message });
    }
  };

  useEffect(() => () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) releaseSession(session);
  }, []);

  return { ...state, start, stop, resume };
}
