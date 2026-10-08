#!/usr/bin/env python3
"""assets_src 시트 → game/ui/*.webp 조각 + game/ui/atlas.json.
 python3 tools/build_ui_assets.py [확인시트_출력경로.png]
- 연결요소로 조각을 찾고, 서로 붙은 조각(가로로 긴 것)은 알파 골짜기에서 나눈다.
- 이름은 시트 안 위치(행 → 왼쪽부터 순서)로 붙인다. 시트 원본이 바뀌면 NAMES 표를 점검할 것.
"""
import sys, os, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src'); OUT = os.path.join(ROOT, 'game', 'ui')
os.makedirs(OUT, exist_ok=True)

def pieces(path, thr, dil, mina, split=False):
    im = Image.open(path).convert('RGBA'); a = np.array(im)
    lab, n = ndi.label(ndi.binary_dilation(a[..., 3] > thr, iterations=dil))
    res = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if (lab[sl] == i + 1).sum() < mina: continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        m = lab[sl] == i + 1
        crop = a[sl].copy(); crop[~m] = 0
        parts = [(0, crop.shape[1])]
        w, h = crop.shape[1], crop.shape[0]
        if split and w / h > 1.45 and h >= 140:
            k = round(w / h); col = crop[..., 3].astype(float).sum(0); cuts = [0]
            for j in range(1, k):
                c = int(j * w / k); win = int(w / k * 0.3)
                cuts.append(c - win + int(np.argmin(col[c - win:c + win])))
            cuts.append(w); parts = list(zip(cuts[:-1], cuts[1:]))
        if split and h / w > 1.4 and w >= 150:     # 위아래로 붙은 조각(고리 + 번호 배지)
            row = crop[..., 3].astype(float).sum(1); c = h // 2; win = h // 4; cut = c - win + int(np.argmin(row[c - win:c + win]))
            for (q0, q1) in ((0, cut), (cut, h)):
                img = Image.fromarray(crop[q0:q1]); bb = img.getbbox()
                if bb: img = img.crop(bb); res.append((y0 + q0 + bb[1], x0 + bb[0], img))
            continue
        for (p0, p1) in parts:
            sub = crop[:, p0:p1]; img = Image.fromarray(sub); bb = img.getbbox()
            if not bb: continue
            img = img.crop(bb); res.append((y0 + bb[1], x0 + p0 + bb[0], img))
    return res

def rows(ps, tol=70):
    ps = sorted(ps, key=lambda r: r[0] + r[2].size[1] / 2)
    out = []; cur = []; cy = None
    for p in ps:
        c = p[0] + p[2].size[1] / 2
        if cy is None or abs(c - cy) <= tol: cur.append(p); cy = c if cy is None else (cy * (len(cur) - 1) + c) / len(cur)
        else: out.append(sorted(cur, key=lambda r: r[1])); cur = [p]; cy = c
    if cur: out.append(sorted(cur, key=lambda r: r[1]))
    return out

atlas = {}
def save(name, img):
    img.save(os.path.join(OUT, name + '.webp'), quality=92, method=6); atlas[name] = list(img.size)

# ---- 프레임/배지 시트 (행 단위 순서가 아니라 y 위치 기준 정렬이 불안정해서 좌표 순서로 직접 고정) ----
FR = ['bar_long', 'bar_red_r', 'plate_dark_wide', 'plate_parch_wide', 'plate_dark_a', 'plate_dark_round', 'plate_parch_a', 'plate_red_a',
      'bar_red_l', 'plate_parch_b', 'plate_dark_pt', 'plate_dark_s', 'plate_parch_s', 'plate_dark_orn', 'plate_parch_laurel', 'plate_wings', 'plate_dark_gear',
      'badge_atk', 'badge_eva', 'badge_rel', 'badge_flame', 'badge_heal', 'badge_hand', 'badge_bag', 'badge_grenade', 'badge_wings', 'badge_gear']
