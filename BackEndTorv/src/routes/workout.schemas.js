const { Type } = require('@sinclair/typebox');

const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps',
  'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço',
];

const Uuid = Type.String({ format: 'uuid' });
const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));
const IdParams = Type.Object({ id: Uuid });
const MuscleGroup = Type.Union(MUSCLE_GROUPS.map((g) => Type.Literal(g)));

const RoutineBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  exercises: Type.Array(Type.Object({
    exercise_id: Uuid,
    reps_min: Type.Integer({ minimum: 1, maximum: 100 }),
    reps_max: Type.Integer({ minimum: 1, maximum: 100 }),
    rest_sec: Type.Integer({ minimum: 0, maximum: 600 }),
    sets: Type.Array(
      // type array, não Union: com coerceTypes o Ajv coage no 1º ramo do anyOf (Number: null→0; Null: 0→null).
      // Com type ['number','null'] só coage o que não for nenhum dos dois.
      Type.Object({ weight_kg: Type.Unsafe({ type: ['number', 'null'], minimum: 0, maximum: 999.99 }) }),
      { minItems: 1, maxItems: 10 },
    ),
  }), { minItems: 1, maxItems: 20 }),
});

const PlanSuggestion = Type.Object({
  has_suggestion: Type.Boolean(),
  changed: Type.Array(Type.String({ description: 'fitness_level | goals | gender' })),
});

const RoutineList = Type.Object({
  routines: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    is_default: Type.Boolean(),
    exercise_count: Type.Integer(),
    set_count: Type.Integer(),
  })),
  next_routine_id: Type.Union([Type.String(), Type.Null()]),
  plan_suggestion: PlanSuggestion,
});

const RoutineDetail = Type.Object({
  id: Type.String(),
  name: Type.String(),
  is_default: Type.Boolean(),
  exercises: Type.Array(Type.Object({
    id: Type.String(),
    exercise_id: Type.String(),
    name: Type.String(),
    muscle_group: Type.String(),
    position: Type.Integer(),
    reps_min: Type.Integer(),
    reps_max: Type.Integer(),
    rest_sec: Type.Integer(),
    sets: Type.Array(Type.Object({ set_number: Type.Integer(), weight_kg: Type.Union([Type.Number(), Type.Null()]) })),
  })),
});

const ExerciseBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  muscle_group: MuscleGroup,
});

const Exercise = Type.Object({
  id: Type.String(),
  name: Type.String(),
  muscle_group: Type.String(),
  is_custom: Type.Boolean(),
});

// Nullable em corpo: type array, não Union (coerceTypes coage o null no 1º ramo; ver weight_kg acima).
const SessionBody = Type.Object({
  routine_id: Type.Optional(Type.Unsafe({ type: ['string', 'null'], format: 'uuid' })),
  started_at: Type.String({ format: 'date-time' }),
  duration_sec: Type.Integer({ minimum: 1, maximum: 21600 }),
  sets: Type.Array(Type.Object({
    exercise_id: Uuid,
    position: Type.Integer({ minimum: 1, maximum: 20 }),
    set_number: Type.Integer({ minimum: 1, maximum: 10 }),
    duration_sec: Type.Integer({ minimum: 0, maximum: 3600 }),
    rest_before_sec: Type.Unsafe({ type: ['integer', 'null'], minimum: 0, maximum: 7200 }),
  }), { minItems: 1, maxItems: 200 }),
});

const SessionSummary = Type.Object({
  id: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  set_count: Type.Integer(),
});

const SessionDetail = Type.Object({
  id: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  sets: Type.Array(Type.Object({
    exercise_name: Type.String(),
    position: Type.Integer(),
    set_number: Type.Integer(),
    duration_sec: Type.Integer(),
    rest_before_sec: Type.Union([Type.Integer(), Type.Null()]),
  })),
});

module.exports = {
  MUSCLE_GROUPS, errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
  ExerciseBody, Exercise, SessionBody, SessionSummary, SessionDetail,
};
