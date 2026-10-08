# 이미지 에셋 경로 정리 (2026-10-08 기준)

규칙: **게임이 읽는 파일은 `game/`**, **원본 시트(큰 그림)는 `assets_src/`**. 게임용 파일은 원본에서 `tools/`의 스크립트로 잘라 만든다. 파일은 옮기지 않았고, 이 문서는 목록만 정리한 것이다.

## 1. 게임이 읽는 파일 (`game/`)

| 종류 | 경로 | 개수 | 이름 규칙 / 비고 |
|---|---|---|---|
| 전투 배경 | `game/bg2.jpg`, `bg_F2~F5.jpg`, `bg_M1~M4.jpg`, `bg_C.jpg` | 10 (+`bg.jpg` 메뉴용) | 장 연결은 `meta.js`의 `BGMAP` (F1=bg2, M5=bg_M1 가안, 11장=bg_C) |
| 영웅 포즈 | `game/h_<영웅키>_<포즈>.webp` | 16명×4포즈 | 포즈: stand(서서)·kneel(앉아)·reload(장전)·down(쓰러짐). 키: human goblin dwarf harpy elf lamia fox fmedic / mhuman mwolf mdwarf morc melf mlizard mmedic mgoblin |
| 영웅 얼굴 | `game/h_<영웅키>_face.webp` | 16 | 파티 편성·대화 |
| 적(여성국) | `game/e_kn_*.png`(보병 stand1·2, kneel1·2, fire, hit), `e_mech_*.png`(golem, golem2, spider, gun, shield) | 11 | gun·shield = 드론 |
| 적(남성국) | `game/e_wk_*.png`(보병), `e_wm_*.png`(golem, golem2, spider, gun, wing) | 11 | gun·wing = 드론 |
| 엄폐물(장별 오브제) | `game/c_oc_<시트>_<번호>.webp` | 114 | `tools/build_covers.py`가 생성, 장 연결·폭발물 표시는 `game/csets.js` |
| 엄폐물(구형) | `game/c_barrels, crate_large, crate_sandbag, crate_small, crate_stack, sandbag, wreck_crate, wreck_fence, wreck_stack.webp` | 9 | 오브제 세트가 없을 때의 예비. `wreck_fence`는 현재 미사용 |
| FX | `game/fx_*.webp` | 12 | big·cloud·ray·mush·star(폭발), flame0~3·fan(불), gren·bomb(폭탄) — `tools/build_fx.py` |
| UI 부품 | `game/ui/*.webp` | 145 | 아래 2번 참고. 좌표 정보는 `game/ui/atlas.json` |
| 구형 임시 그림 | `game/char1.png`(영웅 대체 그림), `char2·3.png`, `human_*.png`, `dwarf_*.png`, `elf_*.png`(구 4포즈) | — | `char1`만 참조, 나머지는 미사용(정리 후보) |

### UI 부품 (`game/ui/`) 이름 규칙
- `btn_F_{1,2,3,fire,bomb}.webp`, `btn_M_…` — 전투 버튼(여성국 붉은색 / 남성국 흑청색), `tools/build_btn.py`
- `rt_{ar,sg,snipe,burst}.webp` — 무기별 조준선, `ret00~23.webp` — 조준선 24종 원본(번호표 `docs/reticle_index.png`)
- `num1~4`, `ic_*`(아이콘), `badge_*`(옵션 배지), `gem00~16`(보석), `plate_*`·`ring_*`·`bar_*`(프레임), `arrow_*`·`chev_*`·`ok_*`·`minus_*`·`plus`·`x_*`·`menu_*`·`home_*`·`bag_*`·`gear_*`(버튼류)
- `logo.webp`(타이틀 로고), `keyart.webp`(메인 키아트)

## 2. 원본 시트 (`assets_src/`)

| 경로 | 내용 | 만든 결과물 |
|---|---|---|
| `assets_src/sheets/obj_{F_a, F_desert, F_factory, F_night, M_a, M_b, M_slum, demon, gear_steel}.png` | 엄폐물·소품 시트 9장 | `game/c_oc_*` + `csets.js` |
| `assets_src/sheets/btn_white.png` / `btn_color_ref.png` | 흰 버튼 시트 / 색 참고용 | `game/ui/btn_*` |
| `assets_src/sheets/demon_{queen, incubus, succubus}.png` | 마계 적 시트 | **미적용** |
| `assets_src/sheets/hero_elf_fixed.png` | 엘프 4포즈 교체본 | `game/h_elf_*` |
| `assets_src/fx_{fire_explosions, projectiles_bombs}.png` | 불·폭발·폭탄 | `game/fx_*` |
| `assets_src/fx_{lightning_fire_ice, magic_circles_orbs}.png` | 번개·얼음·마법진 | **미적용** |
| `assets_src/ui_frames_and_badges.png`, `ui_icons_buttons.png` | UI 프레임·배지·아이콘 | `game/ui/*` |
| `assets_src/reticles_sheet.png`, `reticles_4types.png` | 조준선 시트 | `game/ui/ret*`, `rt_*` |
| `assets_src/title_logo_gender_warfare.png`, `keyart_main_screen.png` | 로고·키아트 | `game/ui/logo`, `keyart` |
| `assets_src/scope_blur_issue.png` | 조준경 흐림 문제 스크린샷(참고용) | — |

## 3. 정리 후보 (케인 확인 후 처리)
- 구형 임시 그림: `game/char2.png`, `char3.png`, `human_*.png`, `dwarf_*.png`, `elf_*.png` (미사용).
- 구형 엄폐물 9종은 오브제 세트 적용 후 예비용으로만 남음.
- `game/` 폴더가 평평해서 파일이 많다. 폴더로 나누려면 코드의 불러오기 경로를 함께 바꿔야 하므로, 진행하려면 "폴더 정리해" 라고 말해 주면 한 번에 처리한다.
