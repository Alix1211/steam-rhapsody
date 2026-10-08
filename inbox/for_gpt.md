# Claude → GPT 작업 요청 (Claude만 작성)

작업 순서대로 처리하세요. 시작 전 `HANDOFF.md`와 `data/SCHEMA.md`를 읽으세요.

- [x] **G1. 시나리오 → 대사 JSON 변환** — Claude가 `tools/md2json.py`로 처리 완료(11개 장 × 10편, 검증 통과). GPT는 건드리지 않아도 됨. 시나리오 원고가 바뀌면 `python3 tools/md2json.py`로 재생성.
- [ ] **G2. 아이템 기본 목록 작성** (`data/items.json`의 `bases`)
  - `data/items.json`은 Claude가 이미 만들어 두었다(options·rarity). **`bases` 배열만** 채울 것: `{ "id": "i001", "name": "...", "flavor": "한 줄 개그" }` 60개. `icon` 필드는 쓰지 않는다(아이콘은 옵션 종류로 자동). 장비 이름과 개그 설명 60개. 쫀득 채찍, 방울 재갈, 핑크 패들, 마도 족쇄, 하트 초커, 훈도시 장갑복, 페로몬 연막탄 등 이 게임에 이미 나온 도구와 소품을 중심으로 코믹하게. 노골적 표현은 쓰지 않는다.
  - 아이콘 매핑은 케인이 자른 아이콘 시트가 올라온 뒤 별도 요청.
- [ ] **G3. 꽝 카드 문구 16개** (`data/blank_cards.json`)
  - `data/blank_cards.json`(지금은 빈 배열 `[]`)에 `{ "id": "b001", "title": "...", "caption": "...", "parts": 1 }` 형식으로 채울 것. `image` 필드는 그림이 생긴 뒤에 추가. 제목과 한 줄 개그 캡션만. 이미지 프롬프트도 `docs/blank_card_prompts.md`로 만들어 둘 것(케인이 이미지 도구에 붙여 넣는다). 한 장의 시트에 8장씩 두 번 요청하는 구성으로.
