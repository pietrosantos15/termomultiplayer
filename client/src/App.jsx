import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";
import { FaLinkedin } from "react-icons/fa";

// SE ESTIVER RODANDO LOCALMENTE, USE "http://localhost:3001"
const socket = io.connect("https://servertermomultiplayer.onrender.com/");

const KEYBOARD_KEYS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"]
];

function App() {
  const [isInGame, setIsInGame] = useState(false);
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
  // ARRAY DE 5 POSIÇÕES
  const [currentGuess, setCurrentGuess] = useState(Array(5).fill(""));
  const [activeTileIndex, setActiveTileIndex] = useState(0);
  
  const [myGuesses, setMyGuesses] = useState([]); 
  const [roomData, setRoomData] = useState(null);
  
  const [statusMessage, setStatusMessage] = useState("");
  const [toastMessage, setToastMessage] = useState(""); 
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRoundEliminated, setIsRoundEliminated] = useState(false);
  
  const [shakeRow, setShakeRow] = useState(false);

  const nicknameRef = useRef("");
  const roomDataRef = useRef(null);

  // --- Verifica se o jogador atual já ganhou a rodada ---
  const isWinner = myGuesses.length > 0 && 
                   myGuesses[myGuesses.length - 1].colors.every(c => c === 'green');

  useEffect(() => {
      roomDataRef.current = roomData;
  }, [roomData]);

  const showToast = (msg, duration = 3000) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(""), duration);
  };

  const handleInputChar = (char) => {
      if (activeTileIndex > 4 || isWinner || isRoundEliminated) return;
      
      const newGuess = [...currentGuess];
      newGuess[activeTileIndex] = char;
      setCurrentGuess(newGuess);
      
      if (activeTileIndex < 4) {
          setActiveTileIndex(activeTileIndex + 1);
      }
  };

  const handleBackspace = () => {
      if (isWinner || isRoundEliminated) return;

      const newGuess = [...currentGuess];
      if (newGuess[activeTileIndex] !== "") {
          newGuess[activeTileIndex] = "";
          setCurrentGuess(newGuess);
      } else if (activeTileIndex > 0) {
          const newIndex = activeTileIndex - 1;
          setActiveTileIndex(newIndex);
          newGuess[newIndex] = "";
          setCurrentGuess(newGuess);
      }
  };

  const handleEnter = () => { 
      if (isWinner || isRoundEliminated) return;

      const word = currentGuess.join("");
      if (word.length === 5 && !currentGuess.includes("")) {
          socket.emit("submit_guess", { roomId: roomDataRef.current?.id, guess: word }); 
      } else {
          showToast("Complete a palavra!", 1000);
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 500);
      }
  };

  // --- Função para sair da sala e voltar ao início ---
  const handleExit = () => {
      window.location.reload(); 
  };

  useEffect(() => {
    socket.on("room_created", (id) => {
      setRoomCode(id);
      handleJoin(id, nicknameRef.current);
    });

    socket.on("update_room", (data) => setRoomData(data));
    socket.on("timer_update", (time) => setTimeLeft(time));
    
    socket.on("guess_feedback", (history) => {
      setMyGuesses(history);
      setCurrentGuess(Array(5).fill(""));
      setActiveTileIndex(0);
    });

    socket.on("round_winner_alert", (data) => {
        const winnerName = data.winner;
        const secretWord = data.word; 

        // --- ALTERADO: Tempo reduzido de 4000 para 1500ms ---
        if (secretWord) {
            showToast(`🔔 ${winnerName} ACERTOU! A palavra era: ${secretWord}`, 1500);
        } else {
            showToast(`🔔 ${winnerName} ACERTOU!`, 1500);
        }
    });

    socket.on("word_skipped_alert", (msg) => {
        showToast(`❌ ${msg}`, 3000);
    });

    socket.on("eliminated_round", () => {
        setIsRoundEliminated(true);
        showToast("💀 Bloqueado! Aguarde...", 1500);
    });

    socket.on("invalid_word_alert", (msg) => {
        showToast(`🚫 ${msg}`, 1000);
        setShakeRow(true); 
        setTimeout(() => setShakeRow(false), 500); 
    });

    socket.on("reset_board_force", () => {
        setMyGuesses([]);
        setCurrentGuess(Array(5).fill(""));
        setActiveTileIndex(0);
        setIsRoundEliminated(false);
    });

    socket.on("game_over", (data) => {
      const reveal = data.word ? ` (Era: ${data.word})` : "";
      
      if (data.type === 'win') {
          setStatusMessage(`🏆 VENCEDOR: ${data.winner} (${data.score} pts)${reveal}`);
      } else if (data.type === 'draw') {
          setStatusMessage(`🤝 EMPATE: ${data.winners} (${data.score} pts)${reveal}`);
      } else {
          setStatusMessage(`💤 Tempo Esgotado! A palavra era: ${data.word || '?'}`);
      }
    });

    socket.on("back_to_lobby", () => {
        setMyGuesses([]);
        setStatusMessage("");
        setCurrentGuess(Array(5).fill(""));
        setActiveTileIndex(0);
        setIsRoundEliminated(false);
        setToastMessage("");
    });

    return () => {
      socket.off("room_created"); socket.off("update_room"); socket.off("timer_update");
      socket.off("guess_feedback"); socket.off("round_winner_alert"); socket.off("word_skipped_alert");
      socket.off("eliminated_round"); socket.off("reset_board_force"); socket.off("game_over");
      socket.off("back_to_lobby"); socket.off("invalid_word_alert");
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
        if (!isInGame || statusMessage || isRoundEliminated || isWinner || roomDataRef.current?.status !== 'playing') return;
        
        const key = e.key.toUpperCase();
        
        if (key === 'BACKSPACE') handleBackspace();
        else if (key === 'ENTER') handleEnter();
        else if (key === 'ARROWLEFT') setActiveTileIndex(p => Math.max(0, p - 1));
        else if (key === 'ARROWRIGHT') setActiveTileIndex(p => Math.min(4, p + 1));
        else if (key.length === 1 && /^[A-Z]$/.test(key)) {
            handleInputChar(key);
        }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isInGame, statusMessage, isRoundEliminated, isWinner, currentGuess, activeTileIndex]);

  const handleNicknameChange = (e) => { setNickname(e.target.value); nicknameRef.current = e.target.value; };
  const createRoom = () => { if (!nickname) return alert("Digite um nick!"); socket.emit("create_room", nickname); };
  const handleJoin = (id, name) => { if (!name || !id) return alert("Dados incompletos!"); socket.emit("join_room", { roomId: id, nickname: name }); setIsInGame(true); };
  const startGame = () => { socket.emit("start_game_command", roomData.id); };
  
  const getKeyColor = (key) => {
      let color = "";
      for (let guess of myGuesses) {
          const wordArr = guess.word.split("");
          const index = wordArr.indexOf(key);
          if (index !== -1) {
              const c = guess.colors[index];
              if (c === 'green') return 'green-key';
              if (c === 'yellow' && color !== 'green-key') color = 'yellow-key';
              if (c === 'gray' && color === "") color = 'gray-key';
          }
           for(let i=0; i<5; i++) if(wordArr[i]===key) { if(guess.colors[i]==='green') return 'green-key'; }
      }
      return color;
  };

  if (!isInGame) {
    return (
      <div className="container">
        <h1>TERMO MULTIPLAYER</h1>
        <div className="login-box">
            <input className="login-input" placeholder="Seu Apelido" value={nickname} onChange={handleNicknameChange} />
            
            <button onClick={createRoom}>CRIAR SALA</button>
            
            <div className="join-area">
                <input className="login-input" placeholder="Código da Sala" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                <button onClick={() => handleJoin(roomCode, nickname)}>ENTRAR</button> <br />
            </div>
            
            <h3>Feito por: Pietro Santos</h3>
            
            <a 
              href="https://www.linkedin.com/in/pietro-santos-609a11315/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{    
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                textDecoration: 'none', 
                marginTop: '15px',
                cursor: 'pointer'
              }}
            >
              <span style={{ color: 'white', fontSize: '16px' }}>Entre em contato:</span>
              <FaLinkedin size={30} color="#0077b5" />
            </a>
        </div>
      </div>
    );
  }

  if (roomData && (roomData.status === 'waiting' || roomData.status === 'finished')) {
      const isHost = roomData.host === socket.id;
      return (
          <div className="container">
              <div className="lobby-card">
                  {roomData.status === 'finished' && (
                      <div className="result-header">
                          <h2>FIM DE JOGO</h2>
                          <p className="winner-msg">{statusMessage}</p>
                      </div>
                  )}
                  
                  <h1 className="room-title">{roomData.status === 'waiting' ? `SALA: ${roomData.id}` : "PLACAR FINAL"}</h1>
                  
                  <div className="lobby-list">
                      <h3>Jogadores:</h3>
                      <ul>
                        {roomData.players.sort((a, b) => b.score - a.score).map(p => (
                            <li key={p.id} className={p.id === socket.id ? "my-player" : ""}>
                                <span className="player-name">
                                    {p.nickname} {p.id === roomData.host ? "👑" : ""}
                                </span>
                                <span className="player-score">{p.score} pts</span>
                            </li>
                        ))}
                      </ul>
                  </div>
                  
                  <div className="lobby-actions">
                    {roomData.status === 'waiting' && (
                        isHost ? 
                        <button className="btn-main" onClick={startGame}>INICIAR PARTIDA</button> : 
                        <div className="waiting-msg"><p className="blink">Aguardando anfitrião...</p></div>
                    )}
                    
                    <button className="btn-secondary" onClick={handleExit}>
                        SAIR DA SALA
                    </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="game-container">
      {toastMessage && <div className="toast-overlay">{toastMessage}</div>}
      <div className="sidebar">
        <div className="timer-box" style={{color: timeLeft < 10 ? 'red' : '#d3ad69'}}>⏰ {timeLeft}s</div>
        <h3>Ranking</h3>
        <ul>{roomData?.players.sort((a, b) => b.score - a.score).map(p => <li key={p.id} style={{border: p.id===socket.id?'1px solid #d3ad69':'none'}}><span>{p.nickname}</span><strong>{p.score}</strong></li>)}</ul>
        
        <div style={{marginTop: '20px'}}>
            <button 
                onClick={handleExit} 
                style={{ 
                    width: '100%', 
                    backgroundColor: '#d9534f', 
                    color: 'white',
                    padding: '8px',
                    fontSize: '0.8rem'
                }}
            >
                SAIR DA SALA
            </button>
        </div>

      </div>
      <div className="center-area">
        <div className="board">
          {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
              const guessData = myGuesses[rowIndex];
              const isCurrentRow = rowIndex === myGuesses.length;
              
              if (guessData) {
                  return <div key={rowIndex} className="row">{guessData.word.split('').map((l, i) => <div key={i} className={`tile ${guessData.colors[i]}`}>{l}</div>)}</div>;
              } 
              else if (isCurrentRow && !isRoundEliminated && !statusMessage && !isWinner) {
                  const rowClass = shakeRow ? "row current-row shake" : "row current-row";
                  return (
                    <div key={rowIndex} className={rowClass}>
                      {[0, 1, 2, 3, 4].map((i) => {
                          const letter = currentGuess[i];
                          const isActive = i === activeTileIndex;
                          return (
                            <div 
                                key={i} 
                                className={`tile ${letter ? 'active-tile' : 'empty'} ${isActive ? 'selected-cursor' : ''}`}
                                onClick={() => setActiveTileIndex(i)} 
                            >
                                {letter}
                            </div>
                          )
                      })}
                    </div>
                  );
              } 
              else return <div key={rowIndex} className="row">{[0,1,2,3,4].map(i=><div key={i} className="tile empty"></div>)}</div>;
          })}
        </div>
        <div className="keyboard">
            {KEYBOARD_KEYS.map((row, i) => (
                <div key={i} className="keyboard-row">
                    {row.map(key => (
                        <button 
                            key={key} 
                            className={`key-btn ${getKeyColor(key)}`} 
                            onClick={() => handleInputChar(key)}
                            disabled={isWinner}
                            style={{ opacity: isWinner ? 0.5 : 1 }}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            ))}
            <div className="keyboard-row">
                <button className="key-btn big-key" onClick={handleEnter} disabled={isWinner}>ENTER</button>
                <button className="key-btn big-key" onClick={handleBackspace} disabled={isWinner}>⌫</button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;