const actions:Record<string,string>={
  REVOKE_ALL:'Відкликано всі сеанси',REVOKE_SESSIONS:'Відкликано всі сеанси',REVOKE_SESSION:'Відкликано сеанс',
  RESET_PASSWORD:'Скинуто пароль',PASSWORD:'Змінено пароль',PASSWORD_CHANGE:'Змінено пароль',
  ADD_ROLE:'Змінено роль',REMOVE_ROLE:'Змінено роль',SELF_ROLES:'Змінено роль',ROLE_CHANGE:'Змінено роль',
  FEEDBACK_STATE:'Змінено статус відгуку',FEEDBACK_DELETE:'Видалено відгук',FEEDBACK_CREATED:'Надіслано відгук',
  JOURNAL_SAVE:'Змінено відвідуваність',STAROSTA_SAVE:'Змінено відвідуваність',AUTHORIZED_CORRECTION:'Змінено відвідуваність',
  PROFILE:'Оновлено профіль',ENABLE:'Увімкнено обліковий запис',DISABLE:'Вимкнено обліковий запис',
};
export function auditTitle(event:{source:string;objectType:string;details:unknown;oldStatus?:string|null;newStatus?:string|null}){
  const details=event.details&&typeof event.details==='object'&&!Array.isArray(event.details)?event.details as Record<string,unknown>:{};
  if(event.objectType==='Attendance'){
    const modeChanged=Object.hasOwn(details,'oldAttendanceMode')&&Object.hasOwn(details,'newAttendanceMode')&&details.oldAttendanceMode!==details.newAttendanceMode;
    if(modeChanged&&event.oldStatus===event.newStatus)return 'Змінено формат присутності';
    return 'Змінено відвідуваність';
  }
  const action=typeof details.action==='string'?details.action:event.source.replace(/^ADMIN_/,'');
  return actions[action]??actions[event.source]??`${event.source} · ${event.objectType}`;
}
