export function activeNavigation(path:string,hrefs:string[]){
 const direct=[...hrefs].sort((a,b)=>b.length-a.length).find(h=>h==='/'?path==='/':path===h||path.startsWith(h+'/'));
 if(direct)return direct;
 if(['/students','/specialties','/teacher/lessons'].some(h=>path===h||path.startsWith(h+'/'))&&hrefs.includes('/groups'))return '/groups';
 return undefined;
}
