// Item e página do GET /activities e do GET /users/:id/activities. Página cheia → pode haver mais: o cliente manda
// next_before como `before` na próxima chamada.
function activityItem(a) {
  return {
    id: a.id,
    activity_type: a.activity_type,
    title: a.title ?? '',
    start_time: a.start_time.toISOString(),
    duration_sec: a.duration_sec ?? 0,
    set_count: a._count.workout_sets,
    distance_m: a.distance_m == null ? null : Number(a.distance_m),
  };
}

function activityPage(rows, limit) {
  return {
    activities: rows.map(activityItem),
    next_before: rows.length === limit ? rows[rows.length - 1].start_time.toISOString() : null,
  };
}

module.exports = { activityItem, activityPage };
