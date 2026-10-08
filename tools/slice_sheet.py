#!/usr/bin/env python3
"""시트 자동 분할: 알파 채널 연결요소로 조각을 찾아 번호 매겨 저장하고, 번호가 적힌 확인용 시트를 만든다.
사용: python3 tools/slice_sheet.py <시트.png> <출력폴더> [alpha_threshold=90] [dilate=6] [min_area=1500]
"""
import sys, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
thr = int(sys.argv[3]) if len(sys.argv) > 3 else 90
dil = int(sys.argv[4]) if len(sys.argv) > 4 else 6
mina = int(sys.argv[5]) if len(sys.argv) > 5 else 1500
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGBA'); a = np.array(im)
mask = a[..., 3] > thr
lab, n = ndi.label(ndi.binary_dilation(mask, iterations=dil))
objs = ndi.find_objects(lab)
items = []
for i, sl in enumerate(objs):
    ys, xs = sl
    area = (lab[sl] == i + 1).sum()
    if area < mina: continue
    items.append((ys.start, xs.start, ys.stop, xs.stop, i + 1))
# 위→아래, 왼→오 (행 단위 정렬)
items.sort(key=lambda r: (round(r[0] / 90), r[1]))
sheet = Image.new('RGBA', im.size, (40, 40, 48, 255)); d = ImageDraw.Draw(sheet)
meta = []
for k, (y0, x0, y1, x1, li) in enumerate(items):
    # 이 조각에 속하는 픽셀만 남긴다 (이웃 조각의 번짐 제거)
    m = (lab[y0:y1, x0:x1] == li)
    crop = a[y0:y1, x0:x1].copy(); crop[~m] = 0
    im2 = Image.fromarray(crop)
    bb = im2.getbbox()
    if bb: im2 = im2.crop(bb); x0 += bb[0]; y0 += bb[1]
    name = f'{k:02d}'
    im2.save(os.path.join(out, name + '.png'))
    sheet.alpha_composite(im2, (x0, y0)); d.text((x0 + 2, y0 + 2), name, fill=(255, 255, 0, 255))
    meta.append((name, x0, y0, im2.size))
sheet.convert('RGB').save(os.path.join(out, '_index.png'))
print(len(meta), 'pieces')
for m in meta: print(*m)
