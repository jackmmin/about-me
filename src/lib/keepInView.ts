// 키패드가 올라와 화면이 줄어들면 입력 칸과 그 아래 목록이 보이도록 가운데로 스크롤한다
export function keepInView(el: HTMLElement | null) {
  const vv = window.visualViewport
  if (!vv || !el) return
  const onResize = () => el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  vv.addEventListener('resize', onResize)
  setTimeout(() => vv.removeEventListener('resize', onResize), 1000)
}
