export function responsiveBlockStyle(layouts: any, id: string) {
  if (!layouts || !id || !['mobile', 'tablet', 'desktop'].every(name => layouts[name]?.[id])) return {};
  const sizes = { xs: 'mobile', sm: 'tablet', md: 'desktop' };
  return {
    gridRow: Object.fromEntries(
      Object.entries(sizes).map(([size, name]) => [size, `${layouts[name][id].y + 1} / span ${layouts[name][id].h}`]),
    ),
    gridColumn: Object.fromEntries(
      Object.entries(sizes).map(([size, name]) => [size, `${layouts[name][id].x + 1} / span ${layouts[name][id].w}`]),
    ),
  };
}
