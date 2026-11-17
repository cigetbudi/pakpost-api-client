import React from 'react';
import { X } from 'lucide-react';
import { restoreDialogFocus } from './dialogFocus.js';

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
  // Save the trigger while the dialog is rendering, BEFORE autoFocus moves focus
  // into an input/button. Without returning focus, F2/Delete stops working after
  // closing a dialog because keydown no longer bubbles through the Explorer.
  const previouslyFocused = React.useRef(null);
  const dialogRef = React.useRef(null);
  if (previouslyFocused.current === null && typeof document !== 'undefined') {
    previouslyFocused.current = document.activeElement;
  }
  React.useEffect(() => () => {
    // Handles StrictMode effect replay and skips stale/hidden triggers.
    restoreDialogFocus(previouslyFocused.current, dialogRef.current, document);
  }, []);
  return (
    <div ref={dialogRef} className="overlay" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }} onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
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