fp = pieces(os.path.join(SRC, 'ui_frames_and_badges.png'), 90, 4, 1500)
fp.sort(key=lambda r: (round(r[0] / 90), r[1]))
assert len(fp) == len(FR), ('frames', len(fp))
for nm, (y, x, im) in zip(FR, fp): save(nm, im)

# ---- 아이콘/버튼 시트: 행별로 왼쪽부터 ----
IC = [
 ['arrow_l_big', 'arrow_l_md', 'arrow_l_sm', 'arrow_l_bar', 'arrow_r_big', 'arrow_r_md', 'arrow_r_gear', 'arrow_r_sm', 'arrow_r_bar'],
 ['x_big', 'x_sm', 'ok_big', 'ok_sm', 'plus', 'minus_sm', 'minus_big', 'minus_sm2'],
 ['gear_big', 'gear_sm', 'bag_big', 'bag_sm', 'home_big', 'home_sm', 'menu_big', 'menu_sm', 'chev_l', 'chev_r'],
 ['ic_aim', 'ic_lock', 'ic_bullets', 'ic_mag', 'ic_grenade', 'ic_shield', 'ic_warn', 'ic_timer', 'ic_star', 'ic_excl'],
 ['ic_chat', 'ic_bolt', 'ic_flame', 'ic_cross', 'ic_wings', 'ic_wings_big', 'ring_parch', 'ring_dark_laurel', 'ring_red_laurel'],
 ['ring_dark_big', 'ring_dark_gear', 'ring_parch_big', 'ring_red', 'ring_dark', 'ring_dark_s1', 'ring_dark_s2', 'ring_dark_s3', 'ring_dark_s4', 'ring_dark_s5', 'ring_dark_s6'],
 ['num1', 'num2', 'num3', 'num4'],
]
ip = pieces(os.path.join(SRC, 'ui_icons_buttons.png'), 180, 1, 300, split=True)
big = [p for p in ip if p[0] < 1060 and not (p[0] >= 935 and p[1] > 830)]          # 아래 오른쪽 보석·장식은 따로
gems = [p for p in ip if p[0] >= 935 and p[1] > 830]
rr = rows(big)
if len(rr) != len(IC) or any(len(a) != len(b) for a, b in zip(rr, IC)):
    print('행 구성 불일치:', [len(r) for r in rr], '기대:', [len(r) for r in IC]); sys.exit(1)
for names, row in zip(IC, rr):
    for nm, (y, x, im) in zip(names, row): save(nm, im)
gems.sort(key=lambda r: (round(r[0] / 40), r[1]))
for i, (y, x, im) in enumerate(gems): save('gem%02d' % i, im)

# ---- 로고 / 키아트 ----
lg = Image.open(os.path.join(SRC, 'title_logo_gender_warfare.png')).convert('RGBA'); lg = lg.crop(lg.getbbox())
lg.thumbnail((1000, 1000)); save('logo', lg)
ka = Image.open(os.path.join(SRC, 'keyart_main_screen.png')).convert('RGB')
ka.save(os.path.join(OUT, 'keyart.webp'), quality=84, method=6); atlas['keyart'] = list(ka.size)
json.dump(atlas, open(os.path.join(OUT, 'atlas.json'), 'w'), indent=0)
print(len(atlas), 'sprites saved to', OUT)
if len(sys.argv) > 1:
    sheet = Image.new('RGBA', (1500, 1500), (36, 36, 44, 255)); d = ImageDraw.Draw(sheet); x = y = 4; rh = 0
    for nm in atlas:
        if nm in ('keyart', 'logo'): continue
        im = Image.open(os.path.join(OUT, nm + '.webp')).convert('RGBA'); s = min(1, 150 / max(im.size)); im = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))))
        if x + im.size[0] > 1496: x = 4; y += rh + 16; rh = 0
        sheet.alpha_composite(im, (x, y)); d.text((x, y + im.size[1] + 1), nm, fill=(255, 255, 0, 255)); x += max(im.size[0], 70) + 6; rh = max(rh, im.size[1])
    sheet.convert('RGB').crop((0, 0, 1500, y + rh + 20)).save(sys.argv[1])
