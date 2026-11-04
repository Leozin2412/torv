// Mensagens do backend do GPX (inglês, estáveis) → texto para a pessoa. Sem imports de runtime: testado direto no node.
// Na tela: axios.isAxiosError(e) ? gpsErrorText(e.response?.status, e.response?.data?.error) : gpsErrorText(500).

const FUTURE = 'A data do arquivo está no futuro. Confira o relógio do aparelho que gravou.';
const OLD = 'Só dá para importar atividades das últimas 72 horas.';

const BY_MESSAGE: Record<string, string> = {
  'start_time must be within the last 72 hours': OLD,
  'start_time must be on or after 2026-01-01': OLD,
  'start_time must not be in the future': FUTURE,
  'activity must not end in the future': FUTURE,
  'activity too short': 'Atividade curta demais para importar (mínimo de 1 minuto e 100 m).',
  'activity too long': 'Atividade longa demais (máximo de 24 horas).',
  'speed not compatible with run or walk': 'A velocidade não parece de corrida nem de caminhada.',
  'too many sessions on that day': 'Você já registrou 5 atividades nesse dia, o limite diário.',
  'Activity already imported': 'Você já importou esta atividade.',
  'points must be in chronological order': 'O arquivo tem horários fora de ordem.',
};

export function gpsErrorText(status: number | undefined, serverMessage?: string): string {
  if (status === undefined) return 'Sem conexão. Tente de novo.';
  if (serverMessage && BY_MESSAGE[serverMessage]) return BY_MESSAGE[serverMessage];
  if (serverMessage?.startsWith('invalid point at index')) return 'O arquivo tem pontos inválidos.';
  if (status === 404) return 'Rotina não encontrada. Volte e tente de novo.';
  if (status === 413) return 'Arquivo grande demais para enviar.';
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto.';
  if (status === 400) return 'Não foi possível processar o arquivo.';
  return 'Algo deu errado. Tente de novo.';
}
