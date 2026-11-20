import { describe, expect, it } from 'vitest';
import { formatUnit, maskPhone, packageCode, unitKey } from '../../src/lib/format.js';

describe('unitKey (RN-U2)', () => {
  it.each([
    ['B', '204', 'b|204'],
    [' b ', '204 ', 'b|204'],
    ['', '204', '|204'],
    [undefined, '101', '|101'],
    ['Único', '801', 'único|801'],
    ['3', '12', '3|12'],
  ])('%j + %j → %s', (group, number, key) => {
    expect(unitKey(group, number)).toBe(key);
  });
});

describe('formatUnit (igual ao front)', () => {
  it.each([
    ['apartment', { block: 'B', apartment: '204' }, 'Bloco B · Apto 204'],
    ['apartment', { apartment: '101' }, 'Apto 101'],
    ['house', { lot: '3', house: '12', street: 'Rua dos Ipês' }, 'Quadra 3 · Casa 12'],
    ['house', { house: '12', street: 'Rua dos Ipês' }, 'Rua dos Ipês · Casa 12'],
    ['house', { house: '12' }, 'Casa 12'],
  ] as const)('%s %j → %s', (kind, unit, label) => {
    expect(formatUnit(kind, unit)).toBe(label);
  });
});

describe('packageCode (RN-E8)', () => {
  it('formata com 6 dígitos', () => {
    expect(packageCode(318)).toBe('#000318');
    expect(packageCode('1234567')).toBe('#1234567');
  });
});

describe('maskPhone (RN-M4)', () => {
  it('formata celular e fixo', () => {
    expect(maskPhone('11999992040')).toBe('(11) 99999-2040');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('(11) 9 9999-2040')).toBe('(11) 99999-2040');
  });
});
