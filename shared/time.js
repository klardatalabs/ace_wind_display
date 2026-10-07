// Time helpers shared by the server and the frontend. The turbine is in Bristol, so "today"
// and "7 am" mean UK time (including summer time), whatever the viewer's or kiosk's clock says.

/** Start of the current UK day, as a UTC instant. */
export function londonDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const sinceMidnightMs = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000;
  return new Date(now.getTime() - now.getMilliseconds() - sinceMidnightMs);
}

/** Hours since UK midnight (0–24) for an instant. */
export function londonHour(now = new Date()) {
  return (now.getTime() - londonDayStart(now).getTime()) / 3_600_000;
}

/** Today's date at a given UK clock hour (e.g. 19.5 = 7:30 pm), as a UTC instant. */
export function londonHourToDate(hour, now = new Date()) {
  return new Date(londonDayStart(now).getTime() + hour * 3_600_000);
}
