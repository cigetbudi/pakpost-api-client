import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import {DesktopApproval} from './features/desktop/components/DesktopApproval.jsx';
import { WorkbenchErrorBoundary } from './components/ui/WorkbenchErrorBoundary.jsx';
import './styles/base.css';
import './styles/clean-workbench.css';
import './styles/layers/interactions.css';
import './styles/layers/workbench-layout.css';
import './styles/layers/theme-and-surfaces.css';
import './styles/layers/form-controls.css';
import './styles/layers/collection-workflows.css';
import './styles/layers/workbench-details.css';
import './styles/layers/context-sidebar.css';
import './styles/layers/request-drafts.css';
import { readAppearance } from './features/settings/services/appearance.js';
document.documentElement.dataset.theme = readAppearance(window.localStorage);
createRoot(document.getElementById('root')).render(<React.StrictMode><WorkbenchErrorBoundary>{window.location.pathname==='/desktop-connect'?<DesktopApproval/>:<App/>}</WorkbenchErrorBoundary></React.StrictMode>);
import './styles/layers/environment-branding.css';
import './styles/layers/action-menus.css';

import './styles/layers/inline-rename.css';

import './styles/layers/request-documentation.css';

import './styles/layers/import-compatibility.css';

import './styles/layers/request-auth-and-examples.css';

import './styles/layers/request-transport.css';
import './styles/storage-scope.css';

import './styles/layers/storage-controls.css';

import './styles/layers/variable-highlights.css';

import './styles/layers/workspace-environments.css';
import './styles/layers/google-auth.css';

import './styles/layers/workspace-permissions.css';

import './styles/layers/qa-sandbox.css';
import './styles/layers/role-management.css';
import './styles/layers/invitations.css';

import './styles/layers/realtime-conflicts.css';

import './styles/layers/cloud-folder-polish.css';
import './styles/layers/explorer-tree-alignment.css';
import './styles/layers/account-security.css';
import './styles/layers/workspace-founder-delete.css';

import './styles/layers/instance-administration.css';
import './styles/layers/motion-system.css';

import './styles/desktop-connections.css';

import './styles/workbench-tokens.css';
import './styles/workbench-utilities.css';
import './styles/adaptive-workbench.css';
import './styles/adaptive-controls.css';

import './styles/adaptive-comfort.css';

import './styles/adaptive-mobile.css';
