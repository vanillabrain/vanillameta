import { z } from 'zod';

const contextSchema = z
  .object({
    version: z.literal(1),
    query: z.string().max(200),
    kind: z.enum(['all', 'analysis', 'dashboard']),
    sort: z.enum(['recent', 'title']),
    display: z.enum(['list', 'grid']),
    view: z.enum(['active', 'archived']),
  })
  .strict();
type ArtifactContext = z.infer<typeof contextSchema>;
const defaults: ArtifactContext = { version: 1, query: '', kind: 'all', sort: 'recent', display: 'list', view: 'active' };
const fields = ['artifactQuery', 'artifactKind', 'artifactSort', 'artifactDisplay', 'artifactView'];

function readContext(pathname: string, search: string): ArtifactContext {
  const params = new URLSearchParams(search);
  if (/^\/dashboard\/*$/i.test(pathname)) {
    if (fields.some(key => params.getAll(key).length > 1)) return defaults;
    const result = contextSchema.safeParse({
      version: 1,
      query: params.get('artifactQuery') ?? '',
      kind: params.get('artifactKind') ?? 'all',
      sort: params.get('artifactSort') ?? 'recent',
      display: params.get('artifactDisplay') ?? 'list',
      view: params.get('artifactView') ?? 'active',
    });
    return result.success ? result.data : defaults;
  }
  const values = params.getAll('artifactReturn');
  if (values.length !== 1 || values[0].length > 2048) return defaults;
  try {
    const result = contextSchema.safeParse(JSON.parse(values[0]));
    return result.success ? result.data : defaults;
  } catch {
    return defaults;
  }
}

export function artifactListNavigation({ pathname, search }: { pathname: string; search: string }) {
  const context = readContext(pathname, search);
  const params = new URLSearchParams();
  if (context.query) params.set('artifactQuery', context.query);
  if (context.kind !== 'all') params.set('artifactKind', context.kind);
  if (context.sort !== 'recent') params.set('artifactSort', context.sort);
  if (context.display !== 'list') params.set('artifactDisplay', context.display);
  if (context.view !== 'active') params.set('artifactView', context.view);
  const query = params.toString();
  return {
    listHref: '/dashboard' + (query ? '?' + query : ''),
    link(target: string) {
      if (!query) return target;
      const [path, existing = ''] = target.split('?');
      const targetParams = new URLSearchParams(existing);
      targetParams.set('artifactReturn', JSON.stringify(context));
      return path + '?' + targetParams.toString();
    },
  };
}
