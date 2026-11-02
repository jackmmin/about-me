import { createHashRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { SectionPage } from './pages/SectionPage.tsx'
import { SECTIONS } from './sections.ts'

// GitHub Pages는 서버 라우팅이 없어 새로고침 시 404가 나므로 해시 라우터를 쓴다.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      ...SECTIONS.map((s) => ({ path: s.path, element: <SectionPage section={s} /> })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
