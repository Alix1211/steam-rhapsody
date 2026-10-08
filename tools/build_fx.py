# FX 시트(assets_src/fx_*.png)에서 폭발·불꽃·폭탄 스프라이트를 잘라 game/fx_*.webp 로 저장
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
J=[('fx_fire_explosions',dict(flame0=(110,200),flame1=(240,180),flame2=(430,170),flame3=(700,160),fan=(360,430),star=(190,630),cloud=(510,610),big=(1000,540),ray=(400,880),mush=(1070,860))),
   ('fx_projectiles_bombs',dict(gren=(1300,400),bomb=(1040,330)))]
for sh,pk in J:
    im=Image.open('assets_src/%s.png'%sh).convert('RGBA');a=np.array(im)[...,3]
    lab,n=ndi.label(ndi.binary_dilation(a>50,iterations=2));ob=ndi.find_objects(lab)
    for nm,(x,y) in pk.items():
        l=lab[y,x]
        if l==0:
            ys,xs=np.nonzero(lab);i=np.argmin((xs-x)**2+(ys-y)**2);l=lab[ys[i],xs[i]]
        sl=ob[l-1];b=(sl[1].start,sl[0].start,sl[1].stop,sl[0].stop)
        sp=np.array(im.crop(b));m=lab[b[1]:b[3],b[0]:b[2]]==l;sp[...,3]=np.where(ndi.binary_dilation(m,iterations=2),sp[...,3],0)
        sp=Image.fromarray(sp);sp=sp.crop(sp.getbbox());k=min(1,520/sp.width,520/sp.height)
        sp=sp.resize((max(1,round(sp.width*k)),max(1,round(sp.height*k))),Image.LANCZOS);sp.save('game/fx_%s.webp'%nm,quality=88);print(nm,sp.size)
