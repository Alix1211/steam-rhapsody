# 오브제 시트(assets_src/sheets/obj_*.png)를 개별 스프라이트로 자르고 번호표를 만든다.  usage: slice_objs.py <name> [out_dir]
import sys,numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
name=sys.argv[1];out=sys.argv[2] if len(sys.argv)>2 else '/tmp/objs'
import os;os.makedirs(out,exist_ok=True)
im=Image.open('assets_src/sheets/obj_%s.png'%name).convert('RGBA');a=np.array(im)[...,3]
m=ndi.binary_dilation(a>60,iterations=1)
lab,n=ndi.label(m)
objs=ndi.find_objects(lab)
items=[]
for i,sl in enumerate(objs):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    if (x1-x0)<70 or (y1-y0)<60: continue
    items.append((y0//170*10000+x0,x0,y0,x1,y1))   # 행(대략) → 열 순
items.sort()
cs=[];rows=[]
for k,(_,x0,y0,x1,y1) in enumerate(items):
    sp=im.crop((x0,y0,x1,y1));sa=np.array(sp)
    mm=ndi.binary_dilation(a[y0:y1,x0:x1]>24,iterations=2)
    sa[...,3]=np.where(mm,sa[...,3],0);sp=Image.fromarray(sa)
    bb=sp.getbbox();sp=sp.crop(bb)
    sp.save('%s/%s_%02d.png'%(out,name,k))
    cs.append((k,sp))
# 번호표
pv=im.copy();bg=Image.new('RGBA',pv.size,(70,70,80,255));bg.alpha_composite(pv);d=ImageDraw.Draw(bg)
for k,(_,x0,y0,x1,y1) in enumerate(items):
    d.rectangle((x0,y0,x0+34,y0+22),fill=(0,0,0,220));d.text((x0+4,y0+4),str(k),fill=(255,255,0,255))
bg.convert('RGB').save('%s/%s_index.jpg'%(out,name),quality=80)
print(name,len(items))
