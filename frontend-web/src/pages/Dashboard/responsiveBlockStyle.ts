type ResponsiveSize = 'xs' | 'sm' | 'md';
export type ResponsiveBlockStyle = {
  gridRow?: Record<ResponsiveSize, string>;
  gridColumn?: Record<ResponsiveSize, string>;
};
export function responsiveBlockStyle(layouts: any, id: string): ResponsiveBlockStyle {
  if (!layouts || !id || !['mobile', 'tablet', 'desktop'].every(name => layouts[name]?.[id])) return {};
  const build = (
    pick: (rect: { x: number; y: number; w: number; h: number }) => string,
  ): Record<ResponsiveSize, string> => ({
    xs: pick(layouts.mobile[id]),
    sm: pick(layouts.tablet[id]),
    md: pick(layouts.desktop[id]),
  });
  return {
    gridRow: build(rect => `${rect.y + 1} / span ${rect.h}`),
    gridColumn: build(rect => `${rect.x + 1} / span ${rect.w}`),
  };
}
