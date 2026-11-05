// record_date는 'YYYY-MM-DD' 문자열. UTC 기준으로 해석해 시간대에 따라 하루가 밀리는 것을 막는다.
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'UTC',
})

const monthFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' })

export function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`))
}

export function formatMonth(date: string) {
  return monthFormatter.format(new Date(`${date}T00:00:00Z`))
}

// 사용자의 현지 날짜 (YYYY-MM-DD)
export function today() {
  return new Date().toLocaleDateString('sv-SE')
}

// 목록 미리보기용으로 마크다운 기호를 대충 걷어낸다.
export function excerpt(markdown: string, length = 120) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? `${text.slice(0, length)}…` : text
}

// 차트 눈금용 짧은 날짜 (M/D)
export function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
}

// month: YYYY-MM
export function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}

// 그달의 날짜들 (YYYY-MM-DD)
export function monthDays(month: string) {
  const d = new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`)
  d.setUTCDate(0)
  return Array.from({ length: d.getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
