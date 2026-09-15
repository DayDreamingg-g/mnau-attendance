export const positions={UNSPECIFIED:'Не вказано',ASSISTANT:'Асистент',SENIOR_LECTURER:'Старший викладач',DOCENT:'Доцент',PROFESSOR:'Професор'} as const;
export type Position=keyof typeof positions;
const prefixes:[RegExp,Position][]=[
  [/^ст\.?\s*в\.\s*/iu,'SENIOR_LECTURER'],
  [/^доц\.\s*/iu,'DOCENT'],[/^проф\.\s*/iu,'PROFESSOR'],[/^ас\.\s*/iu,'ASSISTANT'],
];
/** Presentation only. Never use this name as a database identity or source key. */
export function teacherIdentity(rawName:string,storedPosition?:string|null){
  let name=rawName.trim().replace(/ · (?:beta|DEMO)$/iu,' · TEST'),inferred:Position='UNSPECIFIED';
  for(const [prefix,position] of prefixes){if(prefix.test(name)){name=name.replace(prefix,'').trim();inferred=position;break;}}
  if(/^Пархоменко\s+[ОOАA]\.\s*Ю\.\s*$/iu.test(name))name='Пархоменко О.Ю.';
  const position=storedPosition&&storedPosition!=='UNSPECIFIED'&&Object.hasOwn(positions,storedPosition)?storedPosition as Position:inferred;
  return {name,position,positionLabel:position==='UNSPECIFIED'?'':positions[position]};
}
