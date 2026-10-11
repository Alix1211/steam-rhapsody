#!/usr/bin/env python3
"""Slice the supplied demon pose sheets into runtime sprites (Pillow, scipy, numpy)."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,find_objects
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
REGIONS={
 'succubus':{0:(0,0,485,610),1:(485,0,980,610),3:(0,575,485,1086),4:(485,550,990,1086)},
 'incubus':{0:(0,0,485,605),1:(485,0,970,605),3:(0,575,485,1086),4:(485,550,970,1086)},
 'queen':{2:(0,490,520,1086),3:(520,490,1060,1086),4:(1060,470,1448,1086)}}
for species,regions in REGIONS.items():
 source=Image.open(ROOT/f'assets_src/sheets/demon_{species}.png').convert('RGBA')
 for pose,box in regions.items():
  image=source.crop(box);a=np.array(image);labs,n=label(a[:,:,3]>12);counts=np.bincount(labs.ravel());counts[0]=0;largest=int(counts.argmax());regions_cc=find_objects(labs);sy,sx=regions_cc[largest-1]
  keep=np.zeros(n+1,dtype=bool);keep[largest]=True
  for k,region in enumerate(regions_cc,1):
   if not region:continue
   yy,xx=region
   # Keep disconnected details within the body bounds, discard adjacent poses.
   if yy.start>=sy.start and yy.stop<=sy.stop and xx.start>=sx.start and xx.stop<=sx.stop:keep[k]=True
  a[:,:,3][~keep[labs]]=0;image=Image.fromarray(a);image=image.crop(image.getchannel('A').getbbox());image=image.resize((round(image.width*600/image.height),600),Image.Resampling.LANCZOS)
  image.save(ROOT/f'game/e_demon_{species}_{pose}.webp',quality=92,method=6)
print('Generated 11 transparent demon sprites')
