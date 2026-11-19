import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/pwa';
// Yazı tipi kendi sunucumuzdan gelir (Google Fonts'a istek yok: oyuncuların IP'si üçüncü tarafa gitmez).
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-ext-500.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-ext-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import './styles/index.css';

registerServiceWorker();

const root = document.getElementById('root');
if (!root) throw new Error('#root bulunamadı');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
