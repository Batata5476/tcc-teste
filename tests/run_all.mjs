import { execSync } from 'node:child_process';

console.log('================================================================');
console.log('🚀 INICIANDO TESTES DO BACKEND E FRONTEND NO TERMINAL');
console.log('================================================================');
console.log('📦 1. EXECUTANDO TESTES DO BACKEND...');
console.log('   Função selecionada: AuthService.validatePasswordPolicy()');
console.log('   Arquivo de origem:  Backend/src/auth/auth.service.ts');
console.log('   ------------------------------------------------------------');
execSync('node --test tests/backend_test.mjs', { stdio: 'inherit' });

console.log('📦 2. EXECUTANDO TESTES DO FRONTEND...');
console.log('   Função selecionada: saveToken / getToken / logout');
console.log('   Arquivo de origem:  frontend/services/auth.ts');
console.log('   ------------------------------------------------------------');
execSync('node --test tests/frontend_test.mjs', { stdio: 'inherit' });

console.log('================================================================');
console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO (4/4 PASS)');
console.log('================================================================');
