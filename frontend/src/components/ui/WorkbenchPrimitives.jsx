import React from 'react';
import { X } from 'lucide-react';

export function IconButton({ icon: Icon, onClick, label, disabled = false }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon size={16} />
    </button>
  );
}

export function Empty({ icon: Icon, title, description }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={23} /></div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

/** Shared modal shell; retains backdrop-to-dismiss and accessible dialog role. */
export function Dialog({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="overlay" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={wide ? 'dialog pp-revision-dialog' : 'dialog'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-top">
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
