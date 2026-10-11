from pathlib import Path
import os,json,hashlib,zipfile
root=Path(__file__).resolve().parents[1]
media={};code=[]
for base in ['game','data']:
 for p in sorted((root/base).rglob('*')):
  if not p.is_file() or p.name=='bundled_media.json':continue
  name=p.relative_to(root/'game').as_posix() if base=='game' else p.relative_to(root).as_posix()
  if p.suffix.lower() in ['.html','.js','.json']:code.append((p,name))
  elif base=='game':media[name]=hashlib.sha256(p.read_bytes()).hexdigest()
version=os.environ.get('GITHUB_SHA','local')
manifest=json.dumps({'version':version,'media':media},separators=(',',':'))
with zipfile.ZipFile(root/'game-web.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,name in code:z.write(p,name)
 z.writestr('update.json',manifest)
(root/'game/bundled_media.json').write_text(manifest)
print('Web update:',len(code),'code files;',len(media),'media references;', (root/'game-web.zip').stat().st_size,'bytes')
