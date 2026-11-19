# 🚀 Guia Oficial de Execução e Demonstração - TCC Coopera

> **Projeto:** Sistema Corporativo Coopera (Web & Mobile)  
> **Objetivo:** Roteiro prático para executar o projeto e realizar a demonstração ao vivo para a banca com PC, iPhone e Android.

---

## 📋 Sumário
1. [Preparação do Ambiente de Rede (Wi-Fi / 4G)](#1-preparação-do-ambiente-de-rede-wi-fi--4g)
2. [Como Iniciar o Sistema no Computador](#2-como-iniciar-o-sistema-no-computador)
3. [Comandos Rápidos do Cenário Demonstrativo](#3-comandos-rápidos-do-cenário-demonstrativo)
4. [Como Conectar os Celulares (iPhone e Android)](#4-como-conectar-os-celulares-iphone-e-android)
5. [Contas e Senhas de Demonstração](#5-contas-e-senhas-de-demonstração)
6. [Roteiro Passo a Passo de Apresentação para a Banca](#6-roteiro-passo-a-passo-de-apresentação-para-a-banca)

---

## 1. Preparação do Ambiente de Rede (Wi-Fi / 4G)

Para que o **computador**, o seu **iPhone** e o **Android do seu amigo** conversem entre si em tempo real:

> 💡 **DICA DE OURO (Evite o Wi-Fi da Faculdade):**  
> Redes públicas de faculdade possuem bloqueios de firewall que impedem o celular de se comunicar com o notebook.  
> **A melhor solução:** Peça para alguém ligar o **Ponto de Acesso Pessoal (Roteador 4G)** do celular e conecte o seu computador, o seu iPhone e o Android nessa mesma rede!

---

## 2. Como Iniciar o Sistema no Computador

Abra **dois terminais** no VS Code / PowerShell:

### 🔹 Terminal 1 (Backend - NestJS na porta 3000):
```bash
cd Backend
npm run start:dev
```
*(Aguarde exibir que o NestJS inicializou com sucesso).*

### 🔹 Terminal 2 (Frontend - Expo na porta 8081):
```bash
cd frontend
npx expo start
```
*(Ele exibirá um grande QR Code no terminal).*

---

## 3. Comandos Rápidos do Cenário Demonstrativo

No terminal da pasta `Backend`, você tem comandos prontos para controlar os dados da apresentação:

### 🔴 Para Deixar o Dashboard VAZIO (Começar do zero):
```bash
npm run demo:clear
```
> Limpa todas as tarefas e reuniões. Ao abrir a tela, o Dashboard estará zerado.

### 🟢 Para CARREGAR o Cenário Completo de Demonstração:
```bash
npm run demo:load
```
> Injeta instantaneamente na data de **HOJE** e **ONTEM**:
> - **1 Tarefa Urgente (Hoje)**: *Revisão Crítica Contrato* (com badge vermelho de Urgente).
> - **1 Tarefa Normal (Hoje)**: *Documentação Técnica* (Em andamento).
> - **1 Tarefa Pendente / Atrasada (Ontem)**: *Relatório de Metas Mensal* (Cai direto no card de pendências).
> - **1 Reunião Presencial (Hoje às 14:00)**: *Alinhamento Estratégico de Metas Q4* (sem link).
> - **1 Reunião Online (Hoje às 16:30)**: *Apresentação e Validação do TCC com a Diretoria* (com link oficial do Google Meet: `https://meet.google.com/fxm-njyg-ebm`).
> - **1 Reunião Solicitada para RECUSAR (Hoje às 10:00)**: Solicitação de funcionário pronta para você recusar com o botão vermelho `X`.
> - **1 Reunião Solicitada para ACEITAR (Hoje às 11:30)**: Solicitação de funcionário pronta para você aceitar com o botão verde `✓`.
> - **Backup Automático**: Gera uma cópia em `BD/backups/backup_COOPERA_empresa1_CENARIO_APRESENTACAO_TCC.sql`.

---

## 4. Como Conectar os Celulares (iPhone e Android)

Com o comando `npx expo start` rodando no computador:

### 🍏 No seu iPhone:
1. Abra o aplicativo nativo da **Câmera** do iPhone.
2. Aponte para o **QR Code** no terminal do PC.
3. Toque na notificação para abrir no **Expo Go**.

### 🤖 No Android do seu amigo:
1. Baixe o app **Expo Go** na Google Play Store.
2. Abra o Expo Go, toque em **"Scan QR code"** e aponte para o QR Code da tela do PC.

### 💻 No Navegador do Computador (PC):
- Abra: [http://localhost:8081](http://localhost:8081)

---

## 5. Contas e Senhas de Demonstração

Use estas credenciais criadas para a demonstração:

| Perfil | Dispositivo Sugerido | Login (Email ou CNPJ) | Senha | O que pode fazer |
| :--- | :--- | :--- | :--- | :--- |
| **Empresa / Admin Master** | Computador (PC) ou iPhone | `99888777000100`<br>*(ou `admin@empresateste.com`)* | `Teste@123` | Gerenciar tarefas da equipe, aceitar/recusar reuniões, ver humor geral, backup e chat. |
| **Colaborador / Funcionário** | Android do amigo | `funcionario@teste.com` | `Teste@123` | Concluir tarefas (+100 pontos), bater ponto eletrônico com biometria/GPS, solicitar reuniões e chat. |

---

## 6. Roteiro Passo a Passo de Apresentação para a Banca

Siga este roteiro para impressionar os avaliadores:

### 1️⃣ Demonstração no PC (Visão do Administrador)
1. Faça login no PC com a conta de **Empresa/Admin**.
2. Mostre o **Dashboard Corporativo**:
   - A separação entre as abas **Tarefas** e **Reuniões**.
   - As seções retráteis (*Urgentes*, *Outras*, *Pendentes/Atrasadas*).
3. Na aba **Reuniões**:
   - Mostre o botão **"Acessar link"** da reunião online que abre o Google Meet.
   - Demonstre a interação ao vivo:
     - Clique no **botão verde (`✓`)** da reunião solicitada para **Aceitar** (ela vira Agendada na hora).
     - Clique no **botão vermelho (`X`)** da outra reunião para **Recusar**.

### 2️⃣ Demonstração no Celular Android (Visão do Colaborador)
1. Seu amigo abre o app logado como **Funcionário**.
2. Ele mostra o Dashboard dele sincronizado em tempo real.
3. Ele clica no checkmark verde de uma tarefa para **Concluir**:
   - A tarefa fica tachada.
   - O colaborador ganha instantaneamente **+100 pontos** de gamificação.
4. Ele vai na aba **Ponto-E**:
   - Mostra o relógio em tempo real e o status de **GPS e Biometria Ativos**.
   - Toca em **Confirmar Entrada**:
     - Mostra as opções manuais: Câmera Frontal (Selfie) ou Face ID / PIN.
     - Confirma a entrada e mostra o cronômetro de jornada correndo.

### 3️⃣ O Ponto Alto: Chat em Tempo Real entre PC e Celular
1. No PC (Admin) e no celular Android (Funcionário), abram a aba **chats**.
2. No PC, envie uma mensagem para o funcionário (ex: *"Olá, contrato revisado com sucesso!"* ou envie um emoji/foto).
3. A mensagem aparece no Android do seu amigo.
4. Seu amigo responde pelo celular Android e a mensagem atualiza instantaneamente no seu PC.
5. Mostre o recurso de **Apagar Mensagem** ("Apagar para mim" e "Apagar para todos").

### 4️⃣ Finalização: Cópia de Segurança (Backup)
1. No PC, abra o perfil do Administrador (`perfilAdm`).
2. Clique no botão de **Backup**:
   - Mostre o backup `backup_COOPERA_empresa1_CENARIO_APRESENTACAO_TCC.sql` gerado.
   - Explique que o sistema possui rotina de dump e restauração automática para segurança de dados corporativos.

---

> ✅ **Com esse roteiro e o projeto estruturado, o seu TCC está pronto para impressionar a banca e tirar nota máxima! Boa apresentação!**
