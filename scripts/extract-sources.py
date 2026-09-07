import pathlib,pdfplumber,json,re,hashlib,shutil
root=pathlib.Path(__file__).resolve().parents[1]; uploads=root.parent/'upload';out=root/'source-data';out.mkdir(exist_ok=True)
records=[];groups=[];pages=[]
original_names={1:'1-kurs(1).pdf',2:'2-kurs(1).pdf',3:'3-kurs(1)(1).pdf',4:'4-kurs(1).pdf'}
inputs=[(course,name,uploads/name if (uploads/name).exists() else out/f'course-{course}.pdf') for course,name in original_names.items()]
if any(not f.exists() for _,_,f in inputs):raise FileNotFoundError('All four source PDFs are required; existing JSON files were not changed.')
for course,original_name,f in inputs:
 if f.resolve()!=(out/f'course-{course}.pdf').resolve():shutil.copyfile(f,out/f'course-{course}.pdf')
 with pdfplumber.open(f) as pdf:
  for pi,page in enumerate(pdf.pages):
   table=page.find_tables()[0];rows=table.rows;values=table.extract();pages.append({'file':original_name,'page':pi+1,'headings':values[:2],'included':pi==0})
   if pi:continue
   headers=[]
   for j,cell in enumerate(rows[1].cells):
    if not cell:continue
    name=values[1][j] or ''
    if not re.match(r'^(ГРС|Тур|Кн|Мен|Пуа|Ек)\s',name):continue
    label=values[0][j]
    k=j
    while label is None and k>0:k-=1;label=values[0][k]
    label=' '.join((label or '').split())
    g={'id':f'g-{course}-{j}','name':name,'course':course,'specialty':label,'source':{'file':original_name,'page':1,'bbox':cell,'raw':name,'heading':label}}
    groups.append(g);headers.append((j,(cell[0]+cell[2])/2,g))
   daycells=sorted({tuple(r.cells[0]) for r in rows[2:] if r.cells[0]})
   daycells=sorted(daycells,key=lambda c:c[1]);days=['MON','TUE','WED','THU','FRI']
   paircells=[]
   for r in rows[2:]:
    cell=r.cells[1]
    if cell and tuple(cell) not in [c[0] for c in paircells]:
     text=page.crop(cell).extract_text() or '';m=re.search('[1-8]',text)
     if m:paircells.append((tuple(cell),int(m[0])))
   seen=set()
   for row in rows[2:]:
    for j,center,g in headers:
     cell=row.cells[j]
     if not cell or tuple(cell) in seen:continue
     seen.add(tuple(cell));raw=(page.within_bbox(cell).extract_text(x_tolerance=1,y_tolerance=.8) or '').strip()
     if not raw:continue
     gids=[gg['id'] for _,x,gg in headers if cell[0]-.1<=x<=cell[2]+.1]
     yc=(cell[1]+cell[3])/2
     di=next((n for n,d in enumerate(daycells) if d[1]<=yc<=d[3]),None)
     pair=next((n for c,n in paircells if c[1]-.1<=yc<=c[3]+.1),None)
     pc=next((c for c,n in paircells if c[1]-.1<=yc<=c[3]+.1),None)
     split=bool(pc and (cell[3]-cell[1]) < (pc[3]-pc[1])*.8)
     lines=raw.splitlines();teacher=None;subject=None;building=None;room=None
     # Accept a name only within this exact cell; no borrowing from neighbouring cells.
     tm=re.search(r'(?:доц\.|проф\.|ст\.?\s?в\.?|ас\.|в\.)\s*([А-ЯІЇЄҐ][а-яіїєґ\x27’\-]+)\s+([А-ЯІЇЄҐ])\.\s*([А-ЯІЇЄҐ])\.',raw)
     if tm:teacher=f'{tm[1]} {tm[2]}.{tm[3]}.';subject=raw[:tm.start()].strip().replace('\n',' ')
     elif 'Вакансія' in raw:subject=raw.split('Вакансія')[0].strip().replace('\n',' ')
     elif raw.startswith('Фізичне'):subject='Фізичне виховання'
     boundary_raw=page.crop(cell).extract_text(x_tolerance=1,y_tolerance=.8) or ''
     locations=list(re.finditer(r'\b(гк|карп|м|кр)\s+([0-9]+[а-яa-zА-ЯA-Z]?|зал)\b',boundary_raw))
     bm=locations[-1] if locations else None
     if bm:building=bm[1];room=bm[2]
     issues=[]
     if not subject:issues.append('Текст дисципліни/викладача потребує ручної перевірки')
     if not building:issues.append('Не визначено корпус/аудиторію')
     if building=='кр':issues.append('Скорочення «кр» потребує уточнення; це не «карп»')
     if split:issues.append('Частина пари: чергування тижнів/підгрупа не підтверджені')
     if 'Болотських' in raw and teacher is None:issues.append('Ініціали відсутні; не доповнювати')
     rid='src-'+hashlib.sha256((original_name+str(cell)).encode()).hexdigest()[:16]
     records.append({'id':rid,'file':original_name,'page':1,'bbox':cell,'raw':raw,'boundaryRaw':boundary_raw,'locationRaw':bm[0] if bm else None,'groups':gids,'weekday':days[di] if di is not None and di<5 else None,'pairNumber':pair,'splitCell':split,'subject':subject,'teacher':teacher,'building':building,'room':room,'issues':issues,'usableForSyntheticDemo':bool(subject and building and room and (teacher or 'Вакансія' in raw or subject=='Фізичне виховання'))})
(out/'groups.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2)+'\n')
(out/'schedule-cells.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
(out/'page-inventory.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n')
(out/'ambiguities.json').write_text(json.dumps([{'sourceId':r['id'],'file':r['file'],'page':r['page'],'raw':r['raw'],'issues':r['issues']} for r in records if r['issues']],ensure_ascii=False,indent=2)+'\n')
print('Groups:',len(groups),'Cells:',len(records),'Demo candidates:',sum(r['usableForSyntheticDemo'] for r in records))
for c in range(1,5):print(c,[g['name'] for g in groups if g['course']==c])
print('Teachers:',sorted(set(r['teacher'] for r in records if r['teacher'])))
