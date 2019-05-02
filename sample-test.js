fixture("My fixture").page("http://127.0.0.1:8000/examples/repro-dev");

test("My Test", async t => {
  // const location = await t.eval(() => window.location);
  await t.expect(true).eql(false);
});
