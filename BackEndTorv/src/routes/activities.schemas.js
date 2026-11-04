const { Type } = require('@sinclair/typebox');

// Tipos que o app conhece. Tipo novo: uma entrada aqui e em ACTIVITY_LABELS no front.
const ACTIVITY_TYPES = ['STRENGTH', 'RUN', 'WALK'];

const ActivityItem = Type.Object({
  id: Type.String(),
  activity_type: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  set_count: Type.Integer(),
  distance_m: Type.Union([Type.Number(), Type.Null()]),
});

const ActivityPage = Type.Object({
  activities: Type.Array(ActivityItem),
  next_before: Type.Union([Type.String(), Type.Null()]),
});

// Dia local de quem chama (Home e perfil): o servidor não sabe o fuso do aparelho.
const LocalDayQuery = Type.Object({
  date: Type.String({ pattern: '^20\\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', description: 'Dia local do cliente, YYYY-MM-DD' }),
  tz_offset_min: Type.Integer({ minimum: -840, maximum: 840, description: 'Minutos que o relógio local difere de UTC (BRT = -180)' }),
});

module.exports = { ACTIVITY_TYPES, ActivityItem, ActivityPage, LocalDayQuery };
