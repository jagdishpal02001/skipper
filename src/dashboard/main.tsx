import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Dashboard root element missing');

createRoot(root).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
