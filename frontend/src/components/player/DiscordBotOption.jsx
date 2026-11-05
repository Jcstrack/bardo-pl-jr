import { useState } from 'react';
import useBotStatus from '../../hooks/useBotStatus.js';
import Icon from '../ui/Icon.jsx';
import ServiceModal from './ServiceModal.jsx';

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
  const status = useBotStatus(open);
  const label = status.streaming ? 'Reproduciendo en Discord' : status.transportConnected ? 'Recibiendo audio' : status.voiceConnected ? 'En canal de voz' : status.connected ? 'En línea · fuera de voz' : statusText[status.state] || 'Sin conexión';

  const details = open && (
    <div className="discord-option-details" id="discord-option-details" role="status">
      <strong>Bardo Politanense JR</strong>
      <p>{status.connected
        ? status.voiceConnected
          ? `Bardo está en ${status.channelName}.${status.streaming ? ' Reproduciendo audio en Discord.' : status.transportConnected ? ` Flujo conectado: ${status.audioChunks || 0} fragmentos de audio recibidos; reproductor ${status.playerState || 'pendiente'}.` : ' Esperando el código y audio del navegador.'}`
          : `Bardo está en línea como ${status.botName}, pero fuera de voz. Entra a un canal y ejecuta /conectar de nuevo; el código anterior deja de servir si se reinicia el bot.`
        : status.state === 'needs-token'
          ? 'Configura la clave del bot en el servicio local para conectarlo.'
          : status.state === 'checking' || status.state === 'connecting'
            ? 'Comprobando la conexión del bot…'
            : 'Inicia el servicio local del bot para conectar esta opción.'}</p>
      <label className="discord-code-label" htmlFor="discord-code">Código de /conectar</label>
      <input id="discord-code" className="discord-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 12))} placeholder="12 caracteres" autoComplete="off" spellCheck="false" />
      <label className="discord-mode-switch">
        <input type="checkbox" checked={stream.phase === 'on' || stream.phase === 'connecting'} onChange={(event) => event.target.checked ? stream.start(code) : stream.stop()} disabled={!status.voiceConnected && stream.phase !== 'on'} />
        <span>Modo Discord</span>
        <small>{status.streaming ? 'Reproduciendo en el canal de voz' : stream.phase === 'on' ? 'Conexión abierta; esperando audio audible' : stream.phase === 'connecting' ? 'Conectando…' : status.voiceConnected ? 'Transmitir audio del reproductor' : 'Primero conecta el bot con /conectar'}</small>
      </label>
      {stream.error && <p className="discord-mode-error" role="alert">{stream.error}</p>}
      <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Abrir portal de Discord ↗</a>
    </div>
  );

  return (
    <div className="discord-option">
      <button type="button" className="discord-option-toggle" aria-expanded={open} aria-controls={maximized ? undefined : 'discord-option-details'} aria-haspopup={maximized ? 'dialog' : undefined} onClick={() => setOpen((current) => !current)}>
        <span className="discord-option-icon"><Icon name="bot" size={17} /></span>
        <span className="discord-option-name">Bot de Discord <small>{label}</small></span>
        {!maximized && <Icon name="chevron" size={15} className={open ? 'turned' : ''} />}
      </button>
      {maximized && open ? <ServiceModal id="discord-service" title="Bot de Discord" description={label} icon="bot" onClose={() => setOpen(false)}>{details}</ServiceModal> : details}
    </div>
  );
}
