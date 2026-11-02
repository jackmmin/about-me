export type SectionKey = 'home' | 'diary' | 'career' | 'reading' | 'photos' | 'health'

export interface Section {
  key: SectionKey
  path: string
  label: string
  description: string
}

export const SECTIONS: Section[] = [
  { key: 'home', path: '/', label: '홈', description: '최근 기록을 한눈에' },
  { key: 'diary', path: '/diary', label: '일기', description: '일상과 하루의 기록' },
  { key: 'career', path: '/career', label: '경력', description: '경력과 프로젝트' },
  { key: 'reading', path: '/reading', label: '독서', description: '읽은 책과 공부한 내용' },
  { key: 'photos', path: '/photos', label: '사진', description: '사진과 갤러리' },
  { key: 'health', path: '/health', label: '건강', description: '수면, 체중, 운동, 컨디션' },
]
