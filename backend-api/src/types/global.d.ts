declare global {
  var isWarmStart: boolean | undefined;
  var gc: (() => void) | undefined;
}

export {};