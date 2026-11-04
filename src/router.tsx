import { createHashRouter, Navigate } from 'react-router'
import { AuthGate } from './auth/AuthGate.tsx'
import { Layout } from './components/Layout.tsx'
import { EntryDetailPage } from './pages/EntryDetailPage.tsx'
import { EntryEditPage } from './pages/EntryEditPage.tsx'
import { EntryListPage } from './pages/EntryListPage.tsx'
import { FoodAnalysisPage } from './pages/FoodAnalysisPage.tsx'
import { HealthPage } from './pages/HealthPage.tsx'
import { HealthStatsPage } from './pages/HealthStatsPage.tsx'
import { PhotoGalleryPage } from './pages/PhotoGalleryPage.tsx'
import { SearchPage } from './pages/SearchPage.tsx'

// GitHub Pages는 서버 라우팅이 없어 새로고침 시 404가 나므로 해시 라우터를 쓴다.
// 모든 화면은 AuthGate(로그인 + OTP) 안쪽에 있다.
export const router = createHashRouter([
  {
    element: <AuthGate />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <EntryListPage /> },
          { path: '/diary', element: <EntryListPage type="diary" /> },
          { path: '/meditation', element: <EntryListPage type="meditation" /> },
          { path: '/photos', element: <PhotoGalleryPage /> },
          { path: '/health', element: <HealthPage /> },
          { path: '/health/stats', element: <HealthStatsPage /> },
          { path: '/health/foods', element: <FoodAnalysisPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/entries/new', element: <EntryEditPage /> },
          { path: '/entries/:id', element: <EntryDetailPage /> },
          { path: '/entries/:id/edit', element: <EntryEditPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
