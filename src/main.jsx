import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installAppBridge } from './native'
import './styles.css'
import './app.css'

installAppBridge()

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
