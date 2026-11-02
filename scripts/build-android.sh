#!/usr/bin/env bash
# Android 앱 로컬 빌드: 스토어 업로드용 AAB + 직접 설치용 APK
# 서명 키 위치와 결과물 위치는 git에 올라가지 않는 scripts/android.local.env에서 읽는다.
# (양식: scripts/android.local.env.example)
#
# 사용법 (Git Bash):  scripts/build-android.sh [버전명]     예) scripts/build-android.sh 1.1.0
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_ENV="scripts/android.local.env"
[ -f "$LOCAL_ENV" ] || { echo "❌ $LOCAL_ENV 가 없습니다. scripts/android.local.env.example을 복사해 값을 채우세요."; exit 1; }
# shellcheck source=/dev/null
. "$LOCAL_ENV"
: "${ANDROID_KEYSTORE_FILE:?}" "${ANDROID_KEY_PASSWORD_FILE:?}" "${ANDROID_KEY_ALIAS:?}" "${ANDROID_OUT_DIR:?}"

export VERSION_NAME="${1:-1.0.0}"
# 스토어는 업로드마다 versionCode가 커져야 한다 → 분 단위 타임스탬프 사용
export VERSION_CODE=$(( $(date +%s) / 60 ))

has_jdk21() { "$1/bin/java" -version 2>&1 | grep -qE 'version "(2[1-9]|[3-9][0-9])'; }

# Capacitor 8은 JDK 21 이상 필요. JAVA_HOME이 맞지 않으면 Android Studio 내장 JDK를 쓴다.
if [ -z "${JAVA_HOME:-}" ] || ! has_jdk21 "$JAVA_HOME"; then
  export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
fi
has_jdk21 "$JAVA_HOME" || { echo "❌ JDK 21 이상이 필요합니다 (Android Studio 설치 또는 JAVA_HOME 지정)"; exit 1; }

# Android SDK 위치 (android/local.properties는 gitignore 대상)
[ -f android/local.properties ] || echo "sdk.dir=$(cygpath -m "$LOCALAPPDATA/Android/Sdk")" > android/local.properties

# 서명: 로컬 설정에 적힌 키 파일과 비밀번호 파일을 쓴다 (android/app/build.gradle이 환경변수로 받음)
[ -f "$ANDROID_KEYSTORE_FILE" ] || { echo "❌ 서명 키 파일이 없습니다."; exit 1; }
PW=$(sed -n 's/^password: *//p' "$ANDROID_KEY_PASSWORD_FILE" | tr -d '\r\n')
export ANDROID_KEYSTORE_PATH="$(cygpath -m "$ANDROID_KEYSTORE_FILE")"
export ANDROID_KEYSTORE_PASSWORD="$PW" ANDROID_KEY_PASSWORD="$PW" ANDROID_KEY_ALIAS

echo "▶ 빌드: $VERSION_NAME ($VERSION_CODE)"
npm run build
npx cap sync android
(cd android && ./gradlew bundleRelease assembleRelease --no-daemon -q)

mkdir -p "$ANDROID_OUT_DIR"
name="about-me-$VERSION_NAME-$VERSION_CODE"
cp android/app/build/outputs/bundle/release/app-release.aab "$ANDROID_OUT_DIR/$name.aab"
cp android/app/build/outputs/apk/release/app-release.apk "$ANDROID_OUT_DIR/$name.apk"
echo "✅ 완료: $ANDROID_OUT_DIR"
echo "   - $name.aab  (Play 스토어 업로드용)"
echo "   - $name.apk  (폰에 직접 설치용)"
