import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io.connect("http://localhost:3001");

const KEYBOARD_KEYS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"]
];

function App() {
  const [isInGame, setIsInGame] = useState(false);
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
  const [currentGuess, setCurrentGuess] = useState("");
  const [myGuesses, setMyGuesses] = useState([]); 
  const [roomData, setRoomData] = useState(null);
  
  const [statusMessage, setStatusMessage] = useState("");
  const [toastMessage, setToastMessage] = useState(""); 
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRoundEliminated, setIsRoundEliminated] = useState(false);
  
  // Estado para animação de erro
  const [shakeRow, setShakeRow] = useState(false);

  const nicknameRef = useRef("");
  const roomDataRef = useRef(null);

  useEffect(() => {
      roomDataRef.current = roomData;
  }, [roomData]);

  const showToast = (msg, duration = 1000) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(""), duration);
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
      setCurrentGuess("");
    });

    socket.on("round_winner_alert", ({ winner }) => {
        showToast(`🔔 ${winner} ACERTOU!`, 800);
    });

    socket.on("word_skipped_alert", (msg) => {
        showToast(`❌ ${msg}`, 1500);
    });

    socket.on("eliminated_round", () => {
        setIsRoundEliminated(true);
        showToast("💀 Bloqueado! Aguarde...", 1500);
    });

    // --- AVISO DE PALAVRA INVÁLIDA ---
    socket.on("invalid_word_alert", (msg) => {
        showToast(`🚫 ${msg}`, 1000);
        setShakeRow(true); // Ativa tremedeira
        setTimeout(() => setShakeRow(false), 500); // Desativa após 0.5s
    });

    socket.on("reset_board_force", () => {
        setMyGuesses([]);
        setCurrentGuess("");
        setIsRoundEliminated(false);
    });

    socket.on("game_over", (data) => {
      if (data.type === 'win') {
          setStatusMessage(`🏆 VENCEDOR: ${data.winner} (${data.score} pts)`);
      } else if (data.type === 'draw') {
          setStatusMessage(`🤝 EMPATE: ${data.winners} (${data.score} pts)`);
      } else {
          setStatusMessage(`💤 Tempo Esgotado! Ninguém pontuou.`);
      }
    });

    socket.on("back_to_lobby", () => {
        setMyGuesses([]);
        setStatusMessage("");
        setCurrentGuess("");
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
        if (!isInGame || statusMessage || isRoundEliminated || roomDataRef.current?.status !== 'playing') return;
        const key = e.key.toUpperCase();
        if (key === 'BACKSPACE') setCurrentGuess(prev => prev.slice(0, -1));
        else if (key === 'ENTER') handleEnter();
        else if (key.length === 1 && /^[A-Z]$/.test(key)) {
            if (currentGuess.length < 5) setCurrentGuess(prev => prev + key);
        }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isInGame, statusMessage, isRoundEliminated, currentGuess]);

  const handleNicknameChange = (e) => { setNickname(e.target.value); nicknameRef.current = e.target.value; };
  const createRoom = () => { if (!nickname) return alert("Digite um nick!"); socket.emit("create_room", nickname); };
  const handleJoin = (id, name) => { if (!name || !id) return alert("Dados incompletos!"); socket.emit("join_room", { roomId: id, nickname: name }); setIsInGame(true); };
  const startGame = () => { socket.emit("start_game_command", roomData.id); };
  const handleEnter = () => { if (currentGuess.length === 5) socket.emit("submit_guess", { roomId: roomDataRef.current?.id, guess: currentGuess }); };

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
        <h1>TERMO RUSH ⚡</h1>
        <div className="login-box">
            <input className="login-input" placeholder="Seu Apelido" value={nickname} onChange={handleNicknameChange} />
            <button onClick={createRoom}>CRIAR SALA</button>
            <div className="join-area">
                <input className="login-input" placeholder="Código da Sala" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
                <button onClick={() => handleJoin(roomCode, nickname)}>ENTRAR</button>
            </div>
        </div>
      </div>
    );
  }

  if (roomData && (roomData.status === 'waiting' || roomData.status === 'finished')) {
      const isHost = roomData.host === socket.id;
      return (
          <div className="container">
              {roomData.status === 'finished' && <div className="result-screen"><h2>{statusMessage}</h2><p>Reiniciando...</p></div>}
              <h1>{roomData.status === 'waiting' ? `LOBBY: ${roomData.id}` : "FIM DE JOGO"}</h1>
              <div className="lobby-list">
                  <h3>Último Placar:</h3>
                  <ul>
                    {roomData.players.sort((a, b) => b.score - a.score).map(p => (
                        <li key={p.id}>
                            {p.nickname} {p.id===roomData.host?"(👑)":""} - <strong>{p.score} pts</strong>
                        </li>
                    ))}
                  </ul>
              </div>
              {roomData.status === 'waiting' && (isHost ? <button className="start-btn" onClick={startGame}>NOVA PARTIDA</button> : <p className="blink">Aguardando anfitrião...</p>)}
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
      </div>
      <div className="center-area">
        <div className="board">
          {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
              const guessData = myGuesses[rowIndex];
              const isCurrentRow = rowIndex === myGuesses.length;
              
              if (guessData) {
                  return <div key={rowIndex} className="row">{guessData.word.split('').map((l, i) => <div key={i} className={`tile ${guessData.colors[i]}`}>{l}</div>)}</div>;
              } 
              else if (isCurrentRow && !isRoundEliminated && !statusMessage) {
                  // APLICANDO CLASSE SHAKE SE ESTIVER ERRADO
                  const rowClass = shakeRow ? "row current-row shake" : "row current-row";
                  return (
                    <div key={rowIndex} className={rowClass}>
                      {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`tile ${currentGuess[i]?'active-tile':'empty'}`}>{currentGuess[i]||""}</div>)}
                    </div>
                  );
              } 
              else return <div key={rowIndex} className="row">{[0,1,2,3,4].map(i=><div key={i} className="tile empty"></div>)}</div>;
          })}
        </div>
        <div className="keyboard">
            {KEYBOARD_KEYS.map((row, i) => <div key={i} className="keyboard-row">{row.map(key => <button key={key} className={`key-btn ${getKeyColor(key)}`} onClick={() => {if(currentGuess.length<5) setCurrentGuess(p=>p+key)}}>{key}</button>)}</div>)}
            <div className="keyboard-row"><button className="key-btn big-key" onClick={handleEnter}>ENTER</button><button className="key-btn big-key" onClick={() => setCurrentGuess(p=>p.slice(0,-1))}>⌫</button></div>
        </div>
      </div>
    </div>
  );
}

export default App;