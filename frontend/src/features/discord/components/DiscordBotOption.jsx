import { useEffect, useRef, useState } from 'react';
import useBotStatus from '../hooks/useBotStatus.js';
import Icon from '../../../components/ui/Icon.jsx';
import ServiceModal from '../../../components/ui/ServiceModal.jsx';

const statusText = {
  checking: 'Comprobando',
  connecting: 'Conectando',
  'needs-token': 'Pendiente de configurar',
  disconnected: 'Desconectado',
  offline: 'Sin conexión',
  error: 'Error de conexión',
};

export default function DiscordBotOption({ stream, maximized = false }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const status = useBotStatus(true);
  const previousPhase = useRef(stream.phase);
  useEffect(() => {
    if (maximized && previousPhase.current === 'connecting' && stream.phase === 'on') setOpen(false);
    previousPhase.current = stream.phase;
  }, [maximized, stream.phase]);
  const modeActive = stream.phase === 'on' || stream.phase === 'connecting';
  const label = status.streaming
    ? 'Reproduciendo en Discord'
    : status.paired && !status.voiceConnected
      ? 'Vinculado · fuera de voz'
      : status.transportConnected
        ? 'Conectado · sin audio'
      : status.voiceConnected
        ? 'En canal de voz'
        : status.connected
          ? 'En línea · fuera de voz'
          : statusText[status.state] || 'Sin conexión';

  const details = open && (
    <div className="discord-option-details" id="discord-option-details" role="status">
      <strong>Bardo Politanense</strong>
      <p>
        {status.connected
          ? status.voiceConnected
            ? `Bardo está en ${status.channelName}.${status.streaming ? ' Reproduciendo audio en Discord.' : status.transportConnected ? ' Vinculado al reproductor y esperando audio audible.' : ' Esperando el código y audio del navegador.'}`
            : status.paired
              ? `Bardo está fuera de voz, pero sigue vinculado al reproductor. Al volver a reproducir música regresará al canal ${status.lastChannelName || 'anterior'} sin otro código. Usa /desconectar para cerrar la vinculación.`
              : `Bardo está en línea como ${status.botName}, pero fuera de voz. Entra a un canal y ejecuta /conectar; el código anterior deja de servir si se reinicia el bot.`
          : status.state === 'needs-token'
            ? 'Configura la clave del bot en el servicio local para conectarlo.'
            : status.state === 'checking' || status.state === 'connecting'
              ? 'Comprobando la conexión del bot…'
              : 'Inicia el servicio local del bot para conectar esta opción.'}
      </p>
      <label className="discord-code-label" htmlFor="discord-code">
        Código de /conectar
      </label>
      <input
        id="discord-code"
        className="discord-code"
        value={code}
        onChange={(event) =>
          setCode(
            event.target.value
              .toUpperCase()
              .replace(/[^A-F0-9]/g, '')
              .slice(0, 12),
          )
        }
        placeholder="12 caracteres"
        autoComplete="off"
        spellCheck="false"
      />
      <button
        type="button"
        className={'discord-mode-button' + (modeActive ? ' is-active' : '')}
        aria-pressed={modeActive}
        onClick={() => (modeActive ? stream.stop() : stream.start(code))}
        disabled={!status.voiceConnected && !modeActive}
      >
        <span className="discord-mode-button-icon">
          <Icon name="broadcast" size={18} />
        </span>
        <span className="discord-mode-button-copy">
          <strong>Modo Discord</strong>
          <small>
            {status.streaming
              ? 'Reproduciendo en el canal de voz'
              : stream.phase === 'on'
                ? status.voiceConnected ? 'Conexión abierta; esperando audio audible' : 'Vinculado; regresará al reproducir música'
                : stream.phase === 'connecting'
                  ? 'Conectando…'
                  : status.voiceConnected
                    ? 'Transmitir audio del reproductor'
                    : 'Primero conecta el bot con /conectar'}
          </small>
        </span>
        <span className="discord-mode-button-state">{modeActive ? 'Activado' : 'Activar'}</span>
      </button>
      {stream.error && (
        <p className="discord-mode-error" role="alert">
          {stream.error}
        </p>
      )}
      <a
        href="https://discord.com/developers/applications"
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir portal de Discord ↗
      </a>
    </div>
  );

  return (
    <div className="discord-option">
      <button
        type="button"
        className="discord-option-toggle"
        aria-expanded={open}
        aria-controls={maximized ? undefined : 'discord-option-details'}
        aria-haspopup={maximized ? 'dialog' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="discord-option-icon">
          <Icon name="bot" size={17} />
        </span>
        <span className="discord-option-name">
          Bot de Discord <small>{label}</small>
        </span>
        {!maximized && <Icon name="chevron" size={15} className={open ? 'turned' : ''} />}
      </button>
      {maximized && open ? (
        <ServiceModal
          id="discord-service"
          title="Bot de Discord"
          description={label}
          icon="bot"
          onClose={() => setOpen(false)}
        >
          {details}
        </ServiceModal>
      ) : (
        details
      )}
    </div>
  );
}
