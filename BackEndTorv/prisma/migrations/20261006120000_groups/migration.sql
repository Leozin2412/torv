-- Grupos e competição. `groups`, `group_members` e `group_rankings` existiam sem uso (vazias).
-- group_rankings fica: é o ranking materializado, recalculado pelo backend (recomputeRanking).

ALTER TABLE "groups"
  ADD COLUMN "owner_id" UUID NOT NULL,
  ADD COLUMN "visibility" VARCHAR(10) NOT NULL,
  ADD COLUMN "cover_url" VARCHAR(500),
  ADD COLUMN "starts_at" DATE NOT NULL,
  ADD COLUMN "ends_at" DATE,
  ADD COLUMN "tz_offset_min" INTEGER NOT NULL,
  ADD COLUMN "invite_token" VARCHAR(12),
  ADD COLUMN "created_at" TIMESTAMPTZ DEFAULT now(),
  DROP COLUMN "period_type",
  ADD CONSTRAINT "groups_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'PRIVATE')),
  ADD CONSTRAINT "groups_period_check" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at"),
  ADD CONSTRAINT "groups_tz_offset_min_check" CHECK ("tz_offset_min" BETWEEN -840 AND 840),
  ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "groups_invite_token_key" ON "groups"("invite_token");
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE INDEX "group_rankings_order_idx" ON "group_rankings"("group_id", "total_points" DESC, "activities_count" DESC);
-- recomputeRanking varre as atividades do usuário por start_time (qualquer tipo).
CREATE INDEX IF NOT EXISTS "activities_user_id_start_time_idx" ON "activities"("user_id", "start_time");

CREATE TABLE "group_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_invitations_kind_check" CHECK ("kind" IN ('INVITE', 'REQUEST')),
    CONSTRAINT "group_invitations_status_check" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED'))
);
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "group_invitations_user_id_status_idx" ON "group_invitations"("user_id", "status");
-- No máximo 1 convite/pedido pendente por (grupo, usuário).
CREATE UNIQUE INDEX "group_invitations_pending_key" ON "group_invitations"("group_id", "user_id") WHERE "status" = 'PENDING';

-- RLS: mesmo padrão de 20260925180000_lock_down_public_schema (tabela nova = ENABLE + policy do torv_api).
ALTER TABLE "group_invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "group_invitations" TO torv_api USING (true) WITH CHECK (true);
