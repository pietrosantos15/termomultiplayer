import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";
import { FaLinkedin } from "react-icons/fa";
import { getRandomWord, getWordFromList } from "./words"; 

const socket = io.connect("https://servertermomultiplayer.onrender.com/");

const KEYBOARD_KEYS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"]
];


const removeAccents = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

function App() {
  const [isInGame, setIsInGame] = useState(false);
  const [gameMode, setGameMode] = useState(null); 
  
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
  const [currentGuess, setCurrentGuess] = useState(Array(5).fill(""));
  const [activeTileIndex, setActiveTileIndex] = useState(0);
  
  const [myGuesses, setMyGuesses] = useState([]); 
  const [roomData, setRoomData] = useState(null);
  
  const [statusMessage, setStatusMessage] = useState("");
  const [toastMessage, setToastMessage] = useState(""); 
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRoundEliminated, setIsRoundEliminated] = useState(false);
  
  const [shakeRow, setShakeRow] = useState(false);

  const [soloSecret, setSoloSecret] = useState("");
  const [soloFinished, setSoloFinished] = useState(false);

  const nicknameRef = useRef("");
  const roomDataRef = useRef(null);

  const isWinner = myGuesses.length > 0 && 
                   myGuesses[myGuesses.length - 1].colors.every(c => c === 'green');

  useEffect(() => {
      roomDataRef.current = roomData;
  }, [roomData]);

  const showToast = (msg, duration = 3000) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(""), duration);
  };

  const startSoloGame = () => {
      const secret = getRandomWord();
      setGameMode('solo');
      setSoloSecret(secret);
      console.log("Modo Solo Iniciado. Palavra:", secret); 
      
      setIsInGame(true);
      setMyGuesses([]);
      setCurrentGuess(Array(5).fill(""));
      setActiveTileIndex(0);
      setSoloFinished(false);
      setStatusMessage("");
  };

  // --- LÓGICA CORRIGIDA: AUTOCORREÇÃO DE ACENTOS ---
  const verifySoloGuess = (guessInput) => {
      // 1. Busca a palavra formatada na lista (Ex: Digitou LITIO, recebe LÍTIO)
      const officialWord = getWordFromList(guessInput);

      if (!officialWord) {
          showToast("Palavra não existe!", 1000);
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 500);
          return;
      }

      // 2. Normaliza para comparar as letras (LÍTIO -> LITIO vs LITIO)
      const secretClean = removeAccents(soloSecret);
      const guessClean = removeAccents(officialWord);
      
      const colors = Array(5).fill("gray");
      const secretLetterCounts = {};

      for (const char of secretClean) {
          secretLetterCounts[char] = (secretLetterCounts[char] || 0) + 1;
      }

      // Verde
      for (let i = 0; i < 5; i++) {
          if (guessClean[i] === secretClean[i]) {
              colors[i] = "green";
              secretLetterCounts[guessClean[i]]--;
          }
      }

      // Amarelo
      for (let i = 0; i < 5; i++) {
          if (colors[i] !== "green") {
              const letter = guessClean[i];
              if (secretLetterCounts[letter] > 0) {
                  colors[i] = "yellow";
                  secretLetterCounts[letter]--;
              }
          }
      }

      // 3. Salva no histórico a palavra OFICIAL (com acento) para exibir na tela
      const newHistory = [...myGuesses, { word: officialWord, colors }];
      setMyGuesses(newHistory);
      setCurrentGuess(Array(5).fill(""));
      setActiveTileIndex(0);

      const won = colors.every(c => c === 'green');
      
      if (won) {
          setSoloFinished(true);
          showToast(`Acertou! A palavra era ${soloSecret}`, 1000);
          setTimeout(() => startSoloGame(), 500);
      } 
      else if (newHistory.length === 6) {
          setSoloFinished(true);
          setStatusMessage(`💀 PERDEU! A palavra era: ${soloSecret}`);
      }
  };

  const handleInputChar = (char) => {
      if (activeTileIndex > 4 || isWinner || isRoundEliminated || soloFinished) return;
      const newGuess = [...currentGuess];
      newGuess[activeTileIndex] = char;
      setCurrentGuess(newGuess);
      if (activeTileIndex < 4) setActiveTileIndex(activeTileIndex + 1);
  };

  const handleBackspace = () => {
      if (isWinner || isRoundEliminated || soloFinished) return;
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
      if (isWinner || isRoundEliminated || soloFinished) return;
      const word = currentGuess.join("");
      if (word.length === 5 && !currentGuess.includes("")) {
          if (gameMode === 'solo') {
              verifySoloGuess(word);
          } else {
              socket.emit("submit_guess", { roomId: roomDataRef.current?.id, guess: word }); 
          }
      } else {
          showToast("Complete a palavra!", 1000);
          setShakeRow(true);
          setTimeout(() => setShakeRow(false), 500);
      }
  };

  const handleExit = () => { window.location.reload(); };

  const getKeyColor = (key) => {
      let finalColor = ""; 
      for (const guess of myGuesses) {
          const guessClean = removeAccents(guess.word);
          for (let i = 0; i < 5; i++) {
              if (guessClean[i] === key) {
                  const color = guess.colors[i];
                  if (color === 'green') return 'green-key';
                  if (color === 'yellow') finalColor = 'yellow-key';
                  else if (color === 'gray' && finalColor === "") finalColor = 'gray-key';
              }
          }
      }
      return finalColor;
  };

  useEffect(() => {
    socket.on("room_created", (id) => { setRoomCode(id); handleJoin(id, nicknameRef.current); });
    socket.on("update_room", (data) => setRoomData(data));
    socket.on("timer_update", (time) => setTimeLeft(time));
    socket.on("guess_feedback", (history) => { setMyGuesses(history); setCurrentGuess(Array(5).fill("")); setActiveTileIndex(0); });
    socket.on("round_winner_alert", (data) => {
        const secretWord = data.word; 
        if (secretWord) showToast(`🔔 ${data.winner} ACERTOU! A palavra era: ${secretWord}`, 1500);
        else showToast(`🔔 ${data.winner} ACERTOU!`, 1500);
    });
    socket.on("word_skipped_alert", (msg) => showToast(`❌ ${msg}`, 3000));
    socket.on("eliminated_round", () => { setIsRoundEliminated(true); showToast("💀 Bloqueado! Aguarde...", 1500); });
    socket.on("invalid_word_alert", (msg) => { showToast(`🚫 ${msg}`, 1000); setShakeRow(true); setTimeout(() => setShakeRow(false), 500); });
    socket.on("reset_board_force", () => { setMyGuesses([]); setCurrentGuess(Array(5).fill("")); setActiveTileIndex(0); setIsRoundEliminated(false); });
    socket.on("game_over", (data) => {
      const reveal = data.word ? ` (Era: ${data.word})` : "";
      if (data.type === 'win') setStatusMessage(`🏆 VENCEDOR: ${data.winner} (${data.score} pts)${reveal}`);
      else if (data.type === 'draw') setStatusMessage(`🤝 EMPATE: ${data.winners} (${data.score} pts)${reveal}`);
      else setStatusMessage(`💤 Tempo Esgotado! A palavra era: ${data.word || '?'}`);
    });
    socket.on("back_to_lobby", () => { setMyGuesses([]); setStatusMessage(""); setCurrentGuess(Array(5).fill("")); setActiveTileIndex(0); setIsRoundEliminated(false); setToastMessage(""); });

    return () => {
      socket.off("room_created"); socket.off("update_room"); socket.off("timer_update"); socket.off("guess_feedback");
      socket.off("round_winner_alert"); socket.off("word_skipped_alert"); socket.off("eliminated_round");
      socket.off("reset_board_force"); socket.off("game_over"); socket.off("back_to_lobby"); socket.off("invalid_word_alert");
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
        const isMultiPlaying = roomDataRef.current?.status === 'playing';
        const isSoloPlaying = gameMode === 'solo' && !soloFinished;
        if (!isInGame || (statusMessage && !isSoloPlaying) || isRoundEliminated || isWinner) return;
        if (gameMode === 'multi' && !isMultiPlaying) return;
        
        const key = e.key.toUpperCase();
        if (key === 'BACKSPACE') handleBackspace();
        else if (key === 'ENTER') handleEnter();
        else if (key === 'ARROWLEFT') setActiveTileIndex(p => Math.max(0, p - 1));
        else if (key === 'ARROWRIGHT') setActiveTileIndex(p => Math.min(4, p + 1));
        else if (key.length === 1 && /^[A-Z]$/.test(key)) handleInputChar(key);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isInGame, statusMessage, isRoundEliminated, isWinner, currentGuess, activeTileIndex, gameMode, soloFinished]);

  const handleNicknameChange = (e) => { setNickname(e.target.value); nicknameRef.current = e.target.value; };
  const createRoom = () => { if (!nickname) return alert("Digite um nick!"); setGameMode('multi'); socket.emit("create_room", nickname); };
  const handleJoin = (id, name) => { if (!name || !id) return alert("Dados incompletos!"); setGameMode('multi'); socket.emit("join_room", { roomId: id, nickname: name }); setIsInGame(true); };
  const startGame = () => { socket.emit("start_game_command", roomData.id); };

  if (!isInGame) {
    return (
      <div className="container">
        <h1>TERMO MULTIPLAYER</h1>
        <div className="login-box">
            <input className="login-input" placeholder="Seu Apelido" value={nickname} onChange={handleNicknameChange} />
            <div className="buttons-row">
                <button onClick={createRoom}>CRIAR SALA</button>
                <button style={{backgroundColor: '#b59f3b'}} onClick={startSoloGame}>Modo Treino</button>
            </div>
            <div className="join-area">
                <input className="login-input" placeholder="Código da Sala" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                <button onClick={() => handleJoin(roomCode, nickname)}>ENTRAR</button> <br />
            </div>
            <h3>Feito por: Pietro Santos</h3>
            <a href="https://www.linkedin.com/in/pietro-santos-609a11315/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', marginTop: '15px', cursor: 'pointer' }}>
              <span style={{ color: 'white', fontSize: '16px' }}>Entre em contato:</span>
              <FaLinkedin size={30} color="#0077b5" />
            </a>
        </div>
      </div>
    );
  }

  if (gameMode === 'multi' && roomData && (roomData.status === 'waiting' || roomData.status === 'finished')) {
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
                                <span className="player-name">{p.nickname} {p.id === roomData.host ? "👑" : ""}</span>
                                <span className="player-score">{p.score} pts</span>
                            </li>
                        ))}
                      </ul>
                  </div>
                  <div className="lobby-actions">
                    {roomData.status === 'waiting' && (
                        isHost ? <button className="btn-main" onClick={startGame}>INICIAR PARTIDA</button> : <div className="waiting-msg"><p className="blink">Aguardando anfitrião...</p></div>
                    )}
                    <button className="btn-secondary" onClick={handleExit}>SAIR DA SALA</button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="game-container">
      {toastMessage && <div className="toast-overlay">{toastMessage}</div>}
      
      <div className="sidebar">
        {gameMode === 'multi' ? (
            <>
                <div className="timer-box" style={{color: timeLeft < 10 ? 'red' : '#d3ad69'}}>⏰ {timeLeft}s</div>
                <h3>Ranking</h3>
                <ul>{roomData?.players.sort((a, b) => b.score - a.score).map(p => <li key={p.id} style={{border: p.id===socket.id?'1px solid #d3ad69':'none'}}><span>{p.nickname}</span><strong>{p.score}</strong></li>)}</ul>
            </>
        ) : (
            <div className="solo-info" style={{textAlign: 'center', padding: '10px'}}>
                <h3 style={{color: '#b59f3b'}}>MODO TREINO</h3>
                <p>Adivinhe a palavra!</p>
                {statusMessage && <div className="solo-status" style={{marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem', color: statusMessage.includes("PERDEU") ? '#d9534f' : '#538d4e'}}>{statusMessage}</div>}
                
                {soloFinished && statusMessage.includes("PERDEU") && (
                    <button onClick={startSoloGame} style={{ marginTop: '15px', padding: '10px 20px', backgroundColor: '#538d4e', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>CONTINUAR ↻</button>
                )}
            </div>
        )}
        
        <div style={{marginTop: '20px'}}>
            <button onClick={handleExit} style={{ width: '100%', backgroundColor: '#d9534f', color: 'white', padding: '8px', fontSize: '0.8rem'}}>
                {gameMode === 'multi' ? 'SAIR DA SALA' : 'VOLTAR AO MENU'}
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
              else if (isCurrentRow && !isRoundEliminated && !soloFinished && (!statusMessage || gameMode === 'solo') && !isWinner) {
                  const rowClass = shakeRow ? "row current-row shake" : "row current-row";
                  return (
                    <div key={rowIndex} className={rowClass}>
                      {[0, 1, 2, 3, 4].map((i) => {
                          const letter = currentGuess[i];
                          const isActive = i === activeTileIndex;
                          return <div key={i} className={`tile ${letter ? 'active-tile' : 'empty'} ${isActive ? 'selected-cursor' : ''}`} onClick={() => setActiveTileIndex(i)}>{letter}</div>
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
                        <button key={key} className={`key-btn ${getKeyColor(key)}`} onClick={() => handleInputChar(key)} disabled={isWinner || soloFinished}>{key}</button>
                    ))}
                </div>
            ))}
            <div className="keyboard-row">
                <button className="key-btn big-key" onClick={handleEnter} disabled={isWinner || soloFinished}>ENTER</button>
                <button className="key-btn big-key" onClick={handleBackspace} disabled={isWinner || soloFinished}>⌫</button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;