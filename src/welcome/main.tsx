import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Welcome } from './Welcome';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Welcome root element missing');

createRoot(root).render(
  <StrictMode>
    <Welcome />
  </StrictMode>,
);
