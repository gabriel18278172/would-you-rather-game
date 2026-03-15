/* ==============================================
   Would You Rather — script.js v2
   Solo + Timed + PeerJS WebRTC multiplayer
   ============================================== */

'use strict';

// ===== THEME & DARK MODE =====

function initTheme() {
  const saved = localStorage.getItem('wyr_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  setDarkMode(isDark);
  const colorTheme = localStorage.getItem('wyr_color_theme') || 'default';
  setColorTheme(colorTheme);
}

function setDarkMode(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('wyr_theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  const checkbox = document.getElementById('setting-dark-mode');
  if (checkbox) checkbox.checked = isDark;
}

function setColorTheme(name) {
  document.documentElement.setAttribute('data-color-theme', name);
  localStorage.setItem('wyr_color_theme', name);
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.themeName === name);
  });
}

// ===== SOUND EFFECTS =====

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  if (localStorage.getItem('wyr_sounds') === 'false') return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    switch (type) {
      case 'click':
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'ding':
        osc.frequency.value = 1200;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
        break;
      case 'tick':
        osc.frequency.value = 440;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
        break;
      case 'milestone':
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = freq;
          o.type = 'sine';
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
          g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.1 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
          o.start(ctx.currentTime + i * 0.1);
          o.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
        break;
    }
  } catch (e) {
    // Audio not supported
  }
}

// ===== STATS =====

const DEFAULT_STATS = {
  totalAnswered: 0,
  choicesA: 0,
  choicesB: 0,
  playTimes: [],
  fastestAnswer: null,
  achievements: [],
  playedAfterMidnight: false,
  playedBefore7am: false,
  playedMultiplayer: false,
  categoryCounts: {},
};

function loadStats() {
  try {
    const saved = localStorage.getItem('wyr_stats_v2');
    if (saved) return Object.assign({}, DEFAULT_STATS, JSON.parse(saved));
  } catch (e) {}
  return Object.assign({}, DEFAULT_STATS);
}

function saveStats() {
  try {
    localStorage.setItem('wyr_stats_v2', JSON.stringify(stats));
  } catch (e) {}
}

let stats = loadStats();

function recordAnswer(choice, elapsedSeconds, category) {
  stats.totalAnswered++;
  if (choice === 'A') stats.choicesA++;
  else stats.choicesB++;

  if (elapsedSeconds !== null && (stats.fastestAnswer === null || elapsedSeconds < stats.fastestAnswer)) {
    stats.fastestAnswer = elapsedSeconds;
  }

  // Track play times
  const hour = new Date().getHours();
  stats.playTimes.push(hour);
  if (stats.playTimes.length > 500) stats.playTimes = stats.playTimes.slice(-500);

  // Night owl: midnight–3:59am; early bird: 4am–6:59am (no overlap)
  if (hour >= 0 && hour < 4) stats.playedAfterMidnight = true;
  if (hour >= 4 && hour < 7) stats.playedBefore7am = true;

  // Category counts
  if (category) {
    stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;
  }

  saveStats();
  checkAchievements();
}

function resetStats() {
  stats = Object.assign({}, DEFAULT_STATS, { achievements: [] });
  saveStats();
}

// ===== ACHIEVEMENTS =====

const ACHIEVEMENTS = [
  { id: 'first_question', name: 'First Question', desc: 'Answer your first question', icon: '🎯', check: s => s.totalAnswered >= 1 },
  { id: 'century',        name: 'Century',         desc: 'Answer 100 questions',        icon: '💯', check: s => s.totalAnswered >= 100 },
  { id: 'thousand_club',  name: 'Thousand Club',   desc: 'Answer 1,000 questions',      icon: '🌟', check: s => s.totalAnswered >= 1000 },
  { id: 'speed_demon',    name: 'Speed Demon',     desc: 'Answer in under 2 seconds',   icon: '⚡', check: s => s.fastestAnswer !== null && s.fastestAnswer < 2 },
  { id: 'night_owl',      name: 'Night Owl',       desc: 'Play after midnight',         icon: '🦉', check: s => s.playedAfterMidnight === true },
  { id: 'early_bird',     name: 'Early Bird',      desc: 'Play before 7am',             icon: '🌅', check: s => s.playedBefore7am === true },
  { id: 'category_master',name: 'Category Master', desc: 'Answer 50 in one category',   icon: '📂', check: s => s.categoryCounts && Object.values(s.categoryCounts).some(v => v >= 50) },
  { id: 'social_butterfly',name:'Social Butterfly',desc: 'Play a multiplayer game',     icon: '🦋', check: s => s.playedMultiplayer === true },
];

