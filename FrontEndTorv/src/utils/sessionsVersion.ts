// Sobe quando um treino salvo é editado ou apagado. Telas que mostram treinos comparam com a versão que viram
// e recarregam ao voltar ao foco (o histórico só traz o que é novo, e não notaria um treino apagado).
let version = 0;

export const bumpSessionsVersion = (): void => {
  version += 1;
};

export const getSessionsVersion = (): number => version;
