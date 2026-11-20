import React from 'react';
import {ArrowDownUp, Braces, Copy, Download, Ellipsis, FileText, FolderPlus, GitCompareArrows, History, MoveRight, Pencil, Play, Plus, Trash2} from 'lucide-react';

// One menu row shared by local collections, Neon collections, and environments.
// Keep existing action IDs intact; these are visual icons, not new behaviors.
const actionIcons = {
  newRequest: Plus,
  newFolder: FolderPlus,
  runCollection: Play,
  variables: Braces,
  versionHistory: History,
  documentation: FileText,
  renameCollection: Pencil,
  duplicateCollection: Copy,
  sortCollection: ArrowDownUp,
  sortMethod: ArrowDownUp,
  exportCollection: Download,
  deleteCollection: Trash2,
  moveFolder: MoveRight,
  organizeFolders: MoveRight,
  renameFolder: Pencil,
  duplicateFolder: Copy,
  sortFolder: ArrowDownUp,
  deleteFolder: Trash2,
  renameRequest: Pencil,
  renameExample: Pencil,
  deleteExample: Trash2,
  duplicateRequest: Copy,
  deleteRequest: Trash2,
  editVariables: Pencil,
  compare: GitCompareArrows,
  rename: Pencil,
  duplicate: Copy,
  export: Download,
  delete: Trash2,
};

export function MenuActionItem({action, children, onClick, disabled=false, danger=false}) {
  const Icon=actionIcons[action]||Ellipsis;
  return <button
    type="button"
    role="menuitem"
    className={`pp-action-menu-item${danger?' danger':''}`}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon size={15} strokeWidth={1.8} aria-hidden="true"/>
    <span>{children}</span>
  </button>;
}
