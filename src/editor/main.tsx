import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LockGate } from '../ui/LockGate';
import { Editor } from './Editor';
import '../ui.css';
import './editor.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LockGate purpose="change the blocker’s settings">
      <Editor />
    </LockGate>
  </StrictMode>,
);
