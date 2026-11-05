import { useEffect, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';
import { createFriendInvite } from '../services/sharedLibrary.js';
import ServiceModal from '../../../components/ui/ServiceModal.jsx';

async function copyText(value, input) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  input?.select();
  return document.execCommand('copy');
}

export default function LibraryShareOption({ editorKey, accessRole, maximized = false }) {
  const [open, setOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [invitation, setInvitation] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch('/api/library/info', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((info) => {
          if (active) setPublicUrl(info?.publicUrl || '');
        })
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setInvitation('');
  }, [publicUrl]);

  const copy = async (value, label, id) => {
    try {
      const copied = await copyText(value, document.getElementById(id));
      setNotice(copied ? `${label} copiado.` : 'Selecciona la dirección y cópiala manualmente.');
    } catch {
      setNotice('Selecciona la dirección y cópiala manualmente.');
    }
  };

  const details = open && (
    <div className="discord-option-details" id="library-share-details">
      {accessRole === 'owner' ? (
        <>
          <strong>Invita a tu amigo</strong>
          <p>
            Al abrir el enlace completo entrará a esta página con todos los álbumes y podrá escuchar
            y agregar música.
          </p>
          {!publicUrl && (
            <p role="status">
              La conexión externa no está disponible. Inicia el túnel para generar la invitación.
            </p>
          )}
          <button
            type="button"
            className="generate-invite-button"
            disabled={!publicUrl}
            onClick={async () => {
              try {
                const result = await createFriendInvite(editorKey);
                setInvitation(result.url);
                setNotice('Invitación lista. Compártela solo con tu amigo.');
              } catch (error) {
                setNotice(error.message);
              }
            }}
          >
            Generar invitación
          </button>
          {invitation && (
            <div className="share-link-row">
              <input
                id="bardo-editor-url"
                aria-label="Invitación para editar"
                readOnly
                value={invitation}
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                onClick={() => copy(invitation, 'Invitación', 'bardo-editor-url')}
              >
                Copiar
              </button>
            </div>
          )}
        </>
      ) : accessRole === 'friend' ? (
        <p>Ya entraste con tu invitación. Puedes escuchar y agregar canciones.</p>
      ) : (
        <p>Abre el enlace completo que te enviaron para entrar directamente a la biblioteca.</p>
      )}
      {notice && (
        <p role="status" className="share-copy-notice">
          {notice}
        </p>
      )}
    </div>
  );

  return (
    <div className="discord-option library-share-option">
      <button
        type="button"
        className="discord-option-toggle"
        aria-expanded={open}
        aria-controls={maximized ? undefined : 'library-share-details'}
        aria-haspopup={maximized ? 'dialog' : undefined}
        onClick={() => setOpen((old) => !old)}
      >
        <span className="discord-option-icon">
          <Icon name="link" size={16} />
        </span>
        <span className="discord-option-name">
          Compartir biblioteca{' '}
          <small>{publicUrl ? 'Invita con un enlace' : 'Conexión externa no disponible'}</small>
        </span>
        {!maximized && <Icon name="chevron" size={15} className={open ? 'turned' : ''} />}
      </button>
      {maximized && open ? (
        <ServiceModal
          id="library-share-service"
          title="Compartir biblioteca"
          description={
            publicUrl ? 'Genera un enlace de invitación' : 'Conexión externa no disponible'
          }
          icon="link"
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
