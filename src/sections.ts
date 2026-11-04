export type SectionKey = 'home' | 'diary' | 'photos' | 'health' | 'meditation'

export interface Section {
  key: SectionKey
  path: string
  label: string
  description: string
  hidden?: boolean // 메뉴에서만 숨김 (데이터와 주소는 그대로)
}

export const SECTIONS: Section[] = [
  { key: 'home', path: '/', label: '홈', description: '최근 기록을 한눈에' },
  { key: 'diary', path: '/diary', label: '일기', description: '일상과 하루의 기록' },
  { key: 'photos', path: '/photos', label: '사진', description: '사진과 갤러리', hidden: true },
  { key: 'health', path: '/health', label: '건강', description: '식단과 운동' },
  { key: 'meditation', path: '/meditation', label: '묵상', description: '말씀과 묵상' },
]

// 사이드바·하단 탭에 보이는 섹션
export const NAV_SECTIONS = SECTIONS.filter((s) => !s.hidden)
