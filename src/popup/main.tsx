import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LockGate } from '../ui/LockGate';
import { App } from './App';
import '../ui.css';
import './popup.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LockGate>
      <App />
    </LockGate>
  </StrictMode>,
);
