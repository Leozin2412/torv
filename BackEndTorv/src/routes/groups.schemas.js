const { Type } = require('@sinclair/typebox');
const { Uuid } = require('./workout.schemas');

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const DateStr = Type.String({ pattern: DATE_PATTERN });
// Nullable num corpo: type array, não Union (com coerceTypes o Ajv coage o null no 1º ramo do anyOf).
const NullableDateBody = Type.Unsafe({ type: ['string', 'null'], pattern: DATE_PATTERN });
const Visibility = Type.Union([Type.Literal('PUBLIC'), Type.Literal('PRIVATE')]);
const Name = Type.String({ minLength: 1, maxLength: 100 });
// Respostas: Union é seguro (só serializa).
const Nullable = (schema) => Type.Union([schema, Type.Null()]);

const GroupBody = Type.Object({
  name: Name,
  visibility: Visibility,
  starts_at: DateStr,
  ends_at: Type.Optional(NullableDateBody),
  tz_offset_min: Type.Integer({ minimum: -840, maximum: 840 }),
});

const GroupPatchBody = Type.Object({
  name: Type.Optional(Name),
  visibility: Type.Optional(Visibility),
  starts_at: Type.Optional(DateStr),
  ends_at: Type.Optional(NullableDateBody),
}, { minProperties: 1 });

const Period = {
  starts_at: Type.String(),
  ends_at: Nullable(Type.String()),
  tz_offset_min: Type.Integer(),
};

const GroupDetail = Type.Object({
  id: Type.String(),
  name: Type.String(),
  visibility: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
  is_owner: Type.Boolean(),
  is_member: Type.Boolean(),
  invite_token: Nullable(Type.String()),
  my_invitation: Nullable(Type.Object({ id: Type.String(), kind: Type.String() })),
});

const GroupListItem = Type.Object({
  id: Type.String(),
  name: Type.String(),
  visibility: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
  is_owner: Type.Boolean(),
  my_rank: Type.Integer(),
  my_points: Type.Integer(),
});

const DiscoverItem = Type.Object({
  id: Type.String(),
  name: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
});

const DiscoverQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 100 })),
  cursor: Type.Optional(Type.Integer({ minimum: 0 })),
});

const DiscoverResponse = Type.Object({ groups: Type.Array(DiscoverItem), next_cursor: Nullable(Type.Integer()) });

const RankingResponse = Type.Object({
  ranking: Type.Array(Type.Object({
    position: Type.Integer(),
    user_id: Type.String(),
    name: Type.String(),
    username: Type.String(),
    photo_url: Nullable(Type.String()),
    total_points: Type.Integer(),
    activities_count: Type.Integer(),
    is_me: Type.Boolean(),
  })),
});

const MemberParams = Type.Object({ id: Uuid, userId: Uuid });

const InviteBody = Type.Object({ username: Type.String({ minLength: 1, maxLength: 100 }) });
const IdResponse = Type.Object({ id: Type.String() });

const PendingItem = Type.Object({
  id: Type.String(),
  user_id: Type.String(),
  name: Type.String(),
  username: Type.String(),
  photo_url: Nullable(Type.String()),
  created_at: Type.String(),
});
const PendingResponse = Type.Object({ requests: Type.Array(PendingItem), invites: Type.Array(PendingItem) });

const ReceivedResponse = Type.Object({
  invitations: Type.Array(Type.Object({
    id: Type.String(),
    group: Type.Object({ id: Type.String(), name: Type.String(), cover_url: Nullable(Type.String()) }),
    invited_by: Type.Object({ name: Type.String(), username: Type.String() }),
    created_at: Type.String(),
  })),
});

const ResolveResponse = Type.Object({ group_id: Type.String(), status: Type.String() });
const TokenParams = Type.Object({ token: Type.String({ minLength: 1, maxLength: 32 }) });

const JoinPreview = Type.Object({
  group: Type.Object({
    id: Type.String(),
    name: Type.String(),
    cover_url: Nullable(Type.String()),
    ...Period,
    member_count: Type.Integer(),
  }),
  is_member: Type.Boolean(),
  ended: Type.Boolean(),
});

module.exports = {
  GroupBody, GroupPatchBody, GroupDetail, GroupListItem, DiscoverQuery, DiscoverResponse, RankingResponse, MemberParams,
  Period, Nullable, DateStr,
  InviteBody, IdResponse, PendingResponse, ReceivedResponse, ResolveResponse, TokenParams, JoinPreview,
};
