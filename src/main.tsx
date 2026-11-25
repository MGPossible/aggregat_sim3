import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles/app.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root-Element #root nicht gefunden.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
