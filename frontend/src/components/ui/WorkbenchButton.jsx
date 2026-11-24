import React from 'react';

/** Small reusable button; layout utilities are opt-in, existing theme is preserved. */
export function WorkbenchButton({ children, icon: Icon, tone = 'neutral', active = false, className = '', ...props }) {
  return <button type="button" {...props} className={`pp-aw-button pp-aw-button-${tone}${active ? ' active' : ''} ${className}`}>
    <span className="tw:inline-flex tw:items-center tw:justify-center tw:gap-1.5 tw:min-w-0">
      {Icon && <Icon size={14} aria-hidden="true"/>}{children}
    </span>
  </button>;
}
