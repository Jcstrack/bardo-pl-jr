import { useEffect, useState } from 'react';
import Icon from '../../../components/ui/Icon.jsx';
import ServiceModal from '../../../components/ui/ServiceModal.jsx';
import InviteManager from './InviteManager.jsx';

export default function LibraryShareOption({ editorKey, accessRole, accessPermissions, maximized = false }) {
  const [open, setOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

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

  const details = open && (
    <div className="discord-option-details" id="library-share-details">
      {accessRole === 'owner' ? (
        <InviteManager editorKey={editorKey} publicUrl={publicUrl} />
      ) : accessRole === 'friend' ? (
        <p>Tu invitación permite escuchar{accessPermissions?.add ? ', agregar' : ''}{accessPermissions?.edit ? ', editar' : ''}{accessPermissions?.delete ? ' y eliminar' : ''} canciones.</p>
      ) : (
        <p>Abre el enlace completo que te enviaron para entrar directamente a la biblioteca.</p>
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
          className="service-modal--invites"
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
