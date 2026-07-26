export function formatFecha(fecha: string | null): string | null {
  if (!fecha) return null;
  const [year, month, day] = fecha.split("-");
  return `${day}/${month}/${year}`;
}
