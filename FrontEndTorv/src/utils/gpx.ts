// Lê um .gpx no aparelho e devolve os pontos compactos que o servidor espera: [t, lat, lon, ele, hr, cad], com t em
// segundos desde o 1º ponto. O XML nunca vai para o servidor. Sem imports de runtime: testado direto no node.

export type GpxType = 'RUN' | 'WALK' | 'RIDE';
export type GpsPoint = [number, number, number, number | null, number | null, number | null];

export interface ParsedGpx {
  name: string | null; // <trk><name>, decodificado e cortado em 100 caracteres
  type: GpxType | null; // <trk><type>; null = sem tipo ou desconhecido (vale o tipo da rotina)
  startTime: string; // ISO do 1º ponto
  points: GpsPoint[];
}

export const MAX_POINTS = 30000;

export class GpxError extends Error {}

const TYPE_MAP: Record<string, GpxType> = {
  running: 'RUN', run: 'RUN', trail_running: 'RUN', treadmill_running: 'RUN',
  walking: 'WALK', walk: 'WALK', hiking: 'WALK', hike: 'WALK',
  cycling: 'RIDE', biking: 'RIDE', ride: 'RIDE', road_biking: 'RIDE', mountain_biking: 'RIDE',
  gravel_cycling: 'RIDE', e_biking: 'RIDE', virtualride: 'RIDE', indoor_cycling: 'RIDE',
};

export const gpxTypeFrom = (raw: string | null): GpxType | null => (raw ? TYPE_MAP[raw.trim().toLowerCase()] ?? null : null);

const codePoint = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

const decodeXml = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

// Tempo linear em arquivo malformado: nada de `[\s\S]*?` até um fechamento que pode não existir (cada abertura sem
// fechamento varreria o resto do arquivo e o custo viraria quadrático). Cada elemento é olhado só nos primeiros
// ELEMENT_MAX caracteres, e uma abertura de tag só pode ter ATTRS_MAX caracteres até o '>'.
const ELEMENT_MAX = 4096;
const ATTRS_MAX = 256;

// Conteúdo da 1ª tag `name`, com ou sem prefixo de namespace (gpxtpx:, ns3:). `body` já vem cortado. O fechamento é o
// primeiro depois da abertura: o nome pode vir em CDATA com '<' dentro.
const tag = (body: string, name: string) => {
  const open = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]{0,${ATTRS_MAX}}>`).exec(body);
  if (!open) return null;
  const rest = body.slice(open.index + open[0].length);
  const close = new RegExp(`</(?:[\\w-]+:)?${name}>`).exec(rest);
  return close ? rest.slice(0, close.index).trim() : null;
};

// Próxima abertura de `<name` a partir de `from`; o que vem depois do nome não pode ser letra (<trk não casa <trkpt).
// `end` = índice logo após o '>' da abertura. Null sem mais elementos.
function nextOpen(xml: string, name: string, from: number) {
  for (let i = xml.indexOf(`<${name}`, from); i !== -1; i = xml.indexOf(`<${name}`, i + 1)) {
    const start = i + name.length + 1;
    if (/\w/.test(xml.charAt(start))) continue;
    const head = xml.slice(start, start + ATTRS_MAX + 1);
    const gt = head.indexOf('>');
    if (gt === -1) continue;
    const selfClosing = gt > 0 && head.charAt(gt - 1) === '/';
    return { attrs: head.slice(0, selfClosing ? gt - 1 : gt), selfClosing, end: start + gt + 1, next: i + 1 };
  }
  return null;
}
const num = (s: string | null) => {
  if (s === null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const attr = (attrs: string, name: string) => num((attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`)) ?? [])[1] ?? null);

// Redução por passo uniforme a no máximo `max` itens, sempre com o primeiro e o último (mesma regra do servidor).
function thin<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const step = Math.ceil((list.length - 1) / (max - 1));
  const out: T[] = [];
  for (let i = 0; i < list.length - 1; i += step) out.push(list[i]);
  out.push(list[list.length - 1]);
  return out;
}

export function parseGpx(xml: string): ParsedGpx {
  if (!/<gpx[\s>]/i.test(xml)) throw new GpxError('Este arquivo não é um GPX válido.');

  // Nome e tipo vêm do cabeçalho da 1ª trilha (antes do 1º <trkseg>), não dos pontos.
  const trk = nextOpen(xml, 'trk', 0);
  let header = trk ? xml.slice(trk.end, trk.end + ELEMENT_MAX) : '';
  const stop = header.search(/<trkseg\b|<\/trk>/);
  if (stop !== -1) header = header.slice(0, stop);
  const rawName = tag(header, 'name');
  const type = gpxTypeFrom(tag(header, 'type'));
  if (type === 'RIDE') throw new GpxError('Bike chega em breve. Por enquanto, só corrida e caminhada.');

  const found: { ms: number; lat: number; lon: number; ele: number | null; hr: number | null; cad: number | null }[] = [];
  let closeAt = -1; // próximo '</trkpt>': reaproveitado enquanto estiver à frente, para não varrer o arquivo a cada abertura
  for (let pos = 0; ;) {
    const open = nextOpen(xml, 'trkpt', pos);
    if (!open) break;
    pos = open.next;
    let body = '';
    if (!open.selfClosing) {
      if (closeAt < open.end) closeAt = xml.indexOf('</trkpt>', open.end);
      if (closeAt === -1) break; // não há mais fechamento: o resto não tem ponto completo
      if (closeAt - open.end > ELEMENT_MAX) continue; // fechamento longe demais: ponto ignorado
      body = xml.slice(open.end, closeAt);
      pos = closeAt;
    }
    const ms = Date.parse(tag(body, 'time') ?? '');
    const lat = attr(open.attrs, 'lat');
    const lon = attr(open.attrs, 'lon');
    if (Number.isNaN(ms) || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    found.push({ ms, lat, lon, ele: num(tag(body, 'ele')), hr: num(tag(body, 'hr')), cad: num(tag(body, 'cad')) });
  }
  if (found.length === 0) throw new GpxError('O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade).');
  if (found.length < 2) throw new GpxError('O arquivo tem pontos de menos.');

  found.sort((a, b) => a.ms - b.ms);
  const t0 = found[0].ms;
  // lat/lon a 6 casas (~0,1 m) e elevação a 1: arquivos que gravam double completo estourariam os 2 MiB do corpo.
  const points = thin(found, MAX_POINTS).map((p): GpsPoint => [
    Math.round(p.ms - t0) / 1000,
    Math.round(p.lat * 1e6) / 1e6,
    Math.round(p.lon * 1e6) / 1e6,
    p.ele === null ? null : Math.round(p.ele * 10) / 10,
    p.hr,
    p.cad,
  ]);
  const name = rawName === null ? null : decodeXml(rawName).trim().slice(0, 100) || null;
  return { name, type, startTime: new Date(t0).toISOString(), points };
}
