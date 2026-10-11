from pathlib import Path
from PIL import Image
import json,re
root=Path(__file__).resolve().parents[1];a=root/'assets_src/mission_pack';g=root/'game'
for faction,y in [('F',0),('M',1)]:
 im=Image.open(a/'facilities_FM.png')
 for x,name in enumerate(['lever','control','generator','capsule','lock']):
  box=(round(x*im.width/5),round(y*im.height/2),round((x+1)*im.width/5),round((y+1)*im.height/2))
  crop=im.crop(box);crop.thumbnail((360,360));crop.save(g/f'e_mission_{name}_{faction}.png')
 Image.open(a/f'hangar_{faction}.png').save(g/f'hangar_{faction}.webp',quality=88)
im=Image.open(a/'mecha_parts_states.png')
for y,state in enumerate(['normal','broken']):
 for x,name in enumerate(['turret','cooler','core']):
  crop=im.crop((x*im.width//3,y*im.height//2,(x+1)*im.width//3,(y+1)*im.height//2));crop.thumbnail((420,420));crop.save(g/f'e_mission_{name}_{state}.png')
rows=[]
for line in (root/'docs/mission_structure_draft.md').read_text().splitlines():
 if not re.match(r'\| (?:F|M|C11)\d*?-\d+ \|',line):continue
 cells=[c.strip() for c in line.split('|')[1:-1]];id,title,typ,flow,party=cells
 mode='normal';duration=0;targets=[];hangar=False
 if typ in ['포획·철수','포획·이송','포획전']:mode='capture';duration=55;targets=['lock']
 elif typ in ['상담소 보호','시설 엄호','시장 보호','배급소 방어','전야·단기 방어','교섭·방어','정보 확보']:mode='protect';duration={'상담소 보호':90,'시설 엄호':100,'시장 보호':150,'배급소 방어':150,'전야·단기 방어':60,'교섭·방어':90,'정보 확보':90}[typ]
 elif typ=='200초 방어':mode='survive';duration=200
 elif typ=='공병 메카 보호':mode='engineer';duration=160;hangar=True;targets=['core']
 elif typ=='포로 위치 확인·철수':mode='rescue';duration=60;targets=['control'];hangar=True
 elif typ=='합류·지원':mode='protect';duration=90;hangar=True
 elif typ in ['시설 정지','보급대 저지','함정 탈출','보급 확보','면담로 개방','코어 접근']:mode='destroy';duration=180;targets={'시설 정지':['lever'],'보급대 저지':['control'],'함정 탈출':['control'],'보급 확보':['capsule']*3,'면담로 개방':['control'],'코어 접근':['generator']*2}[typ]
 elif typ in ['갑주 해체','상륙함 저지','타이탄 결전','장갑 열차 저지','모함 저지','전차 해체','전차 저지','도시 방어','요새 공략','사령관 기체 결전','최종 결전']:mode='boss';duration=240;targets=['cooler','core','turret'] if typ in ['타이탄 결전','요새 공략','사령관 기체 결전'] else ['turret','core'];hangar=typ in ['갑주 해체','타이탄 결전','요새 공략','사령관 기체 결전']
 if id=='F3-10':duration=200
 required=['mmedic','mhuman','mwolf'] if id=='F4-3' else ['melf'] if id=='M5-8' else []
 forbidden={'F1-5':'mmedic','F1-7':'mhuman','F3-4':'mwolf','F4-5':'morc','M1-5':'fox','M1-7':'goblin','M3-4':'harpy','M4-5':'lamia'}.get(id)
 rows.append(dict(id=id,title=title,label=typ,mode=mode,duration=duration,targets=targets,hangar=hangar,required=required,forbidden=forbidden,mixed=id=='C11-1',mid=typ!='섬멸·짧은 사건',flow=flow))
assert len(rows)==110
(root/'data/combat_missions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
(g/'mission_data.js').write_text('window.GW_MISSION_DATA='+json.dumps({r['id']:r for r in rows},ensure_ascii=False,separators=(',',':'))+';\n')
print('110 mission records, 16 target sprites and 2 hangars prepared')
