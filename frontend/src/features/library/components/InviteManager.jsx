import { useEffect, useState } from 'react';
import {
  createManagedInvite,
  listFriendInvites,
  revokeFriendInvite,
  updateFriendInvite,
} from '../services/sharedLibrary.js';

const permissionLabels = { add: 'Agregar', edit: 'Editar', delete: 'Eliminar' };
const allPermissions = { add: true, edit: true, delete: true };

function PermissionChoices({ value, onChange }) {
  return (
    <div className="invite-permissions" aria-label="Permisos del enlace">
      {Object.entries(permissionLabels).map(([name, label]) => (
        <label key={name} className={value[name] ? 'is-selected' : ''}>
          <input
            type="checkbox"
            checked={Boolean(value[name])}
            onChange={(event) => onChange({ ...value, [name]: event.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function invitationStatus(item) {
  if (item.revokedAt) return 'Revocada';
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) return 'Vencida';
  return 'Activa';
}

export default function InviteManager({ editorKey, publicUrl }) {
  const [tab, setTab] = useState('create');
  const [invitations, setInvitations] = useState([]);
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('7');
  const [permissions, setPermissions] = useState(allPermissions);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [latestUrl, setLatestUrl] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const activeInvitations = invitations.filter((item) => invitationStatus(item) === 'Activa');
  const pastInvitations = invitations.filter((item) => invitationStatus(item) !== 'Activa');

  const refresh = async () => {
    const result = await listFriendInvites(editorKey);
    setInvitations(result.invitations);
  };

  useEffect(() => {
    let current = true;
    listFriendInvites(editorKey)
      .then((result) => { if (current) setInvitations(result.invitations); })
      .catch((error) => { if (current) setNotice(error.message); });
    return () => { current = false; };
  }, [editorKey, publicUrl]);

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setManualUrl('');
      setNotice('Enlace copiado.');
    } catch {
      setManualUrl(url);
      setNotice('Selecciona y copia el enlace del campo de texto.');
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const expiresAt = duration === 'never' ? null : new Date(Date.now() + Number(duration) * 86400000).toISOString();
      const result = await createManagedInvite(editorKey, { label, expiresAt, permissions });
      setLatestUrl(result.invitation.url);
      setLabel('');
      await refresh();
      setNotice('Invitación creada. Puedes copiarla o administrarla en «Mis enlaces».');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({ label: item.label, expiresAt: localDateTime(item.expiresAt), permissions: { ...item.permissions } });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await updateFriendInvite(editorKey, editingId, {
        label: draft.label,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        permissions: draft.permissions,
      });
      await refresh();
      setEditingId(null);
      setDraft(null);
      setNotice('Invitación actualizada. Los permisos nuevos ya están activos.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (item) => {
    if (!window.confirm(`¿Dar de baja el enlace «${item.label}»? Dejará de funcionar inmediatamente.`)) return;
    setBusy(true);
    setNotice('');
    try {
      await revokeFriendInvite(editorKey, item.id);
      await refresh();
      if (editingId === item.id) setEditingId(null);
      if (latestUrl === item.url) setLatestUrl('');
      if (manualUrl === item.url) setManualUrl('');
      setNotice('Enlace dado de baja.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="invite-manager">
      <div className="invite-tabs" role="tablist" aria-label="Invitaciones">
        <button type="button" role="tab" aria-selected={tab === 'create'} onClick={() => setTab('create')}>Crear invitación</button>
        <button type="button" role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>Mis enlaces <span>{activeInvitations.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Historial <span>{pastInvitations.length}</span></button>
      </div>
      {tab === 'create' ? (
        <form className="invite-form" onSubmit={create}>
          <p>El enlace abre esta biblioteca. Tú eliges por cuánto tiempo y qué cambios permite.</p>
          <label>
            Nombre para identificarlo
            <input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="Ej.: Dungeon Master" />
          </label>
          <label>
            Tiempo de acceso
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option value="1">1 día</option>
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="never">Sin vencimiento</option>
            </select>
          </label>
          <span className="invite-field-title">Puede escuchar y:</span>
          <PermissionChoices value={permissions} onChange={setPermissions} />
          <button type="submit" className="generate-invite-button" disabled={busy || !publicUrl}>Generar enlace</button>
          {!publicUrl && <p role="status">La dirección externa aún no está disponible. Inicia el túnel para generar el enlace.</p>}
          {latestUrl && latestUrl.startsWith(publicUrl) && (
            <div className="share-link-row">
              <input aria-label="Enlace de invitación" readOnly value={latestUrl} onFocus={(event) => event.target.select()} />
              <button type="button" onClick={() => copy(latestUrl)}>Copiar</button>
            </div>
          )}
        </form>
      ) : (
        <div className="invite-list">
          {!(tab === 'list' ? activeInvitations : pastInvitations).length && (
            <p>{tab === 'list' ? 'No tienes enlaces activos.' : 'No hay enlaces vencidos ni dados de baja.'}</p>
          )}
          {(tab === 'list' ? activeInvitations : pastInvitations).map((item) => (
            <div key={item.id} className="invite-row">
              <div className="invite-row-summary">
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.expiresAt ? `Hasta ${new Date(item.expiresAt).toLocaleString('es-CL')}` : 'Sin vencimiento'}</small>
                </div>
                <span className={'invite-status ' + (invitationStatus(item) === 'Activa' ? 'is-active' : '')}>{invitationStatus(item)}</span>
              </div>
              <div className="invite-row-permissions">{['Escuchar', ...Object.entries(item.permissions).filter(([, allowed]) => allowed).map(([name]) => permissionLabels[name])].join(' · ')}</div>
              {tab === 'list' && (
                <div className="invite-row-actions">
                  <button type="button" onClick={() => copy(item.url)} disabled={!item.url}>Copiar</button>
                  <button type="button" onClick={() => startEdit(item)}>Editar</button>
                  <button type="button" className="invite-revoke" onClick={() => revoke(item)} disabled={busy}>Dar de baja</button>
                </div>
              )}
              {tab === 'history' && !item.revokedAt && (
                <div className="invite-row-actions">
                  <button type="button" onClick={() => startEdit(item)}>Cambiar vencimiento</button>
                </div>
              )}
              {editingId === item.id && draft && (
                <form className="invite-edit" onSubmit={saveEdit}>
                  <label>Nombre<input value={draft.label} maxLength={80} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
                  <label>Acceso hasta <input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} /></label>
                  <small>Deja la fecha vacía para acceso sin vencimiento.</small>
                  <PermissionChoices value={draft.permissions} onChange={(value) => setDraft({ ...draft, permissions: value })} />
                  <div className="invite-row-actions">
                    <button type="submit" disabled={busy}>Guardar cambios</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      {manualUrl && (
        <input className="invite-manual-url" aria-label="Enlace para copiar manualmente" readOnly value={manualUrl} onFocus={(event) => event.target.select()} />
      )}
      {notice && <p className="share-copy-notice" role="status">{notice}</p>}
    </div>
  );
}
