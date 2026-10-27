module.exports = function timetableOverlap(first, second) {
  const firstWeek = first.week_type || "all";
  const secondWeek = second.week_type || "all";
  const weeksOverlap =
    firstWeek === "all" || secondWeek === "all" || firstWeek === secondWeek;
  const datesOverlap =
    (!first.valid_until ||
      !second.valid_from ||
      second.valid_from <= first.valid_until) &&
    (!second.valid_until ||
      !first.valid_from ||
      first.valid_from <= second.valid_until);
  const timesOverlap =
    first.start_time < second.end_time && first.end_time > second.start_time;
  return weeksOverlap && datesOverlap && timesOverlap;
};
