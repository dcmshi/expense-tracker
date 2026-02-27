// Lightweight CommonJS stub for the uuid package.
// uuid v13 ships ESM-only (export { default as MAX } …) which Jest cannot
// parse in CommonJS mode. Tests that need a deterministic v4 should rely on
// this stub; tests that want a real UUID should jest.spyOn or override.
module.exports = {
  v4: () => 'test-uuid-v4',
}
