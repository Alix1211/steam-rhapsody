"""투명 배경 4포즈 시트(서서·앉아·장전·쓰러짐)를 잘라 game/h_<키>_<포즈>.webp 로 저장하고 META 한 줄을 출력한다.
사용: python3 tools/replace_hero_poses.py <시트.png> <영웅키> [기준 서서 높이=744]
후광(반투명 번짐)은 알파 240 미만을 걷어내 제거한다."""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sheet, key = sys.argv[1], sys.argv[2]
STAND_H = int(sys.argv[3]) if len(sys.argv) > 3 else 744
A = np.array(Image.open(sheet).convert('RGBA'))
alpha = A[:, :, 3].astype(np.uint8)
core = alpha >= 240
core = ndi.binary_opening(core, iterations=1)
# 한 포즈로 묶기: 크게 팽창해서 덩어리를 찾는다
glue = ndi.binary_dilation(core, iterations=4)
lab, n = ndi.label(glue)
objs = ndi.find_objects(lab)
cand = []
for i, sl in enumerate(objs, 1):
    area = int((core & (lab == i)).sum())
    if area > 6000:
        cand.append((area, i, sl))
cand.sort(key=lambda t: -t[0])
if len(cand) != 4:
    print('덩어리 수가', len(cand), '개 — 4개여야 합니다', [(a, s) for a, _, s in cand]); sys.exit(1)
# 위치로 포즈 배정: 가장 왼쪽=서서, 그 옆(위)=앉아, 오른쪽(위)=장전, 아래=쓰러짐
def cy(sl): return (sl[0].start + sl[0].stop) / 2
def cx(sl): return (sl[1].start + sl[1].stop) / 2
items = [(i, sl) for _, i, sl in cand]
down = max(items, key=lambda t: cy(t[1]))
rest = sorted([t for t in items if t is not down], key=lambda t: cx(t[1]))
poses = {'stand': rest[0], 'kneel': rest[1], 'reload': rest[2], 'down': down}
raw = {}
for q, (i, sl) in poses.items():
    m = ndi.binary_dilation(core & (lab == i), iterations=2)       # 가장자리 안티앨리어싱 살리기
    a = np.where(m, alpha, 0).astype(np.uint8)
    rgba = A.copy(); rgba[:, :, 3] = a
    ys, xs = np.where(a > 0)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    raw[q] = (Image.fromarray(rgba).crop(box), a[box[1]:box[3], box[0]:box[2]])
f = STAND_H / raw['stand'][0].height
meta = {}
for q, (im, a) in raw.items():
    w, h = round(im.width * f), round(im.height * f)
    out = im.resize((w, h), Image.LANCZOS)
    out.save(f'game/h_{key}_{q}.webp', quality=92, method=6)
    aa = np.array(out)[:, :, 3] > 40
    ys, xs = np.where(aa)
    if q in ('stand', 'kneel'):
        low = ys > h * 0.45
        ax = int(xs[low].mean()); mx = int(xs.max()); my = int(ys[xs >= xs.max() - 6].mean())
    elif q == 'reload':
        ax = int(xs.mean()); mx = ax; my = int(h * 0.4)
    else:
        ax = int(xs.mean()); mx = ax; my = int(h * 0.55)
    meta[q] = {"w": w, "h": h, "ax": ax, "mx": mx, "my": my}
print(json.dumps({key: meta}, ensure_ascii=False, separators=(',', ':')))
