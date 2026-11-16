import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './clean-minimal.css';
import './v8-interactions.css';
import './v9-layout.css';
import './v10-reference-workbench.css';
import './v11-retro-controls.css';
import './v12-collection-workflow.css';
import './v13-horizon-workbench.css';
import './v14-right-context.css';
import './v16-draft-requests.css';
import { readAppearance } from './features/appearance.js';
document.documentElement.dataset.theme = readAppearance(window.localStorage);
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
import './v17-environment-branding.css';
import './v18-menu-consistency.css';

import './v19-inline-name.css';

import './v21-documentation-headers.css';

import './v25-hoppscotch-import.css';

import './v26-auth-example-collapse.css';

import './v27-interceptor.css';
import './storage-scope.css';

import './v28-unified-storage.css';

import './v29-variable-experience.css';
