// Código de convite que chegou por link antes de o app poder abrir a tela (deslogado, ou navegação ainda não pronta).
let pending: string | null = null;

export const setPendingJoin = (code: string | null): void => {
  pending = code;
};

export const takePendingJoin = (): string | null => {
  const code = pending;
  pending = null;
  return code;
};
