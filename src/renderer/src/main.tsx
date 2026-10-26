import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { QuickProgress } from './QuickProgress'
import './styles.css'

const compact = new URLSearchParams(location.search).get('view') === 'progress'
if (compact) document.documentElement.classList.add('progress-mode')
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{compact ? <QuickProgress /> : <App />}</React.StrictMode>)
