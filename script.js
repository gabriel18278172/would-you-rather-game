/* ==============================================
   Would You Rather — script.js
   Solo mode + PeerJS WebRTC multiplayer
   ============================================== */

'use strict';

// ---- State ----
const state = {
  mode: 'solo',          // 'solo' | 'host' | 'client'
  questions: [],         // shuffled question list
  currentIndex: 0,
  voted: false,
  votesA: 0,
  votesB: 0,
  // Multiplayer
  peer: null,
  connections: [],       // host: list of DataConnection
  hostConn: null,        // client: connection to host
  roomCode: '',
  players: [],           // [{ id, name }]
  myName: '',
  isHost: false,
  pendingVotes: {},      // id -> 'A' | 'B'
  gameStarted: false,
};

// ---- Question pool ----
let usedIndices = new Set();

function getShuffledQuestions() {
  // Fisher-Yates shuffle on indices
  const indices = Array.from({ length: questions.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function nextUnusedQuestion() {
  if (state.questions.length === 0 || usedIndices.size >= state.questions.length) {
    // Reset
    usedIndices.clear();
    state.questions = getShuffledQuestions();
    state.currentIndex = 0;
  }
  while (usedIndices.has(state.questions[state.currentIndex])) {
    state.currentIndex = (state.currentIndex + 1) % state.questions.length;
  }
  const idx = state.questions[state.currentIndex];
  usedIndices.add(idx);
  state.currentIndex = (state.currentIndex + 1) % state.questions.length;
  return questions[idx];
}

// ---- DOM helpers ----
const $ = id => document.getElementById(id);
const screens = {};

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = $('screen-' + name);
  if (s) s.classList.add('active');
}

let toastTimer;
function showToast(msg, duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function setStatus(id, msg, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.style.display = msg ? '' : 'none';
}

function updatePlayerBadge() {
  const count = state.players.length;
  const badge = $('player-badge-count');
  if (badge) badge.textContent = count + ' player' + (count !== 1 ? 's' : '');
}

function renderPlayerList(containerId) {
  const container = $(containerId);
  if (!container) return;
  const colors = ['#4f46e5','#f97316','#06b6d4','#22c55e','#a855f7','#ef4444','#eab308'];
  container.innerHTML = state.players.map((p, i) => `
    <span class="player-chip">
      <span class="avatar" style="background:${colors[i % colors.length]}">${p.name.charAt(0).toUpperCase()}</span>
      ${escHtml(p.name)}${p.id === state.myName ? ' (you)' : ''}
    </span>
  `).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- SOLO MODE ----
function startSolo() {
  state.mode = 'solo';
  state.voted = false;
  state.votesA = 0;
  state.votesB = 0;
  usedIndices.clear();
  state.questions = getShuffledQuestions();
  state.currentIndex = 0;
  showScreen('solo-game');
  loadSoloQuestion();
}

function loadSoloQuestion() {
  const q = nextUnusedQuestion();
  state.voted = false;
  state.votesA = 0;
  state.votesB = 0;

  // Randomise existing solo "history" so both bars feel real
  // (solo mode shows just your choice highlighted; no real crowd data)
  $('solo-q-num').textContent = `Question ${usedIndices.size} of ${questions.length}`;
  $('solo-opt-a-text').textContent = q.optionA;
  $('solo-opt-b-text').textContent = q.optionB;

  // Reset buttons
  ['solo-opt-a', 'solo-opt-b'].forEach(id => {
    const btn = $(id);
    btn.disabled = false;
    btn.classList.remove('selected');
  });

  // Hide results
  $('solo-results').classList.remove('visible');
  $('solo-next-btn').style.display = 'none';
}

function soloVote(choice) {
  if (state.voted) return;
  state.voted = true;

  // Simulate a crowd — majority always matches the player's choice
  const majorityPct = Math.floor(Math.random() * 40) + 51; // 51–90%
  const minorityPct = 100 - majorityPct;
  if (choice === 'A') {
    state.votesA = majorityPct;
    state.votesB = minorityPct;
  } else {
    state.votesA = minorityPct;
    state.votesB = majorityPct;
  }

  const total = state.votesA + state.votesB;
  const pctA = Math.round((state.votesA / total) * 100);
  const pctB = 100 - pctA;

  // Mark selected
  $('solo-opt-a').classList.toggle('selected', choice === 'A');
  $('solo-opt-b').classList.toggle('selected', choice === 'B');
  $('solo-opt-a').disabled = true;
  $('solo-opt-b').disabled = true;

  // Show results
  $('solo-pct-a').textContent = pctA + '%';
  $('solo-pct-b').textContent = pctB + '%';
  $('solo-votes-a').textContent = `${state.votesA} vote${state.votesA !== 1 ? 's' : ''}`;
  $('solo-votes-b').textContent = `${state.votesB} vote${state.votesB !== 1 ? 's' : ''}`;
  $('solo-total').textContent = `${total} total responses`;

  const results = $('solo-results');
  results.classList.add('visible');

  // Animate bars after a short delay
  setTimeout(() => {
    $('solo-bar-a').style.width = pctA + '%';
    $('solo-bar-b').style.width = pctB + '%';
  }, 60);

  $('solo-next-btn').style.display = '';
}

// ---- MULTIPLAYER: PeerJS setup ----

function getPeerJS() {
  return window.Peer;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function initHost() {
  state.isHost = true;
  state.mode = 'host';
  state.roomCode = generateRoomCode();
  state.players = [{ id: state.myName, name: state.myName }];
  state.connections = [];
  state.gameStarted = false;

  $('host-room-code').textContent = state.roomCode;
  $('host-room-code-copy').onclick = () => {
    navigator.clipboard.writeText(state.roomCode).then(() => showToast('Room code copied!'));
  };

  setStatus('host-status', 'Connecting to relay…', 'info');

  const Peer = getPeerJS();
  if (!Peer) {
    setStatus('host-status', 'PeerJS failed to load. Check your connection.', 'error');
    return;
  }

  state.peer = new Peer('wyr-' + state.roomCode, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 0,
  });

  state.peer.on('open', id => {
    setStatus('host-status', 'Ready! Share the code above with friends.', 'success');
    updatePlayerBadge();
    renderPlayerList('host-player-list');
  });

  state.peer.on('connection', conn => {
    conn.on('open', () => {
      state.connections.push(conn);
      const playerName = conn.metadata?.name || 'Player ' + state.connections.length;
      state.players.push({ id: conn.peer, name: playerName });
      updatePlayerBadge();
      renderPlayerList('host-player-list');
      setStatus('host-status', `${playerName} joined! ${state.players.length} player(s) in room.`, 'success');

      // Broadcast updated player list to everyone
      broadcastToClients({ type: 'players', players: state.players });

      conn.on('data', data => handleHostData(conn, data));
      conn.on('close', () => {
        state.connections = state.connections.filter(c => c !== conn);
        state.players = state.players.filter(p => p.id !== conn.peer);
        updatePlayerBadge();
        renderPlayerList('host-player-list');
        broadcastToClients({ type: 'players', players: state.players });
      });
    });

    conn.on('error', err => console.warn('conn error', err));
  });

  state.peer.on('error', err => {
    if (err.type === 'unavailable-id') {
      // Room code taken, try again
      state.peer.destroy();
      state.roomCode = generateRoomCode();
      $('host-room-code').textContent = state.roomCode;
      initHost();
    } else {
      setStatus('host-status', 'Connection error: ' + err.message, 'error');
    }
  });

  showScreen('mp-host-lobby');
}

function initClient(code, name) {
  state.isHost = false;
  state.mode = 'client';
  state.roomCode = code.toUpperCase();
  state.myName = name;

  setStatus('join-status', 'Connecting…', 'info');

  const Peer = getPeerJS();
  if (!Peer) {
    setStatus('join-status', 'PeerJS failed to load. Check your connection.', 'error');
    return;
  }

  state.peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 0,
  });

  state.peer.on('open', myId => {
    const hostPeerId = 'wyr-' + state.roomCode;
    state.hostConn = state.peer.connect(hostPeerId, {
      metadata: { name: state.myName },
      reliable: true,
    });

    state.hostConn.on('open', () => {
      setStatus('join-status', 'Connected! Waiting for host to start the game…', 'success');
      showScreen('mp-client-lobby');
    });

    state.hostConn.on('data', data => handleClientData(data));

    state.hostConn.on('close', () => {
      showToast('Disconnected from host.');
      goHome();
    });

    state.hostConn.on('error', err => {
      setStatus('join-status', 'Could not connect. Check the code and try again.', 'error');
    });
  });

  state.peer.on('error', err => {
    if (err.type === 'peer-unavailable') {
      setStatus('join-status', 'Room not found. Double-check the code.', 'error');
    } else {
      setStatus('join-status', 'Error: ' + err.message, 'error');
    }
  });
}

function broadcastToClients(data) {
  state.connections.forEach(conn => {
    if (conn.open) conn.send(data);
  });
}

// ---- HOST: receive data from a client ----
function handleHostData(conn, data) {
  if (data.type === 'vote') {
    state.pendingVotes[conn.peer] = data.choice;
    broadcastToClients({ type: 'vote_update', votes: state.pendingVotes });
    updateMpVoteStatus();

    // Reveal when all players (host + all clients) have voted
    if (Object.keys(state.pendingVotes).length >= state.connections.length + 1) {
      revealMpResults();
    }
  }
}

// ---- CLIENT: receive data from host ----
function handleClientData(data) {
  switch (data.type) {
    case 'players':
      state.players = data.players;
      updatePlayerBadge();
      renderPlayerList('client-player-list');
      break;

    case 'start_game':
      state.gameStarted = true;
      loadMpQuestion(data.question, false);
      showScreen('mp-game');
      break;

    case 'question':
      loadMpQuestion(data.question, false);
      break;

    case 'vote_update':
      state.pendingVotes = data.votes;
      updateMpVoteStatus();
      break;

    case 'reveal':
      revealMpResults(data.votesA, data.votesB);
      break;

    case 'next':
      loadMpQuestion(data.question, false);
      break;
  }
}

function hostStartGame() {
  if (state.players.length < 1) return;
  usedIndices.clear();
  state.questions = getShuffledQuestions();
  state.currentIndex = 0;

  const q = nextUnusedQuestion();
  state.currentQuestion = q;
  state.voted = false;
  state.pendingVotes = {};

  broadcastToClients({ type: 'start_game', question: q });
  loadMpQuestion(q, true);
  showScreen('mp-game');
}

function loadMpQuestion(q, isHost) {
  state.currentQuestion = q;
  state.voted = false;
  state.pendingVotes = {};

  $('mp-q-num').textContent = `Question ${usedIndices.size} of ${questions.length}`;
  $('mp-opt-a-text').textContent = q.optionA;
  $('mp-opt-b-text').textContent = q.optionB;

  ['mp-opt-a', 'mp-opt-b'].forEach(id => {
    const btn = $(id);
    btn.disabled = false;
    btn.classList.remove('selected');
  });

  $('mp-results').classList.remove('visible');
  $('mp-bar-a').style.width = '0%';
  $('mp-bar-b').style.width = '0%';

  const nextBtn = $('mp-next-btn');
  if (nextBtn) {
    // Only show "Next Question" button to the host, and only after results are revealed
    nextBtn.style.display = 'none';
  }

  updateMpVoteStatus();
  updatePlayerBadge();
}

function mpVote(choice) {
  if (state.voted) return;
  state.voted = true;

  $('mp-opt-a').classList.toggle('selected', choice === 'A');
  $('mp-opt-b').classList.toggle('selected', choice === 'B');
  $('mp-opt-a').disabled = true;
  $('mp-opt-b').disabled = true;

  if (state.isHost) {
    // Record host vote
    state.pendingVotes['__host__'] = choice;
    broadcastToClients({ type: 'vote_update', votes: state.pendingVotes });
    updateMpVoteStatus();

    // Check if all clients have voted (host vote is already in pendingVotes as '__host__')
    if (Object.keys(state.pendingVotes).length >= state.connections.length + 1) {
      revealMpResults();
    }
  } else {
    // Send vote to host
    state.hostConn.send({ type: 'vote', choice });
    updateMpVoteStatus();
  }
}

function updateMpVoteStatus() {
  const total = state.players.length;
  // Host vote is recorded in pendingVotes['__host__']; client vote is not in pendingVotes locally
  const voted = Object.keys(state.pendingVotes).length + (state.voted && !state.isHost ? 1 : 0);
  const container = $('mp-vote-icons');
  if (!container) return;
  let html = '';
  for (let i = 0; i < total; i++) {
    const hasVoted = i < voted;
    html += `<span class="vote-icon${hasVoted ? ' voted' : ''}">✓</span>`;
  }
  container.innerHTML = html;
  $('mp-vote-count').textContent = `${voted}/${total} voted`;
}

function revealMpResults(extVotesA, extVotesB) {
  let votesA = 0, votesB = 0;

  if (extVotesA !== undefined) {
    votesA = extVotesA;
    votesB = extVotesB;
  } else {
    // Count from pendingVotes
    Object.values(state.pendingVotes).forEach(v => {
      if (v === 'A') votesA++;
      else votesB++;
    });
    // Broadcast to clients
    broadcastToClients({ type: 'reveal', votesA, votesB });
  }

  const total = votesA + votesB || 1;
  const pctA = Math.round((votesA / total) * 100);
  const pctB = 100 - pctA;

  $('mp-pct-a').textContent = pctA + '%';
  $('mp-pct-b').textContent = pctB + '%';
  $('mp-votes-a').textContent = `${votesA} vote${votesA !== 1 ? 's' : ''}`;
  $('mp-votes-b').textContent = `${votesB} vote${votesB !== 1 ? 's' : ''}`;
  $('mp-total').textContent = `${total} total response${total !== 1 ? 's' : ''}`;

  $('mp-results').classList.add('visible');
  setTimeout(() => {
    $('mp-bar-a').style.width = pctA + '%';
    $('mp-bar-b').style.width = pctB + '%';
  }, 60);

  // Show Next button only for host
  if (state.isHost) {
    $('mp-next-btn').style.display = '';
  }
}

function mpNextQuestion() {
  if (!state.isHost) return;
  const q = nextUnusedQuestion();
  loadMpQuestion(q, true);
  broadcastToClients({ type: 'next', question: q });
}

// ---- NAVIGATION ----
function goHome() {
  // Clean up peer connections
  if (state.peer) {
    state.peer.destroy();
    state.peer = null;
  }
  state.connections = [];
  state.hostConn = null;
  state.players = [];
  state.mode = 'solo';
  state.isHost = false;
  showScreen('home');
}

function showMpSetup() {
  showScreen('mp-setup');
}

function showMpCreate() {
  const name = prompt('Enter your name (shown to others):', 'Player');
  if (!name || !name.trim()) return;
  state.myName = name.trim().slice(0, 20);
  initHost();
}

function showMpJoin() {
  showScreen('mp-join');
  setStatus('join-status', '', 'info');
  $('join-code-input').value = '';
  $('join-name-input').value = '';
}

function submitJoin() {
  const code = $('join-code-input').value.trim().toUpperCase();
  const name = $('join-name-input').value.trim().slice(0, 20) || 'Player';
  if (code.length < 4) {
    setStatus('join-status', 'Please enter a valid room code.', 'error');
    return;
  }
  if (state.peer) { state.peer.destroy(); state.peer = null; }
  initClient(code, name);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  state.questions = getShuffledQuestions();
  showScreen('home');

  // --- Home screen ---
  $('btn-solo').addEventListener('click', startSolo);
  $('btn-multiplayer').addEventListener('click', showMpSetup);

  // --- Multiplayer setup ---
  $('btn-mp-back').addEventListener('click', goHome);
  $('btn-mp-create').addEventListener('click', showMpCreate);
  $('btn-mp-join').addEventListener('click', showMpJoin);

  // --- Join screen ---
  $('btn-join-back').addEventListener('click', () => showScreen('mp-setup'));
  $('btn-join-submit').addEventListener('click', submitJoin);
  $('join-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitJoin();
  });
  $('join-code-input').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // --- Host lobby ---
  $('btn-host-back').addEventListener('click', () => { goHome(); showScreen('mp-setup'); });
  $('btn-host-start').addEventListener('click', hostStartGame);

  // --- Client lobby ---
  $('btn-client-back').addEventListener('click', () => { goHome(); showScreen('home'); });

  // --- Solo game ---
  $('solo-opt-a').addEventListener('click', () => soloVote('A'));
  $('solo-opt-b').addEventListener('click', () => soloVote('B'));
  $('solo-next-btn').addEventListener('click', loadSoloQuestion);
  $('solo-home-btn').addEventListener('click', goHome);

  // --- Multiplayer game ---
  $('mp-opt-a').addEventListener('click', () => mpVote('A'));
  $('mp-opt-b').addEventListener('click', () => mpVote('B'));
  $('mp-next-btn').addEventListener('click', mpNextQuestion);
  $('mp-home-btn').addEventListener('click', () => { goHome(); showScreen('home'); });
});
