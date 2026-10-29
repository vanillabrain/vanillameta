import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';

const scopeSchema = z.enum(['sources:read', 'documents:read']);
const scopesSchema = z
  .array(scopeSchema)
  .max(2)
  .refine(values => new Set(values).size === values.length);
const organizationSchema = z.object({ id: z.number().int().positive(), name: z.string() });
const dateSchema = z.string().datetime({ offset: true });
const ticketSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]{64}$/);
const callbackSchema = z
  .string()
  .url()
  .refine(value => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  });
const connectionSchema = z.object({
  id: z.string().min(1),
  clientName: z.string(),
  clientId: z.string(),
  organizationId: z.number().int().positive(),
  scopes: scopesSchema,
  createdAt: dateSchema,
  expiresAt: dateSchema,
  revoked: z.boolean(),
});
const listSchema = z
  .object({
    configured: z.boolean(),
    resourceUrl: z.string().url().nullable(),
    organization: organizationSchema.nullable(),
    connections: z.array(connectionSchema),
  })
  .refine(data => data.connections.every(connection => connection.organizationId === data.organization?.id));
const requestSchema = z.object({
  ticket: ticketSchema,
  clientName: z.string(),
  clientId: z.string(),
  organization: organizationSchema,
  accountLabel: z.string(),
  requestedScopes: scopesSchema.refine(values => values.length > 0),
  expiresAt: dateSchema,
  reviewToken: z.string().min(1),
  redirectUri: callbackSchema,
});
export type AiConnection = z.infer<typeof connectionSchema>;
export type AiConnectionList = z.infer<typeof listSchema>;
export type ConsentRequest = z.infer<typeof requestSchema>;
export type AiScope = z.infer<typeof scopeSchema>;
export type ConsentDecision = { decision: 'approve'; scopes: AiScope[] } | { decision: 'cancel'; scopes: [] };

export function validateDecisionRedirect(value: string, expected: string, approved: boolean): string {
  const url = new URL(callbackSchema.parse(value));
  const callback = new URL(callbackSchema.parse(expected));
  if (url.origin !== callback.origin || url.pathname !== callback.pathname) throw new Error('Invalid callback');
  if (
    approved
      ? !url.searchParams.get('code') || url.searchParams.has('error')
      : url.searchParams.get('error') !== 'access_denied' || url.searchParams.has('code')
  )
    throw new Error('Invalid decision');
  if (Array.from(url.searchParams.keys()).some(key => url.searchParams.getAll(key).length !== 1))
    throw new Error('Invalid callback parameters');
  const state = url.searchParams.get('state');
  if (!state || state.length > 512) throw new Error('Invalid callback state');
  for (const key of ['code', 'state', 'error']) {
    if (!callback.searchParams.has(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  callback.searchParams.sort();
  if (url.search !== callback.search) throw new Error('Invalid callback parameters');
  return new URL(value).href;
}

export const aiConnectionsService = {
  async list(signal?: AbortSignal): Promise<AiConnectionList> {
    return listSchema.parse((await get('/ai-connections', undefined, { signal, withCredentials: true })).data);
  },
  async request(ticket: string, signal?: AbortSignal): Promise<ConsentRequest> {
    const data = requestSchema.parse(
      (await get(`/ai-connections/requests/${ticketSchema.parse(ticket)}`, undefined, { signal, withCredentials: true }))
        .data,
    );
    if (data.ticket !== ticket) throw new Error('Invalid request');
    return data;
  },
  async decide(request: ConsentRequest, input: ConsentDecision): Promise<string> {
    const scopes = scopesSchema.parse(input.scopes);
    if (
      (input.decision === 'approve' && !scopes.length) ||
      (input.decision === 'cancel' && scopes.length) ||
      scopes.some(scope => !request.requestedScopes.includes(scope))
    )
      throw new Error('Invalid scopes');
    const approved = input.decision === 'approve';
    const data = z
      .object({ redirectUrl: callbackSchema, approved: z.boolean() })
      .parse(
        (
          await post(
            `/ai-connections/requests/${ticketSchema.parse(request.ticket)}/decision`,
            { decision: input.decision, reviewToken: request.reviewToken, scopes },
            { _retry: true, withCredentials: true },
          )
        ).data,
      );
    if (data.approved !== approved) throw new Error('Invalid decision');
    return validateDecisionRedirect(data.redirectUrl, request.redirectUri, approved);
  },
  async disconnect(id: string): Promise<void> {
    z.object({ revoked: z.literal(true) }).parse(
      (await post(`/ai-connections/${encodeURIComponent(id)}/disconnect`, {}, { _retry: true, withCredentials: true })).data,
    );
  },
};
