import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isExtensionsPage } from '../lock';
import { LockGate } from '../ui/LockGate';
import { Options } from './Options';
import '../ui.css';
import './options.css';

// Set by the background when it stops a tab on its way to chrome://extensions.
const returnTo = new URLSearchParams(location.hash.slice(1)).get('return');
const extensionsPage = returnTo && isExtensionsPage(returnTo) ? returnTo : null;

async function continueToExtensions() {
  if (!extensionsPage) return;
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) await chrome.tabs.update(tab.id, { url: extensionsPage });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LockGate
      purpose={extensionsPage ? 'open the extensions page' : 'change the blocker’s settings'}
      onUnlock={() => void continueToExtensions()}
    >
      <Options />
    </LockGate>
  </StrictMode>,
);
