import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { boot } from './state/store';
import App from './App';

// boot before first render: seeds configs from the saved snapshot (with key
// migration), applies deep-link params, and registers the asset DOM bridge —
// so the first engine instantiation already sees the settled state.
boot();

// No StrictMode: the shader canvas is an imperative GL island (one context,
// one engine, one rAF loop per mount) and StrictMode's double-effect pass
// would tear down a live context and re-instantiate on the dead element.
createRoot(document.getElementById('root')!).render(<App />);
