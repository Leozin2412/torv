import axios from 'axios';

// Mensagens do backend (inglês, estáveis) → texto para a pessoa.
const BY_MESSAGE: Record<string, string> = {
  'Group has ended': 'Este grupo já foi encerrado.',
  'Already a member': 'Você já está neste grupo.',
  'Already pending': 'Já existe um convite ou pedido pendente.',
  'Invitation is not pending': 'Este convite já foi respondido.',
  'Owner cannot leave the group; delete it instead': 'O dono não pode sair. Exclua o grupo.',
};

export function groupErrorText(status: number | undefined, serverMessage?: string, notFound = 'Não encontrado.'): string {
  if (status === undefined) return 'Sem conexão. Tente de novo.';
  if (serverMessage && BY_MESSAGE[serverMessage]) return BY_MESSAGE[serverMessage];
  if (status === 404) return notFound;
  if (status === 413) return 'A imagem é grande demais (máximo de 5 MB).';
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto.';
  if (status === 400) return 'Confira os dados e tente de novo.';
  return 'Algo deu errado. Tente de novo.';
}

export const describeError = (err: unknown, notFound?: string): string =>
  axios.isAxiosError(err)
    ? groupErrorText(err.response?.status, err.response?.data?.error, notFound)
    : groupErrorText(500);