let achievementToastTimer = null;

function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!stats.achievements.includes(ach.id) && ach.check(stats)) {
      stats.achievements.push(ach.id);
      saveStats();
      showAchievementToast(ach);
    }
  });
}

function showAchievementToast(ach) {
  const el = document.getElementById('achievement-toast');
  if (!el) return;
  el.innerHTML = `
    <span class="achievement-toast-icon">${ach.icon}</span>
    <span class="achievement-toast-text">
      <span class="achievement-toast-title">🏅 Achievement Unlocked!</span>
      <span class="achievement-toast-name">${escHtml(ach.name)}</span>
      <span class="achievement-toast-desc">${escHtml(ach.desc)}</span>
    </span>`;
  el.classList.add('show');
  if (achievementToastTimer) clearTimeout(achievementToastTimer);
  achievementToastTimer = setTimeout(() => el.classList.remove('show'), 4000);
  playSound('milestone');
}

// ===== CONFETTI =====

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    color: ['#4f46e5','#f97316','#06b6d4','#22c55e','#a855f7','#eab308','#ef4444'][Math.floor(Math.random() * 7)],
    rot: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 2,
    vrot: (Math.random() - 0.5) * 0.2,
  }));

  let frame = 0;
  const maxFrames = 120;

  function animate() {
    if (frame++ > maxFrames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      if (p.y > canvas.height) p.y = -10;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ===== CATEGORIES =====

const ALL_CATEGORIES = ['Superpowers','Food','Animals','Gross','School','Sports','Hypothetical','Funny','Travel','Money','Technology','Relationships','Random'];

const CATEGORY_ICONS = {
  'Superpowers': '🦸',
  'Food': '🍕',
  'Animals': '🐾',
  'Gross': '🤢',
  'School': '📚',
  'Sports': '⚽',
  'Hypothetical': '🤔',
  'Funny': '😂',
  'Travel': '✈️',
  'Money': '💰',
  'Technology': '💻',
  'Relationships': '❤️',
  'Random': '🎲',
};

let selectedCategories = new Set(ALL_CATEGORIES);
let pendingGameMode = 'solo'; // 'solo' | 'timed'

// ===== STATE =====

const state = {
  mode: 'solo',
  questions: [],
  currentIndex: 0,
  voted: false,
  votesA: 0,
  votesB: 0,
  currentQuestion: null,
  // Multiplayer
  peer: null,
  connections: [],
  hostConn: null,
  roomCode: '',
  players: [],
  myName: '',
  isHost: false,
  pendingVotes: {},
  gameStarted: false,
};

// ===== SESSION STATE =====

let sessionAnswered = 0;
let sessionChoicesA = 0;
let sessionChoicesB = 0;
let sessionStart = Date.now();
let sessionAnswerStart = null;
let lastAnsweredQuestion = null;
let lastChoice = null;
let lastPctA = 0;
let lastPctB = 0;

function resetSession() {
  sessionAnswered = 0;
  sessionChoicesA = 0;
  sessionChoicesB = 0;
  sessionStart = Date.now();
  sessionAnswerStart = null;
  lastAnsweredQuestion = null;
  lastChoice = null;
}

// ===== TIMER =====

const CIRCUMFERENCE = 2 * Math.PI * 26; // r=26 → ≈163.36

let timerDuration = 10;
let timerInterval = null;
let timerRemaining = 10;

function startTimer() {
  clearTimer();
  timerRemaining = timerDuration;
  updateTimerUI();
  const container = document.getElementById('timer-container');
  if (container) container.style.display = 'flex';

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerUI();
    if (timerRemaining <= 3 && timerRemaining > 0) {
      playSound('tick');
      document.getElementById('timer-container')?.classList.add('timer-warning');
    }
    if (timerRemaining <= 0) {
      clearTimer();
      timeOut();
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const container = document.getElementById('timer-container');
  if (container) {
    container.style.display = 'none';
    container.classList.remove('timer-warning');
  }
}

function updateTimerUI() {
  const textEl = document.getElementById('timer-text');
  const circleEl = document.getElementById('timer-progress-circle');
  if (textEl) textEl.textContent = timerRemaining;
  if (circleEl) {
    const progress = timerRemaining / timerDuration;
    const dashOffset = CIRCUMFERENCE * (1 - progress);
    circleEl.style.strokeDashoffset = dashOffset;
    circleEl.style.stroke = progress > 0.5 ? 'var(--success)' : progress > 0.25 ? 'var(--timer-warn, #eab308)' : 'var(--timer-danger, #ef4444)';
  }
}

function timeOut() {
  showToast('⏰ Time\'s up!');
  const btnA = document.getElementById('solo-opt-a');
  const btnB = document.getElementById('solo-opt-b');
  if (btnA) btnA.disabled = true;
  if (btnB) btnB.disabled = true;
  document.getElementById('solo-next-btn').style.display = '';
  document.getElementById('solo-share-btn').style.display = 'none';
}

// ===== QUESTION POOL =====

let usedIndices = new Set();

function getFilteredQuestions() {
  if (selectedCategories.size === 0 || selectedCategories.size === ALL_CATEGORIES.length) {
    return Array.from({ length: questions.length }, (_, i) => i);
  }
  return questions.reduce((acc, q, i) => {
    if (selectedCategories.has(q.category)) acc.push(i);
    return acc;
  }, []);
}

function getShuffledQuestions() {
  const indices = getFilteredQuestions();
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function nextUnusedQuestion() {
  if (state.questions.length === 0 || usedIndices.size >= state.questions.length) {
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

// ===== DOM HELPERS =====

const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = $('screen-' + name);
  if (s) s.classList.add('active');
}

let toastTimer;
function showToast(msg, duration = 2800) {
  const t = $('toast');
  if (!t) return;
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
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== CATEGORY PICKER =====

function buildCategoryPicker() {
  const container = $('category-checkboxes');
  if (!container) return;
  container.innerHTML = ALL_CATEGORIES.map(cat => `
    <label class="category-chip">
      <input type="checkbox" value="${escHtml(cat)}" ${selectedCategories.has(cat) ? 'checked' : ''} />
      <span class="category-chip-label">${CATEGORY_ICONS[cat] || '❓'} ${escHtml(cat)}</span>
    </label>
  `).join('');
}

function getSelectedCategories() {
  const checks = document.querySelectorAll('#category-checkboxes input[type=checkbox]');
  const sel = new Set();
  checks.forEach(cb => { if (cb.checked) sel.add(cb.value); });
  return sel;
}

// ===== SOLO MODE =====

function showCategoryPicker(mode) {
  pendingGameMode = mode;
  buildCategoryPicker();
  showScreen('category-picker');
}

function startSolo(mode) {
  state.mode = mode || 'solo';
  state.voted = false;
  state.votesA = 0;
  state.votesB = 0;
  usedIndices.clear();
  state.questions = getShuffledQuestions();
  state.currentIndex = 0;
  resetSession();
  showScreen('solo-game');
  loadSoloQuestion();
}

function loadSoloQuestion() {
  const q = nextUnusedQuestion();
  state.currentQuestion = q;
  state.voted = false;
  state.votesA = 0;
  state.votesB = 0;
  sessionAnswerStart = Date.now();

  $('solo-q-num').textContent = `Question ${usedIndices.size}`;
  $('solo-opt-a-text').textContent = q.optionA;
  $('solo-opt-b-text').textContent = q.optionB;

  // Category badge
  const badge = $('solo-category-badge');
  if (badge) {
    const cat = q.category || 'Random';
    badge.textContent = (CATEGORY_ICONS[cat] || '❓') + ' ' + cat;
    badge.style.display = '';
  }

  ['solo-opt-a', 'solo-opt-b'].forEach(id => {
    const btn = $(id);
    btn.disabled = false;
    btn.classList.remove('selected');
  });

  $('solo-results').classList.remove('visible');
  $('solo-bar-a').style.width = '0%';
  $('solo-bar-b').style.width = '0%';
  $('solo-next-btn').style.display = 'none';
  $('solo-share-btn').style.display = 'none';

  if (state.mode === 'timed') {
    startTimer();
  } else {
    clearTimer();
  }
}

function soloVote(choice) {
  if (state.voted) return;
  state.voted = true;

  clearTimer();

  const elapsed = sessionAnswerStart ? (Date.now() - sessionAnswerStart) / 1000 : null;

  // Simulate crowd — majority matches player's choice
  const majorityPct = Math.floor(Math.random() * 40) + 51;
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

  lastAnsweredQuestion = state.currentQuestion;
  lastChoice = choice;
  lastPctA = pctA;
  lastPctB = pctB;

  $('solo-opt-a').classList.toggle('selected', choice === 'A');
  $('solo-opt-b').classList.toggle('selected', choice === 'B');
  $('solo-opt-a').disabled = true;
  $('solo-opt-b').disabled = true;

  $('solo-pct-a').textContent = pctA + '%';
  $('solo-pct-b').textContent = pctB + '%';
  $('solo-votes-a').textContent = `${state.votesA} vote${state.votesA !== 1 ? 's' : ''}`;
  $('solo-votes-b').textContent = `${state.votesB} vote${state.votesB !== 1 ? 's' : ''}`;
  $('solo-total').textContent = `${total} total responses`;

  $('solo-results').classList.add('visible');
  setTimeout(() => {
    $('solo-bar-a').style.width = pctA + '%';
    $('solo-bar-b').style.width = pctB + '%';
  }, 60);

  $('solo-next-btn').style.display = '';
  $('solo-share-btn').style.display = '';

  // Session tracking
  sessionAnswered++;
  if (choice === 'A') sessionChoicesA++; else sessionChoicesB++;

  // Persistent stats
  recordAnswer(choice, elapsed, state.currentQuestion?.category);

  playSound('ding');

  // History
  addToHistory(state.currentQuestion, choice, pctA, pctB);
}

// ===== SESSION SUMMARY =====

function showSessionSummary() {
  if (sessionAnswered < 3) {
    goHome();
    return;
  }
  const elapsed = Math.round((Date.now() - sessionStart) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const totalVotes = sessionChoicesA + sessionChoicesB;
  const splitA = totalVotes > 0 ? Math.round((sessionChoicesA / totalVotes) * 100) : 50;
  const splitB = 100 - splitA;

  $('summary-answered').textContent = sessionAnswered;
  $('summary-time').textContent = timeStr;
  $('summary-split').textContent = `${splitA}/${splitB}`;

  showScreen('session-summary');
}

// ===== HISTORY =====

let questionHistory = [];

function addToHistory(q, choice, pctA, pctB) {
  if (!q) return;
  questionHistory.unshift({ q, choice, pctA, pctB, ts: Date.now() });
  if (questionHistory.length > 50) questionHistory = questionHistory.slice(0, 50);
}

function renderHistory() {
  const list = $('history-list');
  if (!list) return;
  if (questionHistory.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px;font-size:0.88rem;">No questions answered yet.</p>';
    return;
  }
  list.innerHTML = questionHistory.map(item => `
    <div class="history-item">
      <span class="history-item-choice choice-${item.choice.toLowerCase()}">
        Chose ${item.choice} · ${item.choice === 'A' ? item.pctA : item.pctB}% agree
      </span>
      <div class="history-item-q">
        <strong>${escHtml(item.q.optionA)}</strong>
        <span style="color:var(--text-light)"> or </span>
        <strong>${escHtml(item.q.optionB)}</strong>
      </div>
    </div>
  `).join('');
}

function openHistory() {
  renderHistory();
  $('history-panel').classList.add('open');
  $('history-overlay').classList.add('show');
}

function closeHistory() {
  $('history-panel').classList.remove('open');
  $('history-overlay').classList.remove('show');
}

// ===== SHARE =====

function shareResult() {
  const q = lastAnsweredQuestion;
  if (!q) return;
  const chosenPct = lastChoice === 'A' ? lastPctA : lastPctB;
  const url = window.location.href;
  const text = `🤔 Would You Rather...\nA) ${q.optionA}\nB) ${q.optionB}\n\nI chose ${lastChoice}! (${chosenPct}% agree)\n\nPlay at: ${url}`;

  if (navigator.share) {
    navigator.share({ title: 'Would You Rather?', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Copied to clipboard!');
    }).catch(() => {
      showToast('Could not copy to clipboard');
    });
  }
}

// ===== STATS SCREEN =====

function loadStatsScreen() {
  $('stat-total').textContent = stats.totalAnswered;
  $('stat-fastest').textContent = stats.fastestAnswer !== null ? stats.fastestAnswer.toFixed(1) + 's' : '--';

  const total = stats.choicesA + stats.choicesB || 1;
  const pctA = Math.round((stats.choicesA / total) * 100);
  const pctB = 100 - pctA;

  $('stat-a-pct').textContent = pctA + '%';
  $('stat-b-pct').textContent = pctB + '%';
  $('ab-bar-a').style.width = pctA + '%';
  $('ab-bar-b').style.width = pctB + '%';
  $('stat-a-count').textContent = stats.choicesA + ' times A';
  $('stat-b-count').textContent = stats.choicesB + ' times B';

  // Favorite time
  if (stats.playTimes.length > 0) {
    const freq = {};
    stats.playTimes.forEach(h => { freq[h] = (freq[h] || 0) + 1; });
    const peak = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    const h = parseInt(peak[0]);
    const label = h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
    $('stat-fav-time').textContent = label;
  } else {
    $('stat-fav-time').textContent = '--';
  }

  renderAchievements();
}

function renderAchievements() {
  const grid = $('achievements-grid');
  if (!grid) return;
  grid.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = stats.achievements.includes(ach.id);
    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <span class="achievement-icon">${ach.icon}</span>
        <span class="achievement-name">${escHtml(ach.name)}</span>
        <span class="achievement-desc">${escHtml(ach.desc)}</span>
      </div>`;
  }).join('');
}

function shareStats() {
  const total = stats.choicesA + stats.choicesB || 1;
  const pctA = Math.round((stats.choicesA / total) * 100);
  const text = `🏆 My Would You Rather stats:\n✅ ${stats.totalAnswered} questions answered\n⚡ Fastest answer: ${stats.fastestAnswer !== null ? stats.fastestAnswer.toFixed(1) + 's' : '--'}\n📊 A/B Split: ${pctA}% / ${100 - pctA}%\n\nPlay at: ${window.location.href}`;
  if (navigator.share) {
    navigator.share({ title: 'Would You Rather Stats', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Stats copied!')).catch(() => showToast('Could not copy'));
  }
}

// ===== SETTINGS SCREEN =====

function loadSettingsScreen() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const soundsCheck = $('setting-sounds');
  const darkCheck = $('setting-dark-mode');
  if (darkCheck) darkCheck.checked = isDark;
  if (soundsCheck) soundsCheck.checked = localStorage.getItem('wyr_sounds') !== 'false';

  const colorTheme = localStorage.getItem('wyr_color_theme') || 'default';
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.themeName === colorTheme);
  });
}

// ===== MULTIPLAYER =====

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

  state.peer.on('open', () => {
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

  state.peer.on('open', () => {
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

    state.hostConn.on('error', () => {
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
  state.connections.forEach(conn => { if (conn.open) conn.send(data); });
}

function handleHostData(conn, data) {
  if (data.type === 'vote') {
    state.pendingVotes[conn.peer] = data.choice;
    broadcastToClients({ type: 'vote_update', votes: state.pendingVotes });
    updateMpVoteStatus();
    if (Object.keys(state.pendingVotes).length >= state.connections.length + 1) {
      revealMpResults();
    }
  }
}

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

  // Track multiplayer achievement
  stats.playedMultiplayer = true;
  saveStats();
  checkAchievements();

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

  $('mp-q-num').textContent = `Question ${usedIndices.size}`;
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
  $('mp-next-btn').style.display = 'none';

  updateMpVoteStatus();
  updatePlayerBadge();
}

function mpVote(choice) {
  if (state.voted) return;
  state.voted = true;
  playSound('click');

  $('mp-opt-a').classList.toggle('selected', choice === 'A');
  $('mp-opt-b').classList.toggle('selected', choice === 'B');
  $('mp-opt-a').disabled = true;
  $('mp-opt-b').disabled = true;

  if (state.isHost) {
    state.pendingVotes['__host__'] = choice;
    broadcastToClients({ type: 'vote_update', votes: state.pendingVotes });
    updateMpVoteStatus();
    if (Object.keys(state.pendingVotes).length >= state.connections.length + 1) {
      revealMpResults();
    }
  } else {
    state.hostConn.send({ type: 'vote', choice });
    updateMpVoteStatus();
  }
}

function updateMpVoteStatus() {
  const total = state.players.length;
  const voted = Object.keys(state.pendingVotes).length + (state.voted && !state.isHost ? 1 : 0);
  const container = $('mp-vote-icons');
  if (!container) return;
  let html = '';
  for (let i = 0; i < total; i++) {
    html += `<span class="vote-icon${i < voted ? ' voted' : ''}">✓</span>`;
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
    Object.values(state.pendingVotes).forEach(v => { if (v === 'A') votesA++; else votesB++; });
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

  if (state.isHost) $('mp-next-btn').style.display = '';
  playSound('ding');
}

function mpNextQuestion() {
  if (!state.isHost) return;
  const q = nextUnusedQuestion();
  loadMpQuestion(q, true);
  broadcastToClients({ type: 'next', question: q });
}

// ===== NAVIGATION =====

function goHome() {
  clearTimer();
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

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  state.questions = getShuffledQuestions();
  showScreen('home');

  // --- Header ---
  $('btn-theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setDarkMode(!isDark);
  });

  $('btn-settings').addEventListener('click', () => {
    loadSettingsScreen();
    showScreen('settings');
  });

  // --- Home screen ---
  $('btn-solo').addEventListener('click', () => showCategoryPicker('solo'));
  $('btn-timed').addEventListener('click', () => showScreen('timed-setup'));
  $('btn-multiplayer').addEventListener('click', showMpSetup);
  $('btn-stats').addEventListener('click', () => {
    loadStatsScreen();
    showScreen('stats');
  });

  // --- Category picker ---
  $('btn-category-back').addEventListener('click', () => showScreen('home'));
  $('btn-cat-all').addEventListener('click', () => {
    document.querySelectorAll('#category-checkboxes input[type=checkbox]').forEach(cb => cb.checked = true);
  });
  $('btn-cat-none').addEventListener('click', () => {
    document.querySelectorAll('#category-checkboxes input[type=checkbox]').forEach(cb => cb.checked = false);
  });
  $('btn-category-start').addEventListener('click', () => {
    selectedCategories = getSelectedCategories();
    if (selectedCategories.size === 0) {
      showToast('⚠️ Please select at least one category!');
      return;
    }
    startSolo(pendingGameMode);
  });

  // --- Timed setup ---
  $('btn-timed-back').addEventListener('click', () => showScreen('home'));
  $('btn-timed-start').addEventListener('click', () => {
    const checked = document.querySelector('input[name="timer-duration"]:checked');
    timerDuration = checked ? parseInt(checked.value) : 10;
    showCategoryPicker('timed');
  });

  // --- Stats ---
  $('btn-stats-back').addEventListener('click', () => showScreen('home'));
  $('btn-share-stats').addEventListener('click', shareStats);

  // --- Settings ---
  $('btn-settings-back').addEventListener('click', () => showScreen('home'));
  $('setting-dark-mode').addEventListener('change', e => setDarkMode(e.target.checked));
  $('setting-sounds').addEventListener('change', e => {
    localStorage.setItem('wyr_sounds', e.target.checked ? 'true' : 'false');
  });
  document.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => setColorTheme(s.dataset.themeName));
  });
  $('btn-reset-stats').addEventListener('click', () => {
    if (confirm('Reset all stats and achievements? This cannot be undone.')) {
      resetStats();
      questionHistory = [];
      showToast('Stats reset!');
      loadStatsScreen();
    }
  });

  // --- Solo game ---
  $('solo-opt-a').addEventListener('click', () => { playSound('click'); soloVote('A'); });
  $('solo-opt-b').addEventListener('click', () => { playSound('click'); soloVote('B'); });
  $('solo-next-btn').addEventListener('click', loadSoloQuestion);
  $('solo-share-btn').addEventListener('click', shareResult);
  $('solo-home-btn').addEventListener('click', () => {
    clearTimer();
    showSessionSummary();
  });
  $('btn-history').addEventListener('click', openHistory);

  // --- History panel ---
  $('btn-history-close').addEventListener('click', closeHistory);
  $('history-overlay').addEventListener('click', closeHistory);

  // --- Session summary ---
  $('btn-play-again').addEventListener('click', () => startSolo(state.mode));
  $('btn-summary-home').addEventListener('click', goHome);

  // --- Multiplayer setup ---
  $('btn-mp-back').addEventListener('click', goHome);
  $('btn-mp-create').addEventListener('click', showMpCreate);
  $('btn-mp-join').addEventListener('click', showMpJoin);

  // --- Join screen ---
  $('btn-join-back').addEventListener('click', () => showScreen('mp-setup'));
  $('btn-join-submit').addEventListener('click', submitJoin);
  $('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitJoin(); });
  $('join-code-input').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // --- Host lobby ---
  $('btn-host-back').addEventListener('click', () => { goHome(); showScreen('mp-setup'); });
  $('btn-host-start').addEventListener('click', hostStartGame);

  // --- Client lobby ---
  $('btn-client-back').addEventListener('click', () => { goHome(); showScreen('home'); });

  // --- Multiplayer game ---
  $('mp-opt-a').addEventListener('click', () => mpVote('A'));
  $('mp-opt-b').addEventListener('click', () => mpVote('B'));
  $('mp-next-btn').addEventListener('click', mpNextQuestion);
  $('mp-home-btn').addEventListener('click', () => { goHome(); showScreen('home'); });
});
