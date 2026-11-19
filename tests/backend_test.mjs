import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BadRequestException extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestException';
  }
}

function validatePasswordPolicy(password) {
  const minLength = Boolean(password && password.length >= 8);
  const hasUpper = /[A-Z]/.test(password || '');
  const hasLower = /[a-z]/.test(password || '');
  const hasNumber = /[0-9]/.test(password || '');
  const hasSymbol = /[^A-Za-z0-9]/.test(password || '');

  if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw new BadRequestException(
      'A senha deve conter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um caractere especial.',
    );
  }
  return true;
}

describe('Backend - AuthService.validatePasswordPolicy', () => {
  it('Teste 1: Deve aprovar com sucesso uma senha forte e válida', () => {
    assert.equal(validatePasswordPolicy('SenhaForte@2026'), true);
  });

  it('Teste 2: Deve rejeitar e lançar BadRequestException para senha fraca/inválida', () => {
    const weakPasswords = [
      '12345',
      'senhasemnada',
      'SENHASEMNADA1',
      'SenhaSemSimbolo1',
    ];
    for (const pw of weakPasswords) {
      assert.throws(
        () => validatePasswordPolicy(pw),
        (err) => err instanceof BadRequestException && err.message.includes('mínimo 8 caracteres'),
      );
    }
  });
});
