import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import AppRouter from './core/router/AppRouter'
import { OfflineIndicator } from './components/OfflineIndicator'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30000, // 30 секунд
      // Не пытаться рефетчить в офлайне
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <OfflineIndicator />
          <AppRouter />
        </BrowserRouter>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App

