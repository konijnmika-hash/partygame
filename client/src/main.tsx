import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/game.css';
import { App } from './App';
import { boot } from './boot';
import { cleanFreshParam, handleStaleBuild } from './net/freshReload';

cleanFreshParam();
// a code file from before a site update is gone: load the new version instead of breaking
window.addEventListener('vite:preloadError', (e) => {
  if (handleStaleBuild()) e.preventDefault();
});

boot();
createRoot(document.getElementById('root')!).render(<App />);
