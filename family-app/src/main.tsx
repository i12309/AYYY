import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installDownloads } from './lib/api';
import './styles.css';

installDownloads();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
