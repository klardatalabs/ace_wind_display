// Picks a random phrasing from a template bank without repeating the same one
// twice in a row, so the billboard doesn't sound robotic on loop.

export function pickVariant(templates, key) {
  if (!templates.length) return "";
  if (templates.length === 1) return templates[0];
  let next = templates[Math.floor(Math.random() * templates.length)];
  const lastKey = `__last_${key}`;
  if (pickVariant._last?.[lastKey] === next) {
    next = templates[(templates.indexOf(next) + 1) % templates.length];
  }
  pickVariant._last = pickVariant._last || {};
  pickVariant._last[lastKey] = next;
  return next;
}
