import type { SectionKey } from '../sections.ts'

const PATHS: Record<SectionKey, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  diary: 'M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4',
  photos: 'M4 6h16v13H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  health: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM8 12h2l1-2 2 4 1-2h2',
  meditation: 'M12 6.5C10 5 7 4.6 3.5 5v13.5c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5zM12 6.5V20M16 8v5M14.5 9.5h3',
}

export function SectionIcon({ section, className }: { section: SectionKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[section]} />
    </svg>
  )
}
