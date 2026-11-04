import type { CapacitorConfig } from '@capacitor/cli'

// 원격 로드 방식: 앱은 배포된 GitHub Pages 사이트를 불러온다.
// 웹 코드는 push만 하면 앱에도 반영되고, APK는 네이티브 플러그인이 바뀔 때만 다시 설치한다.
const config: CapacitorConfig = {
  appId: 'io.github.jackmmin.aboutme',
  appName: '생활기록', // Android 홈 화면·앱 목록 이름 (strings.xml과 맞춤)
  webDir: 'dist',
  server: {
    url: 'https://jackmmin.github.io/about-me/',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
