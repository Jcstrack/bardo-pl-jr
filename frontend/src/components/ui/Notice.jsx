import Icon from './Icon.jsx';

export default function Notice({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="notice" role="status">
      <span>{message}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onDismiss}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
