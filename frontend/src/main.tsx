/**
 * @Author wei
 * @Date 2026-11-04
 * @Description React 前端渲染主入口，挂载全局 Tailwind CSS 与 Cosmic Night 样式
 **/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
