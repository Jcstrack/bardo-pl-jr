import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../ui/Icon.jsx';

export default function ServiceModal({ id, title, description, icon, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    return () => previousFocus?.focus?.();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;

    const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="service-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="service-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={handleKeyDown}>
        <header className="service-modal-header">
          <span className="service-modal-icon"><Icon name={icon} size={23} /></span>
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            <p id={`${id}-description`}>{description}</p>
          </div>
          <button ref={closeRef} type="button" className="service-modal-close" aria-label={`Cerrar ${title}`} onClick={onClose}><Icon name="close" size={18} /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
