import { DocumentsController } from './documents.controller';

describe('documents integration availability', () => {
  it('reports each external connection without calling the network', () => {
    const controller = new DocumentsController(
      { googleConfigured: () => true } as never,
      { configured: () => false } as never,
      { configured: () => false } as never,
    );
    expect(controller.integrations()).toEqual({
      googleDocs: true,
      microsoft: false,
      sheets: false,
    });
  });
});
