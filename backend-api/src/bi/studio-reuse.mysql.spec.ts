/** Same real service flow on a separately guarded, owned MySQL fixture. */
if (process.env.VM_STUDIO_REUSE_MYSQL_CONFIG) {
  require('./studio-reuse.integration.spec');
} else {
  describe.skip('Studio reuse owned MySQL fixture unavailable', () => {
    it('requires VM_STUDIO_REUSE_MYSQL_CONFIG and owner proof', () => undefined);
  });
}
