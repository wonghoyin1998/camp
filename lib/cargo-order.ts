type CargoCard = { constraints: readonly string[] };
function pos(items: readonly string[], name: string) { return items.indexOf(name.trim()); }
function follows(items: readonly string[], raw: string) {
  const rule = raw.trim(); let m = rule.match(/^(.+)一定第一$/);
  if (m) return pos(items, m[1]) === 0;
  m = rule.match(/^(.+)一定最後$/); if (m) return pos(items, m[1]) === items.length - 1;
  m = rule.match(/^(.+)緊接在(.+)之前$/); if (m) return pos(items, m[1]) + 1 === pos(items, m[2]);
  m = rule.match(/^(.+)緊接(.+)之後$/); if (m) return pos(items, m[1]) === pos(items, m[2]) + 1;
  m = rule.match(/^(.+)緊接(.+)$/); if (m) return pos(items, m[1]) + 1 === pos(items, m[2]);
  m = rule.match(/^(.+)在(.+)之前$/); if (m) return pos(items, m[1]) >= 0 && pos(items, m[1]) < pos(items, m[2]);
  return false;
}
export function cargoConstraintViolations(items: readonly string[], card: CargoCard) {
  return card.constraints.flatMap((text) => text.split("，")).reduce((n, rule) => n + (follows(items, rule) ? 0 : 1), 0);
}
