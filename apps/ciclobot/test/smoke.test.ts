import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

describe("module loading smoke test", () => {
  it("loads all domain modules", async () => {
    const [lifts, parse, week, target, participant, log, bw, discipline, tri] =
      await Promise.all([
        import("../src/domain/lifts.js"),
        import("../src/domain/parse.js"),
        import("../src/domain/week.js"),
        import("../src/domain/target.js"),
        import("../src/domain/participant.js"),
        import("../src/domain/log-entry.js"),
        import("../src/domain/bodyweight.js"),
        import("../src/domain/discipline.js"),
        import("../src/domain/triathlon.js"),
      ]);
    assert.equal(typeof lifts.parseLift, "function");
    assert.equal(typeof parse.KgSchema.parse, "function");
    assert.equal(typeof week.currentIsoWeek, "function");
    assert.equal(typeof target.parseTarget, "function");
    assert.ok(participant.ParticipantSchema);
    assert.ok(log.LogEntrySchema);
    assert.ok(bw.BodyweightEntrySchema);
    assert.equal(typeof discipline.parseDiscipline, "function");
    assert.ok(tri.TriathlonEntrySchema);
  });

  it("loads all sheet modules", async () => {
    const [pSheet, lSheet, bSheet, tSheet] = await Promise.all([
      import("../src/sheets/participants.js"),
      import("../src/sheets/log.js"),
      import("../src/sheets/bodyweight.js"),
      import("../src/sheets/triathlon.js"),
    ]);
    assert.equal(pSheet.TAB, "participants");
    assert.equal(lSheet.TAB, "log");
    assert.equal(bSheet.TAB, "bodyweight");
    assert.equal(tSheet.TAB, "triathlon");
    assert.equal(typeof pSheet.createTable, "function");
    assert.equal(typeof lSheet.createTable, "function");
    assert.equal(typeof bSheet.createTable, "function");
    assert.equal(typeof tSheet.createTable, "function");
  });

  it("loads all command builders", async () => {
    const mods = await Promise.all([
      import("../src/commands/help.js"),
      import("../src/commands/join.js"),
      import("../src/commands/leave.js"),
      import("../src/commands/participants.js"),
      import("../src/commands/log.js"),
      import("../src/commands/weight.js"),
      import("../src/commands/week.js"),
      import("../src/commands/history.js"),
      import("../src/commands/undo.js"),
    ]);
    for (const m of mods) {
      assert.ok(m);
    }
  });
});
