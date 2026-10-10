# GENDER WARFARE — Google Drive 공유 저장 / Android SAF

**기준:** [골든퀘스트 표준](https://github.com/Alix1211/ARPG/blob/main/docs/standards/drive_save_sync.md), `Alix1211/ARPG`의 `MainActivity.java`, `src/town/save_sync.js`, `src/town/backup.js`, [문플로 Android 저장](https://github.com/Alix1211/moonflo/blob/main/android/app/src/main/java/com/moonsunfarm/game/MainActivity.java).

**기준 백업:** `backup/pre-gdrive-sync-20261010`, 기준 `f5abcb602e6be2a79bb6b7fb36e8ac559532d8f8`.

## 작동 목표와 한계
- Google 로그인/OAuth/API 키가 필요 없다. 기기에 설치된 Google Drive를 Android 문서 제공자로 선택한다.
- 처음 사용하는 기기: 게임 **설정 → Google Drive 저장 → 새 저장 파일 만들기**, Drive의 원하는 폴더 선택.
- 다른 기기: 같은 구글 계정/Drive 제공자에서 **기존 저장 파일 연결**로 반드시 **동일한 파일**을 고른다. 같은 이름의 새 파일을 만들면 동기화되지 않는다.
- 최초 연결 이후에는 이 기기 localStorage + SharedPreferences가 우선인 자동 저장, Drive 파일은 최종적으로 맞추는 저장소.
- 앱 실행·복귀·온라인 복귀·'지금 동기화' 버튼에서 파일 읽고 비교. 평소 로컬 저장은 비동기 밀린 쓰기 큐로 Drive에 복사(읽기는 매 저장마다 하지 않음).
- 업로드/동기화에는 Drive 앱 자체의 지연 가능성이 있으므로 **실시간 멀티디바이스 동시 편집이 아님**. 한 기기 종료 후 다른 기기 실행을 목표로 한다.
- 파일 URI는 **기기별 Android 설정**에 보관. 두 기기에서 별도 최초 파일 선택이 필요하다. 오프라인은 기기 내부 저장으로 이어서 진행.

## 절대 규칙(골든퀘스트 이식)
- '마지막 저장 시각이 가장 최신인 데이터가 무조건 승리'하지 않는다. Drive와 비교할 때 마지막 공통 버전 `baseT`를 사용.
- `lt`: 로컬 유효 저장의 t, `rt`: Drive 유효 저장의 t, `bt`: 해당 기기가 Drive와 마지막으로 맞춘 t.
- `rt < 0`(손상·빈 파일)이고 로컬 유효 → 복구를 위해 로컬 내용을 Drive에 씀. **파일 읽기 자체 실패는 파일 수정 금지**.
- `lt < 0`, `rt >= 0` → Drive에서 가져옴.
- `lt == rt` → 그대로. Drive만 변경(`rt > bt` & `lt <= bt`) → Drive 가져옴.
- 이 기기만 변경(`lt > bt` & `rt <= bt`) → Drive 덮어쓰기.
- 둘 다 변경·기준 모름 → 사용자에게 '드라이브 진행으로 이어서 하기' / '이 기기 진행으로 파일 덮어쓰기' 선택창. **선택 중 쓰기·로컬 자동 저장 차단.**
- 사용자 선택 없이 충돌 저장을 덮어쓰지 않는다.
- 저장 중 연결 대기/복원 상태에서 게임이 자동 저장으로 이전 진행을 덮어쓰지 않도록 가드. 파일 적용 시 `t`를 다시 쓰거나 재생성하지 않는다.
- Drive 쓰기는 `wt` 방식이며 **중간에 임의 취소하지 않는다**. 실패 시 다음 기회 재시도.
- 파일을 처음 연결하면 `baseT=-1`. 양쪽 변화가 모두 있을 때는 항상 확인한다.

## 저장 형식
- 현재 본편/정화방에서 쓰는 `localStorage.gw_save_v1` 원본 JSON **그대로**.
- 새 저장이 일어날 때만 `t`(정수 밀리초 타임스탬프)를 추가. 이전 저장에서 `t` 없으면 0으로 취급. 복원 시 기존 `t` 불변.
- 클리어 `clr`, 대사 `seen`, 편성 `party`, 장비 `gear`, 장착 `eq`, 경험치 `heroXP`, 마성 `corrupt`, 폭주 `rampage`, 정화 대사 `purifyDialogue` 등이 이 한 파일에 포함.
- 음향 설정 `gw_audio_settings_v1` 등 모든 `gw_*` 문자열도 묶음으로 포함. 웹에서 사용하던 게임 저장 스키마는 변경하지 않는다.
- 백업 파일 이름: `gender_warfare_save.json` (동일 파일만 연동되면 파일명은 식별 목적).

## 추가 코드
- `game/save_sync.js`: 앱에서 조기 실행, 저장 키 묶음 검증/복원/네이티브 미러, 충돌 선택창, Drive 메뉴.
- `game/index.html`: `meta.js`보다 먼저 동기화 스크립트 로드.
- `game/audio_options.js`: 기존 설정창 안에 'Google Drive 저장' 메뉴. APK에서만 표시.
- `android/app/src/main/java/com/alix/genderwarfare/MainActivity.java`: Android SAF `ACTION_CREATE_DOCUMENT`/`ACTION_OPEN_DOCUMENT`, 읽기/쓰기 영구 권한, baseT 동기화, 저장 복구.
- `android/app/build.gradle`: 빌드 때 `../game` 안의 **전체 웹 리소스**를 APK assets로 복사. 정화방도 동일 오리진(/assets/)에서 실행되고 정화방 페이지에 저장 브리지 주입.
- `android/app/src/test/java/com/alix/genderwarfare/SaveSyncTest.java`: baseT 분기/형식/손상/타 게임 거부 검사.

## 테스트 상황 (2026-10-10)
- `game/save_sync.js`, `game/index.html` 인라인 JS, `game/meta.js`, `game/audio_options.js`: JS 구문 파싱 통과.
- 모의 WebView 테스트 11종 통과: 로컬-네이티브 선택, 초기 저장 차단/해제, 저장 미러링, 타임스탬프 단조 증가, gw_* 묶음 포함, 불러오기 시각 불변, 잘못된 파일 거부, 충돌 중 홀드/양자 택일 선택.
- Android Java 단위 테스트 파일은 작성됐지만 아직 **Gradle/JUnit 실실행 전**.
- Android APK 빌드, Google Drive 실기 파일 URI 권한, 폰↔태블릿 2기기 교차 저장, 오프라인 복귀/업로드 지연은 **실기 미검증**. 이를 통과하기 전 '최종 완료'라고 판단하면 안 됨.

## 실기 검수
1. 1번 기기에 APK 설치 → 게임 시작 → 설정 → Google Drive 저장 → 새 파일 만들기. 연결 상태 확인.
2. 스테이지 클리어·경험치·장비·정화방 마성 변화 후 정상 저장 확인.
3. 1번 기기 앱을 완전히 종료하고 Drive 업로드 완료를 기다림.
4. 2번 기기에 동일 패키지명 APK 설치 → 기존 저장 파일 연결 → 동일 진행 확인.
5. 2번 기기에서 진행 → 앱 종료 → 1번 기기 재실행 → 변경점 반영 확인.
6. 두 기기 모두 같은 baseT에서 별도 진행 후 순차 연결 → **충돌 선택창이 떠야 하며 자동 덮어쓰기 금지**.
7. 오프라인 플레이 → 온라인 복귀 → 자동 동기화. 느린/끊긴/깨진 Drive 파일과 UI 저장 홀드 테스트.
8. APK 덮어 설치 후 경험치·장비·마성 유지 확인(같은 패키지명 + 동일 서명 필요).

## 기존 브라우저 테스트 데이터 주의
현재 Chrome에서 로컬 HTML/개발 서버로 테스트하며 만든 localStorage는 APK WebView의 저장소와 다르다. **APK 설치만으로 예전 Chrome 진행이 자동 이전되지는 않는다.** 기존 Chrome 데이터를 유지하려면 추후 브라우저 내보내기→APK 가져오기 이관 절차 또는 처음부터 앱에서 플레이하는 방식을 선택해야 한다. 이 구현은 APK 설치 후 Android 기기 사이의 **동일 Drive 파일 공유** 기능을 다룬다.
