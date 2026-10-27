const { test } = require("node:test");
const assert = require("node:assert/strict");
const overlaps = require("../pocketbase/pb_hooks/timetable-rules.cjs");

const slot = (overrides = {}) => ({
  week_type: "all",
  valid_from: "",
  valid_until: "",
  start_time: "08:00",
  end_time: "09:00",
  ...overrides,
});

test("timetable overlap respects alternating weeks, date windows and times", () => {
  assert.equal(
    overlaps(slot({ week_type: "odd" }), slot({ week_type: "even" })),
    false,
  );
  assert.equal(
    overlaps(slot({ week_type: "all" }), slot({ week_type: "even" })),
    true,
  );
  assert.equal(
    overlaps(slot({ week_type: "odd" }), slot({ week_type: "odd" })),
    true,
  );
  assert.equal(
    overlaps(
      slot({ week_type: "odd", valid_until: "2026-12-31" }),
      slot({ week_type: "odd", valid_from: "2027-01-01" }),
    ),
    false,
  );
  assert.equal(
    overlaps(
      slot({ start_time: "08:00", end_time: "09:00" }),
      slot({ start_time: "09:00", end_time: "10:00" }),
    ),
    false,
  );
});
