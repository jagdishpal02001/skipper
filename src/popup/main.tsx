import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Popup root element missing');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
