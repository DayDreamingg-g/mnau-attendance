"""Extract only cells intersecting CS columns; keep bounding-box provenance.

Usage: python scripts/extract-cs-beta.py [directory containing supplied files]
The default directory is source-data/cs-beta. Never infer teachers from neighbours.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'source-data/cs-beta'
OUTPUT = ROOT / 'source-data/cs-beta'
OUTPUT.mkdir(parents=True, exist_ok=True)
groups = json.loads((ROOT / 'source-data/groups.json').read_text(encoding='utf-8'))
group_ids = {g['name'].upper(): g['id'] for g in groups}
cells = []
inventory = []
teacher_re = re.compile(r'(доц\.|проф\.|ст\.?\s?в\.?|ас\.?|в\.)\s*([А-ЯІЇЄҐ][а-яіїєґ\x27’\-]+)\s+([А-ЯІЇЄҐ])\.\s*([А-ЯІЇЄҐ])\.', re.I)
for course in range(1, 5):
    filename = f'{course}-kurs (1).pdf'
    with pdfplumber.open(INPUT / filename) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            matched = False
            for table in page.find_tables():
                rows, values = table.rows, table.extract()
                if len(rows) < 3:
                    continue
                headers = []
                for col, name in enumerate(values[1]):
                    if name and re.fullmatch(r'Кн\s+[1-4]/[12]', name, re.I):
                        bbox = rows[1].cells[col]
                        headers.append((col, (bbox[0] + bbox[2]) / 2, group_ids[name.upper()]))
                if not headers:
                    continue
                matched = True
                days = sorted({tuple(row.cells[0]) for row in rows if row.cells[0] and row.cells[0][3]-row.cells[0][1] > 50}, key=lambda b: b[1])
                assert len(days) == 5, (filename, days)
                pairs = {}
                for row in rows[2:]:
                    bbox = row.cells[1]
                    match = re.search(r'\b[1-8]\b', page.crop(bbox).extract_text() or '') if bbox else None
                    if match:
                        pairs[tuple(bbox)] = int(match[0])
                seen = set()
                for row in rows[2:]:
                    for col, x_center, _ in headers:
                        bbox = next((b for b in row.cells if b and b[0] <= x_center <= b[2]), None)
                        if not bbox or bbox in seen:
                            continue
                        seen.add(bbox)
                        # Glyphs straddle borders. Assign each glyph by its centre once.
                        selected = page.filter(lambda obj: obj.get('object_type') == 'char' and
                            bbox[0] <= (obj['x0']+obj['x1'])/2 < bbox[2] and
                            bbox[1] <= (obj['top']+obj['bottom'])/2 < bbox[3])
                        raw = (selected.extract_text(x_tolerance=1, y_tolerance=.8) or '').strip()
                        if not raw:
                            continue
                        centre = (bbox[1] + bbox[3]) / 2
                        day = next(i for i, box in enumerate(days) if box[1] <= centre <= box[3])
                        pair_box, pair = next((box, number) for box, number in pairs.items() if box[1] <= centre <= box[3])
                        split = bbox[3] - bbox[1] < .8 * (pair_box[3] - pair_box[1])
                        teacher = teacher_re.search(raw)
                        unnamed = re.search(r'(ст\.?\s?в\.?)\s+([А-ЯІЇЄҐ][а-яіїєґ\x27’\-]+)(?=\n|$)', raw) if not teacher else None
                        title = teacher.group(1) if teacher else None
                        if unnamed:
                            title = 'ст.в.'
                        if title == 'ас':
                            title = 'ас.'
                        if title and re.fullmatch(r'ст\.?\s?в\.?', title):
                            title = 'ст.в.'
                        name = f'{teacher[2]} {teacher[3]}.{teacher[4]}.' if teacher else unnamed[2] if unnamed else None
                        subject = raw[:(teacher or unnamed).start()].strip().replace('\n', ' ') if (teacher or unnamed) else raw.split('Вакансія')[0].strip().replace('\n', ' ') if 'Вакансія' in raw else None
                        if raw.startswith('Фізичне') and not subject:
                            subject = 'Фізичне виховання'
                        # Location text often touches the cell border. Restrict extraction to this box.
                        boundary = page.crop(bbox).extract_text(x_tolerance=1, y_tolerance=.8) or ''
                        location_text = raw
                        locations = list(re.finditer(r'\b(гнк|нк\s*[0-9]+|гк|карп|м|кр)\s*[, ]*\s*(?:ауд\.?\s*)?([0-9]+(?:/[0-9]+)?[а-яa-zА-ЯA-Z]?|зал)\b', location_text))
                        location = locations[-1] if locations else None
                        issues = []
                        if unnamed:
                            issues.append('Ініціали викладача відсутні саме у цій спільній КН-клітинці; не запозичені з сусідньої.')
                        if split:
                            issues.append('Поділ клітинки: шаблон тижнів/підгруп не підтверджений; потрібне явне рішення перед генерацією.')
                        if not subject:
                            issues.append('Дисципліна потребує перевірки.')
                        if not location:
                            issues.append('Корпус/аудиторія не вказані.')
                        box = [round(n, 3) for n in bbox]
                        source_id = 'cs-src-' + hashlib.sha256(f'{filename}:{page_no}:{box}'.encode()).hexdigest()[:16]
                        original_name, original_display = name, f'{title} {name}' if name else None
                        # Identity resolutions explicitly supplied by the project owner on 2026-09-13.
                        if name == 'Пархоменко А.Ю.':
                            name, title = 'Пархоменко О.Ю.', 'доц.'
                        if name in ['Богатенкова О.Є.', 'Богатєнкова О.Є.']:
                            name, title = 'Богатєнкова О.Є.', 'ст.в.'
                        cells.append(dict(id=source_id, file=filename, page=page_no, bbox=box, raw=raw,
                            boundaryRaw=boundary, groups=[g for _, x, g in headers if bbox[0] <= x <= bbox[2]],
                            weekday=['MON', 'TUE', 'WED', 'THU', 'FRI'][day], pairNumber=pair,
                            splitCell=split, splitPart=('upper' if centre < (pair_box[1]+pair_box[3])/2 else 'lower') if split else None,
                            subject=subject, teacher=name, teacherDisplayName=f'{title} {name}' if name else None,
                            originalTeacher=original_name, originalTeacherDisplayName=original_display,
                            identityResolution='User confirmed 2026-09-13' if name != original_name or original_display != (f'{title} {name}' if name else None) else None,
                            weekType=('NUMERATOR' if centre < (pair_box[1]+pair_box[3])/2 else 'DENOMINATOR') if split else 'EVERY_WEEK',
                            building=location[1] if location else None, room=location[2] if location else None,
                            issues=[i for i in issues if not i.startswith('Поділ клітинки')], usableForSyntheticDemo=bool(subject and location),
                            sourceCell=f'p{page_no}:[{",".join(map(str,box))}]'))
            inventory.append(dict(file=filename, page=page_no, containsCS=matched))

# Use Word's saved pagination markers, not guessed group-per-page assignments.
actual_docx = next((INPUT / name for name in ['Списки груп.docx', 'Списки груп(1).docx'] if (INPUT / name).exists()))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(actual_docx) as archive:
    body = ET.fromstring(archive.read('word/document.xml')).find('w:body', ns)
students, page_no, current_group = [], 1, None
for paragraph in body.findall('w:p', ns):
    raw = ''.join(t.text or '' for t in paragraph.findall('.//w:t', ns))
    breaks = len(paragraph.findall('.//w:lastRenderedPageBreak', ns))
    # Word stores these at the start of the first paragraph on the next page.
    page_no += breaks
    if re.fullmatch(r'КН [13]/[12]', raw.strip()):
        current_group = raw.strip()
    elif raw.strip():
        assert current_group, raw
        students.append(dict(groupName=current_group, groupId=group_ids[current_group], fullName=raw.strip(),
            source=dict(file='Списки груп(1).docx', actualFile=actual_docx.name, page=page_no, rawName=raw,
                        pagination='Word saved lastRenderedPageBreak', sha256=hashlib.sha256(actual_docx.read_bytes()).hexdigest())))
expected = {'КН 1/1': 17, 'КН 3/1': 20, 'КН 3/2': 21}
assert {g: sum(s['groupName'] == g for s in students) for g in expected} == expected
for name, value in [('schedule-cells.json', cells), ('students.json', students), ('page-inventory.json', inventory)]:
    (OUTPUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'students': expected, 'cells': len(cells), 'teachers': sorted({c['teacherDisplayName'] for c in cells if c['teacher']}), 'splitCells': sum(c['splitCell'] for c in cells)}, ensure_ascii=False, indent=2))
