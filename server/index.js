const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

// --- CARREGAMENTO INTELIGENTE DOS DICIONÁRIOS ---
let bancoRespostas = []; 
const mapaValidacao = new Map(); 

try {
    console.log("🔄 Carregando dicionários...");
    const completo = require('./banco_completo.json');
    bancoRespostas = require('./banco_respostas.json');
    
    completo.forEach(palavra => {
        const chave = palavra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        mapaValidacao.set(chave, palavra);
    });
    
    console.log(`✅ Dicionários carregados! Sorteio: ${bancoRespostas.length} | Validação: ${mapaValidacao.size}`);
} catch (e) {
    console.error("❌ ERRO: Dicionários não encontrados. Usando fallback.");
    bancoRespostas = ["TERMO", "NOBRE", "VAZIO", "HONRA", "SENHA", "AMIGO", "TEMPO", "CHUVA"];
    bancoRespostas.forEach(w => mapaValidacao.set(w, w));
}

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("Servidor rodando! 🚀");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = {};
const roomTimers = {}; 
const ROUND_TIME = 60; 

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const getNewWord = (oldWord) => {
    if (bancoRespostas.length === 0) return "TERMO";
    let newWord = bancoRespostas[Math.floor(Math.random() * bancoRespostas.length)];
    while (newWord === oldWord && bancoRespostas.length > 1) {
        newWord = bancoRespostas[Math.floor(Math.random() * bancoRespostas.length)];
    }
    return newWord; 
};

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
        
        if (rooms[roomId].status === 'playing') {
            rooms[roomId].timeLeft -= 1;
            io.to(roomId).emit("timer_update", rooms[roomId].timeLeft);

            if (rooms[roomId].timeLeft <= 0) {
                finishGame(roomId, io);
            }
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
    
    // --- AQUI: GARANTE QUE A PALAVRA É ENVIADA NO FIM DO JOGO ---
    if (winners.length === 0) {
        resultData = { type: 'fail', message: 'Ninguém pontuou!', word: room.word };
    } else if (winners.length === 1) {
        resultData = { type: 'win', winner: winners[0].nickname, score: maxScore, word: room.word };
    } else {
        const names = winners.map(w => w.nickname).join(", ");
        resultData = { type: 'draw', winners: names, score: maxScore, word: room.word };
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
    room.status = 'playing'; 
    
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

    const guessClean = guess.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    if (!mapaValidacao.has(guessClean)) {
        socket.emit("invalid_word_alert", "Palavra desconhecida!");
        return;
    }

    const guessFormatted = mapaValidacao.get(guessClean);
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    const secretWord = room.word; 
    player.attempts += 1;

    const feedback = [];
    const secretArr = secretWord.split('');
    const guessArr = guessFormatted.split('');

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === secretArr[i]) {
            feedback[i] = "green";
            secretArr[i] = null;
            guessArr[i] = null;
        }
    }
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

    player.guesses.push({ word: guessFormatted, colors: feedback });

    // --- VERIFICAÇÃO DE VITÓRIA ---
    if (guessFormatted === secretWord) { 
        console.log(`🏆 VENCEDOR DETECTADO: ${player.nickname} acertou a palavra: ${secretWord}`); // LOG PARA DEBUG
        
        room.status = 'resetting'; 
        player.score += 1;

        socket.emit("guess_feedback", player.guesses);
        
        // MANDA A PALAVRA AQUI
        io.to(roomId).emit("round_winner_alert", { winner: player.nickname, word: secretWord });

        setTimeout(() => {
            forceNextWord(room, io);
        }, 3000);
        return;
    }

    if (player.attempts >= 6) {
        player.eliminated = true;
        socket.emit("eliminated_round");
    }

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