// Regras do gerador lidas das migrations (fonte de verdade única), no mesmo formato do
// workoutRepository.getGeneratorRules, para os testes sem banco. Identificadores entre aspas duplas; uma tupla por linha.
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '../../../prisma/migrations');
const sql = (name) => fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n'); // autocrlf

// cols: '"a", "b"'; body: linhas "  ('x', 1)," → [{ a: 'x', b: 1 }].
function rows(cols, body) {
  const names = [...cols.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  return body.trim().split('\n').map((line) => {
    const values = [...line.matchAll(/'([^']*)'|(\d+)/g)].map((m) => m[1] ?? Number(m[2]));
    if (values.length !== names.length) throw new Error(`tupla fora do formato: ${line}`);
    return Object.fromEntries(names.map((n, i) => [n, values[i]]));
  });
}

const insertRows = (text, table) => {
  const m = text.match(new RegExp(`INSERT INTO "${table}" \\(([^)]*)\\) VALUES\\n([\\s\\S]*?);`));
  return rows(m[1], m[2]);
};

const rules = sql('20261001150000_workout_generator_rules');
const update = rules.match(/FROM \(VALUES\n([\s\S]*?)\n\) v\(([^)]*)\)/);
const exerciseRules = rows(update[2], update[1]); // { slug, type, min_level, catalog_order }
const seed = insertRows(sql('20260930200000_workout_module'), 'exercises'); // { slug, name, muscle_group }
const groupOf = new Map(seed.map((e) => [e.slug, e.muscle_group]));

const catalog = exerciseRules
  .sort((a, b) => a.catalog_order - b.catalog_order)
  .map((e) => ({ id: `id:${e.slug}`, slug: e.slug, muscle_group: groupOf.get(e.slug), type: e.type, min_level: e.min_level }));
const slots = insertRows(rules, 'workout_template_slots')
  .sort((a, b) => a.days_per_week - b.days_per_week || a.day - b.day || a.position - b.position);

module.exports = { catalog, slots, seed };
