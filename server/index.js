const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

// --- MUDANÇA 1: CARREGAMENTO INTELIGENTE DOS DICIONÁRIOS ---
let bancoRespostas = []; // Só palavras comuns para sortear
const mapaValidacao = new Map(); // Mapa para validar tudo e corrigir acentos

try {
    console.log("🔄 Carregando dicionários...");
    
    // Carrega os arquivos gerados pelo script 'gerar_bancos.js'
    const completo = require('./banco_completo.json');
    bancoRespostas = require('./banco_respostas.json');
    
    // Cria o Mapa: Chave SEM ACENTO -> Valor COM ACENTO
    // Ex: "AGUA" -> "ÁGUA"
    completo.forEach(palavra => {
        const chave = palavra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        mapaValidacao.set(chave, palavra);
    });
    
    console.log(`✅ Dicionários carregados! Sorteio: ${bancoRespostas.length} | Validação: ${mapaValidacao.size}`);
} catch (e) {
    console.error("❌ ERRO CRÍTICO: Arquivos 'banco_completo.json' ou 'banco_respostas.json' não encontrados.");
    console.error("Rode 'node gerar_bancos.js' antes de iniciar o servidor.");
    // Fallback de emergência
    bancoRespostas = ["TERMO", "NOBRE", "VAZIO", "HONRA", "SENHA", "AMIGO", "TEMPO", "CHUVA"];
    bancoRespostas.forEach(w => mapaValidacao.set(w, w));
}

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = {};
const roomTimers = {}; 
const ROUND_TIME = 60; // Tempo da partida em segundos

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// --- MUDANÇA 2: SORTEIO USA APENAS O BANCO DE RESPOSTAS ---
const getNewWord = (oldWord) => {
    if (bancoRespostas.length === 0) return "TERMO";
    
    let newWord = bancoRespostas[Math.floor(Math.random() * bancoRespostas.length)];
    
    // Tenta não repetir a palavra imediatamente anterior
    while (newWord === oldWord && bancoRespostas.length > 1) {
        newWord = bancoRespostas[Math.floor(Math.random() * bancoRespostas.length)];
    }
    return newWord; // Retorna a palavra já com acento (ex: "ÁGUA")
};

// --- CONTROLE DE TEMPO (INTACTO) ---
const stopTimer = (roomId) => {
    if (roomTimers[roomId]) {
        clearInterval(roomTimers[roomId]);
        delete roomTimers[roomId];
    }
};

const startRoomTimer = (roomId, io) => {
    stopTimer(roomId);
    const room = rooms[roomId];
    if (!room) return;

    room.timeLeft = ROUND_TIME;

    roomTimers[roomId] = setInterval(() => {
        if (!rooms[roomId]) return stopTimer(roomId);

        rooms[roomId].timeLeft -= 1;
        io.to(roomId).emit("timer_update", rooms[roomId].timeLeft);

        if (rooms[roomId].timeLeft <= 0) {
            finishGame(roomId, io);
        }
    }, 1000);
};

const finishGame = (roomId, io) => {
    stopTimer(roomId);
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'finished';

    const maxScore = Math.max(...room.players.map(p => p.score));
    const winners = room.players.filter(p => p.score === maxScore && p.score > 0);

    let resultData = {};
    if (winners.length === 0) {
        resultData = { type: 'fail', message: 'Ninguém pontuou!' };
    } else if (winners.length === 1) {
        resultData = { type: 'win', winner: winners[0].nickname, score: maxScore };
    } else {
        const names = winners.map(w => w.nickname).join(", ");
        resultData = { type: 'draw', winners: names, score: maxScore };
    }

    io.to(roomId).emit("game_over", resultData);

    setTimeout(() => returnToLobby(roomId, io), 4000);
};

const returnToLobby = (roomId, io) => {
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'waiting';
    room.timeLeft = ROUND_TIME;
    room.word = getNewWord("");
    
    room.players.forEach(p => {
        p.attempts = 0; 
        p.eliminated = false; 
        p.guesses = [];
    });

    io.to(roomId).emit("back_to_lobby");
    io.to(roomId).emit("update_room", room);
};

