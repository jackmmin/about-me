import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppLock } from './auth/AppLock.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'
import './index.css'
import { router } from './router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLock>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <UpdatePrompt />
    </AppLock>
  </StrictMode>,
)
