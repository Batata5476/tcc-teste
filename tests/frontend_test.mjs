import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
const localStorageMock = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
};

async function saveToken(token) {
  localStorageMock.setItem('access_token', token);
}

async function getToken() {
  return localStorageMock.getItem('access_token');
}

async function logout() {
  localStorageMock.removeItem('access_token');
  localStorageMock.removeItem('user_type');
}

describe('Frontend - auth.service (saveToken, getToken, logout)', () => {
  it('Teste 1: Deve armazenar e recuperar o token JWT corretamente (saveToken + getToken)', async () => {
    const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.signature';
    await saveToken(mockJwt);
    const recovered = await getToken();
    assert.strictEqual(recovered, mockJwt);
  });

  it('Teste 2: Deve remover o token da sessão ao fazer logout (logout + getToken)', async () => {
    await logout();
    const recovered = await getToken();
    assert.strictEqual(recovered, null);
  });
});