const forceNextWord = (room, io) => {
    room.word = getNewWord(room.word); 
    
    room.players.forEach(p => {
        p.attempts = 0;
        p.guesses = [];
        p.eliminated = false;
    });

    io.to(room.id).emit("reset_board_force");
    io.to(room.id).emit("update_room", room);
};

io.on("connection", (socket) => {
  
  socket.on("create_room", (nickname) => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      id: roomId,
      host: socket.id,
      word: getNewWord(""),
      players: [],
      status: 'waiting',
      timeLeft: ROUND_TIME,
    };
    socket.emit("room_created", roomId);
  });

  socket.on("join_room", ({ roomId, nickname }) => {
    if (rooms[roomId]) {
      const existingPlayerIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
      
      if (existingPlayerIndex !== -1) {
          rooms[roomId].players[existingPlayerIndex].nickname = nickname;
      } else {
          rooms[roomId].players.push({ 
              id: socket.id, 
              nickname, 
              score: 0, 
              attempts: 0, 
              guesses: [], 
              eliminated: false 
          });
      }
      
      socket.join(roomId);
      io.to(roomId).emit("update_room", rooms[roomId]);
    } else {
      socket.emit("error", "Sala não encontrada");
    }
  });

  socket.on("start_game_command", (roomId) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id && room.status === 'waiting') {
          room.status = 'playing';
          
          room.players.forEach(p => {
              p.score = 0;
              p.attempts = 0;
              p.guesses = [];
              p.eliminated = false;
          });

          io.to(roomId).emit("update_room", room);
          startRoomTimer(roomId, io);
      }
  });

  socket.on("submit_guess", ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    // --- MUDANÇA 3: VALIDAÇÃO E NORMALIZAÇÃO ---
    // 1. Normaliza o que o usuário mandou (AGUA -> AGUA)
    const guessClean = guess.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    // 2. Verifica se existe no mapa de validação
    if (!mapaValidacao.has(guessClean)) {
        socket.emit("invalid_word_alert", "Palavra desconhecida!");
        return;
    }

    // 3. Recupera a palavra formatada (AGUA -> ÁGUA)
    // Isso garante que a comparação de cores funcione se a palavra secreta tiver acento
    const guessFormatted = mapaValidacao.get(guessClean);

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    const secretWord = room.word; // Palavra secreta (já tem acento, ex: ÁGUA)
    player.attempts += 1;

    // Lógica de Cores (Termo) - Agora compara (ÁGUA vs ÁGUA)
    const feedback = [];
    const secretArr = secretWord.split('');
    const guessArr = guessFormatted.split(''); // Usa a formatada

    // Verde (Posição correta)
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === secretArr[i]) {
            feedback[i] = "green";
            secretArr[i] = null;
            guessArr[i] = null;
        }
    }
    
    // Amarelo (Letra errada)
    for (let i = 0; i < 5; i++) {
        if (guessArr[i]) { 
            const indexInSecret = secretArr.indexOf(guessArr[i]);
            if (indexInSecret !== -1) {
                feedback[i] = "yellow";
                secretArr[indexInSecret] = null;
            } else {
                feedback[i] = "gray";
            }
        }
    }

    // Salva a tentativa usando a palavra bonita (com acento)
    player.guesses.push({ word: guessFormatted, colors: feedback });

    // VERIFICAÇÃO DE VITÓRIA (Compara Strings com acento)
    if (guessFormatted === secretWord) { 
        player.score += 1;
        io.to(roomId).emit("round_winner_alert", { winner: player.nickname });
        forceNextWord(room, io);
        return;
    }

    // VERIFICAÇÃO DE DERROTA
    if (player.attempts >= 6) {
        player.eliminated = true;
        socket.emit("eliminated_round");
    }

    // VERIFICA SE TODOS PERDERAM
    const activePlayers = room.players.filter(p => !p.eliminated);
    if (activePlayers.length === 0) {
        io.to(roomId).emit("word_skipped_alert", `Ninguém acertou! A palavra era: ${secretWord}`);
        forceNextWord(room, io);
    } else {
        socket.emit("guess_feedback", player.guesses);
        io.to(roomId).emit("update_room", room);
    }
  });
  
  socket.on("disconnect", () => {
      // Lógica de desconexão
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SERVER RODANDO NA PORTA ${PORT}`));