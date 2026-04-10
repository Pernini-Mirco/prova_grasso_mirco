import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function DetailModal({ open, title, subtitle, children, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const modalNode = (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div
        className="detail-modal panel glow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-modal-head">
          <div>
            <p className="mini-label">Dettaglio</p>
            <h3>{title}</h3>
            {subtitle ? <p className="helper">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="detail-modal-close"
            onClick={onClose}
            aria-label="Chiudi dettaglio"
          >
            x
          </button>
        </div>

        <div className="detail-modal-body">{children}</div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalNode;
  }

  return createPortal(modalNode, document.body);
}
