import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { removeLegacyLabDatabase } from './platform/legacyCleanup';
import { Root } from './ui/Root';
import './ui/styles.css';

void removeLegacyLabDatabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
