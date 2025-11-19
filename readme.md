# 🎮 Termo Multiplayer 

Este é um jogo de palavras multiplayer em tempo real, inspirado no famoso "Termo" (Wordle). O projeto foi desenvolvido para permitir competições rápidas entre amigos ou desconhecidos, onde o primeiro a acertar a palavra secreta vence a rodada e ganha pontos no ranking.

A dinâmica é estilo "Battle Royale": todos jogam simultaneamente e o tempo não para. Quem for mais rápido e preciso, vence!

---
## 🚀 Tecnologias Utilizadas

Frontend (Cliente)

React.js → Biblioteca para construção da interface.

Vite → Ferramenta de build rápida.

Socket.io-client → Para comunicação em tempo real com o servidor.

CSS3 → Estilização responsiva e moderna.

React Icons → Ícones para interface.

Backend (Servidor)

Node.js → Ambiente de execução JavaScript.

Express → Framework para servidor web.

Socket.io → Motor de comunicação bidirecional em tempo real.

Cors → Gerenciamento de origens cruzadas.

FS (File System) → Leitura de dicionários de palavras locais.

---

## #📜 Funcionalidades

Multiplayer em Tempo Real:

Conexão instantânea via WebSockets.

Salas privadas com códigos únicos

Competição: todos tentam adivinhar a mesma palavra.

Vitória Instantânea: Assim que um jogador acerta, a rodada acaba para todos e uma nova palavra é sorteada imediatamente.

Ranking ao Vivo: Placar atualizado em tempo real na lateral.

Sistema de Palavras Robusto:

Validação Completa: Aceita mais de 200.000 palavras válidas

Sorteio Inteligente: Sorteia apenas palavras comuns (fáceis/médias) para a resposta, evitando palavras incomuns.


Interface Intuitiva:

Teclado virtual interativo que pinta as letras (Verde/Amarelo/Cinza).

Animações de erro (tremida) e acerto.

Timer global de 60 segundos por partida.

---

## 🛠️ Como Rodar o Projeto Localmente

Siga os passos abaixo para ter o jogo rodando no seu computador.

Pré-requisitos

Ter o Node.js instalado.

Ter o Git instalado.

1. Clonar o Repositório

Abra o terminal e digite:
```bash
git clone [https://github.com/seu-usuario/termo-multiplayer.git](https://github.com/seu-usuario/termo-multiplayer.git)

cd termo-multiplayer
```

2. Configurar e Rodar o Servidor (Backend)

Abra um terminal na pasta server:
```bash

cd server
npm install       # Instala as dependências
node gerar_bancos.js # Gera os arquivos JSON de palavras
node index.js     # Inicia o servidor na porta 3001
```

Você verá a mensagem: 🚀 Servidor (HTTP + Socket) rodando na porta 3001

3. Configurar e Rodar o Cliente (Frontend)

```bash
Abra outro terminal na pasta client (ou na raiz, dependendo de onde colocou):

cd client
npm install       # Instala as dependências (React, Vite, etc)
npm run dev       # Inicia o site
```

O terminal mostrará um link local (ex: http://localhost:5173). Clique nele para jogar!

---

## 🌐 Hospedagem (Deploy)

O projeto está configurado para funcionar em arquitetura separada:

Frontend: Hospedado na Vercel (para entrega rápida de arquivos estáticos).

Backend: Hospedado no Render (para manter o servidor Socket.io rodando).

👨‍💻 Autor: Pietro Santos



Entre em contato para feedbacks ou sugestões!

Linkedin: https://www.linkedin.com/in/pietro-santos-609a11315/

⚠️ **O projeto ainda não está 100% pronto** ⚠️