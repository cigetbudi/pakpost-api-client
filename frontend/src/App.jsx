import React from 'react';
import { useWorkbenchController } from './app/hooks/useWorkbenchController.jsx';
import { WorkbenchView } from './app/components/WorkbenchView.jsx';

/** PakPost entry: a thin composition boundary for Web and future Tauri. */
export default function App() {
  const model = useWorkbenchController();
  return <WorkbenchView model={model} />;
}
