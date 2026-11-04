const { Type } = require('@sinclair/typebox');
const { Uuid } = require('./workout.schemas');

const GpsType = Type.Union([Type.Literal('RUN'), Type.Literal('WALK')]);
// [t, lat, lon, ele?, hr?, cad?]: número ou null em cada posição. Faixas e ordem ficam em lib/gpsValidation (uma regra
// por posição em 30.000 pontos pesaria no Ajv). Nullable em corpo: type array, nunca Union (bug do coerceTypes).
const NumOrNull = Type.Unsafe({ type: ['number', 'null'] });
const Points = Type.Array(Type.Array(NumOrNull, { minItems: 3, maxItems: 6 }), { minItems: 2, maxItems: 30000 });

const PreviewBody = Type.Object({
  activity_type: GpsType,
  start_time: Type.String({ format: 'date-time' }),
  points: Points,
});

const CreateBody = Type.Object({
  routine_id: Uuid,
  activity_type: GpsType,
  title: Type.Optional(Type.String({ maxLength: 100 })),
  start_time: Type.String({ format: 'date-time' }),
  points: Points,
});

const TitleBody = Type.Object({ title: Type.String({ minLength: 1, maxLength: 100 }) });

const Nullable = (schema) => Type.Union([schema, Type.Null()]);
const MetricsFields = {
  activity_type: Type.String(),
  start_time: Type.String(),
  distance_m: Type.Number(),
  duration_sec: Type.Integer(),
  elapsed_sec: Type.Integer(),
  pace_sec_per_km: Nullable(Type.Integer()),
  elevation_gain_m: Nullable(Type.Number()),
  avg_hr: Nullable(Type.Integer()),
  max_hr: Nullable(Type.Integer()),
  avg_cadence: Nullable(Type.Integer()),
  calories: Nullable(Type.Integer()),
  splits: Type.Array(Type.Object({ km: Type.Integer(), distance_m: Type.Integer(), duration_sec: Type.Integer() })),
  route: Type.Array(Type.Array(Type.Number(), { minItems: 2, maxItems: 2 })),
};
const GpsMetrics = Type.Object(MetricsFields);
const GpsActivityDetail = Type.Object({ id: Type.String(), title: Type.String(), routine_id: Nullable(Type.String()), ...MetricsFields });
const Conflict = Type.Object({ error: Type.String(), activity_id: Type.Optional(Type.String()) });

module.exports = { PreviewBody, CreateBody, TitleBody, GpsMetrics, GpsActivityDetail, Conflict };
