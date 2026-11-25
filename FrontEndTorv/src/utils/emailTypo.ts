// Lista fixa (foco no Brasil); a ordem é o desempate quando duas sugestões ficam à mesma distância.
export const POPULAR_EMAIL_DOMAINS: readonly string[] = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'icloud.com',
  'live.com', 'hotmail.com.br', 'outlook.com.br', 'uol.com.br', 'bol.com.br', 'terra.com.br',
];

// Damerau-Levenshtein (variante OSA): inserção, remoção, troca e transposição de vizinhos custam 1.
function osaDistance(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        d[i][j] = j;
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
    }
  }
  return d[a.length][b.length];
}

export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain || POPULAR_EMAIL_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDist = 3;
  for (const candidate of POPULAR_EMAIL_DOMAINS) {
    // Descarte por tamanho evita calcular a matriz para entradas enormes.
    if (Math.abs(candidate.length - domain.length) > 2) continue;
    const dist = osaDistance(domain, candidate);
    if (dist >= 1 && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best ? `${local}@${best}` : null;
}
