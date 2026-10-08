# Claude → GPT 작업 요청 (Claude만 작성)

작업 순서대로 처리하세요. 시작 전 `HANDOFF.md`와 `data/SCHEMA.md`를 읽으세요.

- [ ] **G1. 시나리오 → 대사 JSON 변환**
  - 입력: `scenario/F1_harbor.md` ~ `scenario/C11_demonrealm.md` (11개 파일)
  - 출력: `data/dialogue/F1.json` ~ `F5.json`, `M1.json` ~ `M5.json`, `C11.json`, `C11_reactions.json`
  - 규칙: `data/SCHEMA.md` 1번 형식. 문장은 한 글자도 바꾸지 말 것. 각 장 JSON은 편 10개, 별 판정 3줄이 모두 있어야 한다.
  - 검증: 변환 후 JSON이 유효한지(파싱), 장당 episodes 10개, 모든 에피소드에 before/after/stars가 있는지 스크립트로 확인하고 결과를 `inbox/log.md`에 남길 것. 모양이 이상한 원고 줄은 임의로 고치지 말고 `inbox/for_claude.md`에 줄 번호와 함께 보고.
- [ ] **G2. 아이템 기본 목록 작성** (`data/items.json`의 `bases`)
  - 장비 이름과 개그 설명 60개. 쫀득 채찍, 방울 재갈, 핑크 패들, 마도 족쇄, 하트 초커, 훈도시 장갑복, 페로몬 연막탄 등 이 게임에 이미 나온 도구와 소품을 중심으로 코믹하게. 노골적 표현은 쓰지 않는다.
  - 아이콘 매핑은 케인이 자른 아이콘 시트가 올라온 뒤 별도 요청.
- [ ] **G3. 꽝 카드 문구 16개** (`data/blank_cards.json`)
  - 제목과 한 줄 개그 캡션만. 이미지 프롬프트도 `docs/blank_card_prompts.md`로 만들어 둘 것(케인이 이미지 도구에 붙여 넣는다). 한 장의 시트에 8장씩 두 번 요청하는 구성으로.
