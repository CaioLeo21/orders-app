// Formatação espelhada de condo-order-hub/src/lib/format.ts: o texto que a API devolve
// precisa ser idêntico ao que o front montaria sozinho.

export type UnitKind = 'apartment' | 'house';

export interface UnitColumns {
  block?: string | null;
  apartment?: string | null;
  lot?: string | null;
  house?: string | null;
  street?: string | null;
}

/** Bloco (prédio) ou quadra (casas). */
export function unitGroup(kind: UnitKind, unit: UnitColumns): string | undefined {
  return (kind === 'house' ? unit.lot : unit.block) ?? undefined;
}

/** Número do apartamento ou da casa. */
export function unitNumber(kind: UnitKind, unit: UnitColumns): string {
  return (kind === 'house' ? unit.house : unit.apartment) ?? '';
}

/** "Bloco B · Apto 204", "Apto 101", "Quadra 3 · Casa 12", "Rua dos Ipês · Casa 12" ou "Casa 12". */
export function formatUnit(kind: UnitKind, unit: UnitColumns): string {
  const group = unitGroup(kind, unit);
  const number = unitNumber(kind, unit);
  if (kind === 'house') {
    if (group) return `Quadra ${group} · Casa ${number}`;
    if (unit.street) return `${unit.street} · Casa ${number}`;
    return `Casa ${number}`;
  }
  return group ? `Bloco ${group} · Apto ${number}` : `Apto ${number}`;
}

/** Chave normalizada da unidade (RN-U2): "B-204" → "b|204"; apto 101 sem bloco → "|101". */
export function unitKey(group: string | undefined | null, number: string): string {
  return `${(group ?? '').trim().toLowerCase()}|${number.trim().toLowerCase()}`;
}

/** "#000318" a partir do id 318 (RN-E8). */
export function packageCode(id: number | string): string {
  return `#${String(id).padStart(6, '0')}`;
}

/** Só os dígitos do telefone. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** (11) 99999-9999 ou (11) 3333-4444, igual ao maskPhone do front. */
export function maskPhone(value: string): string {
  const d = phoneDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Slug válido (RN-C1). */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
