"""Extract the approved complete DOCX and explicit legacy row correspondence."""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
out = root / 'source-data/cs-beta'
doc = Path(sys.argv[1])
legacy_path = out / 'students-v1.json'
if not legacy_path.exists():
    shutil.copyfile(out / 'students.json', legacy_path)
legacy = json.loads(legacy_path.read_text(encoding='utf-8'))
groups = {g['name'].upper(): g['id'] for g in json.loads((root / 'source-data/groups.json').read_text(encoding='utf-8'))}
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(doc) as z:
    body = ET.fromstring(z.read('word/document.xml')).find('w:body', ns)
digest = hashlib.sha256(doc.read_bytes()).hexdigest()
rows, group, group_row, page = [], None, 0, 1
for paragraph_index, p in enumerate(body.findall('.//w:p', ns), 1):
    raw = ''.join(t.text or '' for t in p.findall('.//w:t', ns))
    page += len(p.findall('.//w:lastRenderedPageBreak', ns))
    value = raw.strip()
    if not value:
        continue
    if re.fullmatch(r'КН\s+[1-4]/[12]', value):
        group, group_row = re.sub(r'\s+', ' ', value), 0
        continue
    if not group:
        raise ValueError(f'Unexpected content before group: paragraph {paragraph_index}')
    group_row += 1
    old = [(i, s) for i, s in enumerate(legacy) if s['groupName'] == group]
    previous = old[group_row - 1] if group_row <= len(old) else None
    if previous and previous[1]['fullName'] != value:
        raise ValueError(f'Legacy row changed; explicit review required: {group} row {group_row}')
    rows.append(dict(groupName=group, groupId=groups[group], fullName=value,
        legacy=dict(index=previous[0], sha256=previous[1]['source']['sha256'], groupId=previous[1]['groupId'], fullName=previous[1]['fullName']) if previous else None,
        source=dict(file=doc.name, actualFile=doc.name, page=page, rawName=raw, paragraph=paragraph_index,
                    groupRow=group_row, pagination='Word saved lastRenderedPageBreak', sha256=digest)))
expected = {'КН 1/1': 17, 'КН 2/1': 30, 'КН 3/1': 20, 'КН 3/2': 21, 'КН 4/1': 40}
counts = {g: sum(s['groupName'] == g for s in rows) for g in expected}
assert counts == expected, counts
assert sum(bool(s['legacy']) for s in rows) == 58
shutil.copyfile(doc, out / doc.name)
(out / 'students.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(rows=len(rows), counts=counts, legacy=58, sha256=digest), ensure_ascii=False))
