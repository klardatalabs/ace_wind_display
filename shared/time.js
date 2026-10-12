// UK wall-clock times use the offset at the requested time, including DST.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});
function parts(date) {
  return Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function londonDate(date = new Date()) {
  const p=parts(date);
  return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
}
export function londonHourToDate(hour, now = new Date()) {
  const p=parts(now);
  const target=Date.UTC(p.year,p.month-1,p.day)+hour*3_600_000;
  let instant=target;
  for (let i=0;i<3;i++) {
    const q=parts(new Date(instant));
    const delta=target-Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second);
    if (!delta) break;
    instant+=delta;
  }
  return new Date(instant);
}
export function londonDayStart(now = new Date()) { return londonHourToDate(0,now); }
export function londonHour(now = new Date()) {
  const p=parts(now);
  return p.hour+p.minute/60+(p.second+now.getMilliseconds()/1000)/3600;
}
