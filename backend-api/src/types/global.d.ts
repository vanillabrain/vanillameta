declare global {
  // eslint-disable-next-line no-var -- Ambient var augments globalThis; let would only declare a lexical binding.
  var isWarmStart: boolean | undefined;
  // eslint-disable-next-line no-var -- Type Node's optional runtime global.gc property, without emitting a declaration.
  var gc: (() => void) | undefined;
}

export {};
