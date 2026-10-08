# 데이터 스키마 v1 (Claude 관리 — 변경 금지, 필요하면 for_claude.md에 요청)

## 1. 대사: `data/dialogue/{chapterId}.json`
chapterId: `F1`~`F5`(여성국), `M1`~`M5`(남성국), `C11`(마계).
원본: `scenario/*.md`. 변환 시 문장 내용은 한 글자도 바꾸지 않는다.

```json
{
  "chapter": "F1",
  "title": "항만 탈환",
  "line": "female",
  "episodes": [
    {
      "id": "F1-1",
      "no": 1,
      "title": "부두의 첫 정화",
      "boss": false,
      "before": [ { "who": "클레어", "text": "남부 항구가..." }, { "who": "", "kind": "stage", "text": "(스코프를 들여다보며) ..." } ],
      "after":  [ { "who": "아네트", "text": "포획 32명..." } ],
      "stars": { "3": { "who": "아네트", "text": "..." }, "2": { "who": "아네트", "text": "..." }, "1": { "who": "아네트", "text": "..." } }
    }
  ]
}
```
- `who`: 화자 이름 그대로(클레어, 그레타, 실비아, 아네트, 톰, 렌, 카이단, 그로크, 이그니스, 베르단, 코그, 루시안, 로제, 핀, 벨루가, 자하라 등). NPC도 이름 그대로.
- 지문/화면 밖 소리(`(화면 밖: ...)`, `(...)`로만 이루어진 줄)는 `"who": ""`, `"kind": "stage"`.
- 대사 줄 앞의 `(연출)` 접두는 `text` 앞에 그대로 둔다.
- 에피소드 제목의 「」는 제거하고 `title`에 넣는다. `boss`는 각 장 10번째만 true.
- 파일 끝 "신규 가안 목록"은 JSON에 넣지 않는다(원고에만 남김).
- 11장 끝 "영웅 반응 풀"은 `data/dialogue/C11_reactions.json`에 `{ "클레어": ["...","..."], ... }` 형식으로 따로 만든다.

## 2. 아이템 (설계 확정 전 가안): `data/items.json`
```json
{
  "options": [
    { "id": "atk", "name": "공격력", "unit": "%", "min": 5, "max": 25 },
    { "id": "aim", "name": "조준", "unit": "pt", "min": 5, "max": 20 },
    { "id": "eva", "name": "회피", "unit": "%", "min": 3, "max": 15 },
    { "id": "def", "name": "방어", "unit": "%", "min": 3, "max": 15 },
    { "id": "auto", "name": "자동조준", "unit": "%", "min": 5, "max": 20 },
    { "id": "reload", "name": "장전", "unit": "%", "min": 5, "max": 25 },
    { "id": "mag", "name": "탄창", "unit": "%", "min": 10, "max": 30 },
    { "id": "crit", "name": "치명타", "unit": "%", "min": 3, "max": 15 },
    { "id": "heal", "name": "회복력", "unit": "%", "min": 5, "max": 25 },
    { "id": "cover", "name": "엄폐물 내구", "unit": "%", "min": 10, "max": 40 }
  ],
  "rarity": { "common": 1, "rare": 2, "myth": 3, "legend": 4 },
  "bases": [
    { "id": "i001", "name": "쫀득 채찍", "icon": "(아이콘 파일 또는 시트 좌표)", "flavor": "한 줄 개그 설명" }
  ]
}
```
- 장비는 영웅 1명당 1개 착용. 등급별 옵션 개수는 위 `rarity` 값.
- 옵션 수치 범위는 임시값이며 Claude가 밸런스 시 조정한다.
- `bases`의 `name`과 `flavor`는 GPT가 작성(코믹 톤, 노골 표현 금지).

## 3. 꽝 카드: `data/blank_cards.json` (가안)
```json
[ { "id": "b001", "title": "꽝 카드 제목", "caption": "한 줄 개그", "image": "blank_001.webp", "parts": 1 } ]
```
`parts`는 분해 부품 보상(1~2).
