// Projeta [lat, lon][] num retângulo width × height com margem, mantendo a proporção: equirretangular em torno da
// latitude média, norte para cima, centralizado. Devolve [x, y] de tela. Sem imports de runtime: testado no node.
export function projectRoute(route: [number, number][], width: number, height: number, margin = 8): [number, number][] {
  if (route.length === 0) return [];
  const lat0 = ((route.reduce((n, [lat]) => n + lat, 0) / route.length) * Math.PI) / 180;
  const xs = route.map(([, lon]) => lon * Math.cos(lat0));
  const ys = route.map(([lat]) => lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * margin) / spanX : Infinity,
    spanY > 0 ? (height - 2 * margin) / spanY : Infinity,
  );
  if (!Number.isFinite(scale)) return route.map(() => [width / 2, height / 2]); // um ponto só (ou todos iguais)
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return route.map((_, i) => [offX + (xs[i] - minX) * scale, offY + (minY + spanY - ys[i]) * scale]);
}
