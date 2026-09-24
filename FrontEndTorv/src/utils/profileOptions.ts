import { colors } from '../theme/tokens';

export const FITNESS_LEVELS = [
  { value: 'INICIANTE', label: 'Iniciante', color: colors.brand, description: 'Está começando agora ou treina raramente. Vamos construir sua base do zero.' },
  { value: 'INTERMEDIÁRIO', label: 'Intermediário', color: colors.accentIntermediate, description: 'Treina com regularidade. Quer evoluir com mais inteligência e consistência.' },
  { value: 'AVANÇADO', label: 'Avançado', color: colors.accentAdvanced, description: 'Treina pesado há muito tempo. Busca performance máxima e superação.' },
];

export const GOAL_OPTIONS = [
  'Perder Peso',
  'Ganhar Massa Muscular',
  'Melhorar Condicionamento',
  'Aumentar Resistência',
  'Criar uma Rotina',
  'Saúde & Bem-estar',
];

export const hasGoalConflict = (goals: string[]) =>
  goals.includes('Perder Peso') && goals.includes('Ganhar Massa Muscular');

export const fitnessLevelLabel = (value?: string | null) =>
  FITNESS_LEVELS.find((level) => level.value === value)?.label ?? 'Não definido';
