import React from 'react';
import { LoaderCircle, Info, FolderOpen } from 'lucide-react';

export function Spinner({ size = 15, label, className = '' }) {
  const icon = <LoaderCircle size={size} className="pp-ux-spin" aria-hidden="true"/>;
  return label ? <span className={`pp-ux-feedback ${className}`} role="status">{icon}<span>{label}</span></span> : icon;
}
export function LoadingButton({ loading = false, loadingLabel = 'Processing…', disabled, children, ...props }) {
  return <button {...props} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading ? <><Spinner/><span>{loadingLabel}</span></> : children}
  </button>;
}
export function Skeleton({ label = 'Loading…', rows = 4, className = '', style }) {
  return <div className={`pp-ux-skeleton ${className}`} role="status" style={style}>
    <span className="pp-ux-feedback"><Spinner/>{label}</span>
    <div aria-hidden="true">{Array.from({length:rows},(_,i)=><i key={i} style={{width:`${[92,76,84,60][i%4]}%`}}/>)}</div>
  </div>;
}
export function EmptyState({ label, description, action, icon: Icon = FolderOpen }) {
  return <div className="pp-ux-empty"><Icon size={21} aria-hidden="true"/><strong>{label}</strong>{description&&<span>{description}</span>}{action}</div>;
}
export function NoticeIcon() {return <Info size={17} aria-hidden="true"/>;}
