// Editor application bootstrap and global style entrypoint.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/editor.css'
import './styles/print.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
