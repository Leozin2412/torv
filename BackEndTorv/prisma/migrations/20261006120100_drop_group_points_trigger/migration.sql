-- group_rankings agora é um ranking materializado, recalculado (nunca incrementado) pelo backend
-- (recomputeRanking). O trigger antigo somava +10 pontos e +1 atividade em TODAS as linhas de
-- group_rankings do usuário a cada INSERT em activities, ignorando a janela do grupo (starts_at/ends_at),
-- o dia local (tz_offset_min) e o joined_at, e corromperia o ranking.
DROP TRIGGER IF EXISTS trg_add_points_to_group_ranking ON "activities";
DROP FUNCTION IF EXISTS trg_fn_add_points_to_group_ranking();
