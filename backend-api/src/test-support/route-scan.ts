import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

export type Ctor = abstract new (...args: never[]) => object;

export interface ScannedRoute {
  verb: string;
  path: string;
  controller: string;
  handler: string;
  guards: string[];
}

const flatten = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : [value ?? '']).map(part => part.replace(/^\/+|\/+$/g, ''));

/**
 * Walks the module graph the way Nest does: static classes, `{ module }` dynamic modules, forwardRefs
 * and async dynamic modules. An import entry of any other shape fails the scan instead of being
 * skipped, so a route cannot hide behind a shape this walk does not understand.
 */
export async function collectControllers(root: unknown): Promise<Ctor[]> {
  const seen = new Set<unknown>();
  const controllers = new Set<Ctor>();
  const visit = async (raw: any): Promise<void> => {
    const entry = typeof raw?.then === 'function' ? await raw : raw;
    const resolved = entry?.forwardRef ? entry.forwardRef() : entry;
    const module = resolved?.module ?? resolved;
    if (typeof module !== 'function')
      throw new Error(`Unrecognised module import: ${String(resolved)}`);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    for (const controller of Reflect.getMetadata('controllers', module) ?? [])
      controllers.add(controller);
    for (const controller of resolved?.controllers ?? []) controllers.add(controller);
    for (const imported of [
      ...(Reflect.getMetadata('imports', module) ?? []),
      ...(resolved?.imports ?? []),
    ])
      await visit(imported);
  };
  await visit(root);
  return [...controllers];
}

export function scanRoutes(controllers: Ctor[]): ScannedRoute[] {
  const out: ScannedRoute[] = [];
  const guardName = (guard: unknown) => (typeof guard === 'function' ? guard.name : String(guard));
  for (const controller of controllers) {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    for (const base of flatten(Reflect.getMetadata(PATH_METADATA, controller))) {
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (
          typeof handler !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, handler) === undefined
        )
          continue;
        const methodGuards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        const verb = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
        for (const sub of flatten(Reflect.getMetadata(PATH_METADATA, handler))) {
          out.push({
            verb,
            path: '/' + [base, sub].filter(Boolean).join('/'),
            controller: controller.name,
            handler: name,
            guards: [...classGuards, ...methodGuards].map(guardName),
          });
        }
      }
    }
  }
  return out;
}

/** The controllers the production app mounts, loaded in an isolated registry. */
export async function productionControllers(): Promise<Ctor[]> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'prod';
  try {
    let appModule: unknown;
    /* eslint-disable @typescript-eslint/no-var-requires */
    jest.isolateModules(() => {
      appModule = require('../app.module').AppModule;
    });
    /* eslint-enable @typescript-eslint/no-var-requires */
    return await collectControllers(appModule);
  } finally {
    process.env.NODE_ENV = previous;
  }
}

/** Loads the production AppModule in an isolated registry so guard classes are the app's own. */
export async function productionRoutes(): Promise<ScannedRoute[]> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'prod';
  try {
    let appModule: unknown;
    /* eslint-disable @typescript-eslint/no-var-requires */
    jest.isolateModules(() => {
      appModule = require('../app.module').AppModule;
    });
    /* eslint-enable @typescript-eslint/no-var-requires */
    return scanRoutes(await collectControllers(appModule));
  } finally {
    process.env.NODE_ENV = previous;
  }
}

export const READ_VERBS = new Set(['GET', 'HEAD', 'OPTIONS']);
