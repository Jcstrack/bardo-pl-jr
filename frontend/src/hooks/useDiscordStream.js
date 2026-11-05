import { useEffect, useRef, useState } from 'react';

const MIME = 'audio/webm;codecs=opus';

export default function useDiscordStream(captureRef, activeId) {
  const [state, setState] = useState({ phase: 'off', error: '' });
  const sessionRef = useRef(null);

  const stopCurrent = () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    session.closed = true;
    if (session.recorder.state !== 'inactive') session.recorder.stop();
    session.ownedStream?.getTracks().forEach((track) => track.stop());
    session.socket.close();
  };

  const stop = () => {
    stopCurrent();
    setState({ phase: 'off', error: '' });
  };

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
          audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          systemAudio: 'exclude',
        });
        audioStream = new MediaStream(ownedStream.getAudioTracks());
        const suppressed = ownedStream.getAudioTracks()[0]?.getSettings().suppressLocalAudioPlayback === true ||
          ownedStream.getVideoTracks()[0]?.getSettings().suppressLocalAudioPlayback === true;
        if (!suppressed) throw new Error('Este navegador no pudo silenciar la pestaña capturada. Se canceló para evitar audio doble.');
      }
      if (!audioStream.getAudioTracks().length) throw new Error('Comparte una pestaña y activa su audio para usar Modo Discord.');
      const recorder = new MediaRecorder(audioStream, { mimeType: MIME, audioBitsPerSecond: 128_000 });
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/api/bot/stream`);
      const session = { recorder, socket, ownedStream, closed: false };
      sessionRef.current = session;
      (ownedStream?.getTracks() || audioStream.getTracks()).forEach((track) => {
        track.addEventListener('ended', () => {
          if (sessionRef.current === session) {
            stopCurrent();
            setState({ phase: 'error', error: 'Terminó la captura de esta pestaña.' });
          }
        }, { once: true });
      });
      socket.onopen = () => socket.send(JSON.stringify({ code: code.trim().toUpperCase() }));
      socket.onmessage = ({ data }) => {
        if (sessionRef.current !== session) return;
        try {
          if (JSON.parse(data).type !== 'ready') return;
          recorder.ondataavailable = (event) => {
            if (!event.data.size || socket.readyState !== WebSocket.OPEN) return;
            if (socket.bufferedAmount > 4 * 1024 * 1024) {
              stopCurrent();
              setState({ phase: 'error', error: 'La conexión acumuló demasiado audio. Ejecuta /conectar y vuelve a activar Modo Discord.' });
              return;
            }
            // WebSocket acepta el Blob directamente y conserva el orden de los paquetes.
            socket.send(event.data);
          };
          recorder.start(100);
          setState({ phase: 'on', error: '' });
        } catch {
          setState({ phase: 'error', error: 'Respuesta inesperada del bot.' });
        }
      };
      socket.onclose = (event) => {
        if (session.closed || sessionRef.current !== session) return;
        stopCurrent();
        setState({ phase: 'error', error: event.reason ? `${event.reason}. Usa /conectar para obtener otro código.` : 'Se cerró la transmisión. Usa /conectar para obtener otro código.' });
      };
      socket.onerror = () => {
        if (sessionRef.current === session) setState({ phase: 'error', error: 'No se pudo conectar con el servicio del bot.' });
      };
    } catch (error) {
      ownedStream?.getTracks().forEach((track) => track.stop());
      setState({ phase: 'error', error: error.name === 'NotAllowedError' ? 'Cancelaste la selección de pestaña.' : error.message });
    }
  };

  useEffect(() => () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    session.closed = true;
    if (session.recorder.state !== 'inactive') session.recorder.stop();
    session.ownedStream?.getTracks().forEach((track) => track.stop());
    session.socket.close();
  }, []);

  return { ...state, start, stop };
}
