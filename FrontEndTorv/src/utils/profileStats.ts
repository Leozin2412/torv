// Textos dos cards do perfil (o próprio e o de membro). Sem imports: testado direto no node.

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "+2 vs mês passado", "−1 vs mês passado" (sinal de menos tipográfico) ou "Igual ao mês passado".
export const deltaLabel = (delta: number) =>
  delta === 0 ? 'Igual ao mês passado' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs mês passado`;
