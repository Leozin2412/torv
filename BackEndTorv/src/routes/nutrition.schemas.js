const { Type } = require('@sinclair/typebox');

const targetsShape = Type.Object({
  daily_calories: Type.Number(),
  protein_g: Type.Number(),
  carbs_g: Type.Number(),
  fat_g: Type.Number(),
});

const suggestionSchema = Type.Object({
  has_suggestion: Type.Boolean(),
  current: Type.Optional(targetsShape),
  suggested: Type.Optional(targetsShape),
  warnings: Type.Optional(Type.Array(Type.String())),
  changed: Type.Optional(Type.Array(Type.String())),
});

module.exports = { suggestionSchema };
