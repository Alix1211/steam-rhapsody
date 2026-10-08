# 흰색 버튼 시트(assets_src/sheets/btn_white.png) → 후광 제거 + 국가별 색(여: 붉은 바탕/금빛, 남: 흑청 바탕/은청)으로 game/ui/btn_{F,M}_{1,2,3,fire,bomb}.webp
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
src=np.array(Image.open('assets_src/sheets/btn_white.png').convert('RGBA'))
al=np.pad(src[...,3].astype(float),200)
CX=[165,432,702,975,1275]; CY=360; HW=190
names=['1','2','3','fire','bomb']
TINT={'F':((246,212,140),(118,16,20)),'M':((190,214,255),(14,18,32))}
def clean(cx,cy):
    y0,x0=cy-HW+200,cx-HW+200; a=al[y0:y0+2*HW,x0:x0+2*HW].copy()
    lab,n=ndi.label(a>140)
    keep=np.zeros(a.shape,bool)
    for i in range(1,n+1):
        m=lab==i
        if m.sum()<40: continue
        yy,xx=np.nonzero(m)
        if np.hypot(yy.mean()-HW,xx.mean()-HW)<HW*0.62: keep|=m
    keep=ndi.binary_dilation(keep,iterations=3)
    ys,xs=np.nonzero(keep); bb=(xs.min(),ys.min(),xs.max(),ys.max())
    half=(bb[2]-bb[0]+bb[3]-bb[1])/4; ccx=(bb[0]+bb[2])/2; ccy=(bb[1]+bb[3])/2
    Y,X=np.mgrid[:a.shape[0],:a.shape[1]]; rr=np.hypot(X-ccx,Y-ccy)
    circ=rr<half*0.90
    out=np.where(circ|keep,a,0); out[out<30]=0
    fill=rr<half*0.84
    return out,fill,bb
for i,nm in enumerate(names):
    out,fill,bb=clean(CX[i],CY)
    x0,y0,x1,y1=bb; pad=6
    box=(max(0,x0-pad),max(0,y0-pad),min(2*HW,x1+pad),min(2*HW,y1+pad))
    for k,(rim,disc) in TINT.items():
        h,w=out.shape
        d=fill
        dl=Image.fromarray((d*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
        base=np.zeros((h,w,4),np.uint8);base[...,:3]=disc;base[...,3]=(np.array(dl)*0.9).astype(np.uint8)
        top=np.zeros((h,w,4),np.uint8);top[...,:3]=rim;top[...,3]=np.clip(out*1.1,0,255).astype(np.uint8)
        B=Image.fromarray(base);B.alpha_composite(Image.fromarray(top))
        B=B.crop(box);s=256/max(B.size);B=B.resize((max(1,round(B.width*s)),max(1,round(B.height*s))),Image.LANCZOS)
        B.save('game/ui/btn_%s_%s.webp'%(k,nm),quality=92)
# preview
pv=Image.new('RGBA',(5*270,2*270),(60,60,70,255))
for r,k in enumerate('FM'):
    for c,nm in enumerate(names):
        im=Image.open('game/ui/btn_%s_%s.webp'%(k,nm));pv.alpha_composite(im,(c*270+(256-im.width)//2,r*270+(256-im.height)//2))
pv.save('/tmp/claude-0/-home-claude-steam-rhapsody/1343940d-f912-5515-8df0-3c1be93ea743/scratchpad/shots/btn_pv.png')
