import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW зарегистрирован:', registration.scope)
        
        // Проверяем обновления
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Новая версия доступна
                console.log('Доступна новая версия приложения')
              }
            })
          }
        })
      })
      .catch((error) => {
        console.log('SW ошибка регистрации:', error)
      })
  })
}

// Предзагрузка шрифтов для офлайн PDF
const preloadFonts = async () => {
  try {
    await Promise.all([
      fetch('/fonts/Roboto-Regular.ttf', { cache: 'force-cache' }),
      fetch('/fonts/Roboto-Bold.ttf', { cache: 'force-cache' })
    ])
    console.log('Шрифты для PDF предзагружены')
  } catch (e) {
    console.log('Ошибка предзагрузки шрифтов:', e)
  }
}
preloadFonts()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

