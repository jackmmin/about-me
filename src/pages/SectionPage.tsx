import type { Section } from '../sections.ts'

// 각 섹션의 임시 화면. 6단계(기록 CRUD)에서 실제 목록으로 교체한다.
export function SectionPage({ section }: { section: Section }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{section.label}</h1>
      <p className="mt-1 text-sm text-neutral-500">{section.description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
        아직 기록이 없습니다.
      </div>
    </section>
  )
}
