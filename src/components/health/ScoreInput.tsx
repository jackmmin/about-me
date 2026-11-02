// 1~5 점수 선택. 같은 점수를 다시 누르면 해제된다.
export function ScoreInput({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  low: string
  high: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`size-10 rounded-lg border text-sm font-semibold ${
              value === n
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
            onClick={() => onChange(value === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-neutral-400" style={{ width: 'calc(5 * 2.5rem + 4 * 0.375rem)' }}>
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  )
}
