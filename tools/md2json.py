#!/usr/bin/env python3
"""scenario/*.md -> data/dialogue/*.json (스키마: data/SCHEMA.md). 사용: python3 tools/md2json.py"""
import re, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {'F1':'F1_harbor.md','F2':'F2_factory.md','F3':'F3_desert.md','F4':'F4_night.md','F5':'F5_plain.md',
         'M1':'M1_capital.md','M2':'M2_night.md','M3':'M3_sand.md','M4':'M4_cathedral.md','M5':'M5_lord.md','C11':'C11_demonrealm.md'}
SEC = {'전투 전':'before','클리어 후':'after','별 판정':'stars'}
def parse_line(s):
    s = s.strip()
    m = re.match(r'^- \*\*(.+?):\*\*\s*(.*)$', s)
    if m: return {'who': m.group(1), 'text': m.group(2)}
    m = re.match(r'^- (\(.*\))\s*$', s)
    if m: return {'who': '', 'kind': 'stage', 'text': m.group(1)}
    m = re.match(r'^- (.*)$', s)
    return {'who': '', 'kind': 'stage', 'text': m.group(1)} if m else None
def convert(code, fn):
    src = open(os.path.join(ROOT,'scenario',fn), encoding='utf-8').read().split('\n')
    title = re.search(r'「(.+?)」', src[0]); title = title.group(1) if title else code
    eps, cur, sec, reactions = [], None, None, {}
    in_react = False
    for ln in src:
        if ln.startswith('## 영웅 반응 풀'): in_react = True; cur = None; continue
        if ln.startswith('## 신규 가안'): in_react = False; cur = None; sec = None; continue
        if in_react:
            m = re.match(r'^- \*\*(.+?):\*\*\s*(.*)$', ln)
            if m: reactions[m.group(1)] = [x.strip() for x in m.group(2).split(' / ')]
            continue
        h = re.match(r'^## (?:[FM]?\d+-)?(\d+) 「(.+?)」\s*(\(보스\))?', ln) if ln.startswith('## ') else None
        if ln.startswith('## ') and not h and not ln.startswith('## 신규'):
            h = re.match(r'^## [FM]?\d+-(\d+) 「(.+?)」\s*(\(보스\))?', ln)
        if h:
            no = int(h.group(1)); boss = bool(h.group(3)) or no == 10
            cur = {'id': f'{code}-{no}', 'no': no, 'title': h.group(2), 'boss': boss, 'before': [], 'after': [], 'stars': {}}
            eps.append(cur); sec = None; continue
        m = re.match(r'^\*\*\[(.+?)\]\*\*', ln)
        if m and cur is not None: sec = SEC.get(m.group(1)); continue
        if cur is None or sec is None: continue
        if sec == 'stars':
            m = re.match(r'^- (★+) \*\*(.+?):\*\*\s*(.*)$', ln.strip())
            if m: cur['stars'][str(len(m.group(1)))] = {'who': m.group(2), 'text': m.group(3)}
        else:
            r = parse_line(ln)
            if r: cur[sec].append(r)
    out = {'chapter': code, 'title': title, 'line': 'male' if code.startswith('M') else ('demon' if code=='C11' else 'female'), 'episodes': eps}
    return out, reactions
def main():
    os.makedirs(os.path.join(ROOT,'data','dialogue'), exist_ok=True)
    bad = 0
    for code, fn in FILES.items():
        out, react = convert(code, fn)
        for e in out['episodes']:
            if not (e['before'] and e['after'] and len(e['stars'])==3): print('WARN', e['id'], len(e['before']), len(e['after']), len(e['stars'])); bad += 1
        if len(out['episodes']) != 10: print('WARN', code, 'episodes', len(out['episodes'])); bad += 1
        json.dump(out, open(os.path.join(ROOT,'data','dialogue',code+'.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
        if react: json.dump(react, open(os.path.join(ROOT,'data','dialogue','C11_reactions.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
        print(code, len(out['episodes']), 'episodes')
    print('OK' if not bad else f'{bad} warnings')
main()
