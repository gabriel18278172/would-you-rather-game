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
  if (appReady) playSound('theme-chime');
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

    // Helper to create a quick oscillator node
    function osc(freq, waveType, startGain, endGain, startTime, duration) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = waveType;
      g.gain.setValueAtTime(startGain, startTime);
      g.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), startTime + duration);
      o.start(startTime); o.stop(startTime + duration + 0.02);
    }

    const t = ctx.currentTime;

    switch (type) {

      // ── existing basic sounds ──────────────────────────────────────────────
      case 'click':
        osc(800, 'sine', 0.1, 0.001, t, 0.1);
        break;

      case 'ding':
        osc(1200, 'sine', 0.15, 0.001, t, 0.4);
        break;

      case 'tick':
        osc(440, 'square', 0.05, 0.001, t, 0.05);
        break;

      case 'milestone':
        [523, 659, 784, 1047].forEach((freq, i) => osc(freq, 'sine', 0.15, 0.001, t + i * 0.1, 0.3));
        break;

      // ── navigation & UI ───────────────────────────────────────────────────
      case 'swoosh': {
        // Screen transition swoosh — sweeping sine
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(200, t);
        o2.frequency.exponentialRampToValueAtTime(600, t + 0.18);
        g2.gain.setValueAtTime(0.08, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o2.start(t); o2.stop(t + 0.27);
        break;
      }

      case 'hover': {
        // Subtle tick on button hover
        osc(1000, 'sine', 0.03, 0.001, t, 0.04);
        break;
      }

      case 'menu-open': {
        osc(440, 'sine', 0.06, 0.001, t, 0.1);
        osc(550, 'sine', 0.05, 0.001, t + 0.06, 0.12);
        break;
      }

      case 'menu-close': {
        osc(550, 'sine', 0.06, 0.001, t, 0.08);
        osc(380, 'sine', 0.05, 0.001, t + 0.05, 0.1);
        break;
      }

      case 'toggle': {
        // Toggle switch click
        osc(900, 'square', 0.04, 0.001, t, 0.04);
        osc(700, 'square', 0.03, 0.001, t + 0.04, 0.04);
        break;
      }

      case 'theme-chime': {
        // Unique short melody when switching colour themes
        const notes = [523, 659, 784, 659, 1047];
        notes.forEach((freq, i) => osc(freq, 'sine', 0.1, 0.001, t + i * 0.08, 0.12));
        break;
      }

      case 'error': {
        // Gentle bonk
        osc(220, 'sawtooth', 0.08, 0.001, t, 0.15);
        osc(180, 'sawtooth', 0.06, 0.001, t + 0.08, 0.15);
        break;
      }

      // ── gameplay sounds ───────────────────────────────────────────────────
      case 'question-reveal': {
        // Dramatic reveal — whoosh then sparkle
        const ro = ctx.createOscillator();
        const rg = ctx.createGain();
        ro.connect(rg); rg.connect(ctx.destination);
        ro.type = 'sine';
        ro.frequency.setValueAtTime(120, t);
        ro.frequency.exponentialRampToValueAtTime(800, t + 0.22);
        rg.gain.setValueAtTime(0.0, t);
        rg.gain.linearRampToValueAtTime(0.1, t + 0.05);
        rg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        ro.start(t); ro.stop(t + 0.32);
        osc(1200, 'sine', 0.08, 0.001, t + 0.22, 0.2);
        break;
      }

      case 'hover-a': {
        osc(330, 'sine', 0.04, 0.001, t, 0.1);
        break;
      }

      case 'hover-b': {
        osc(660, 'sine', 0.04, 0.001, t, 0.1);
        break;
      }

      case 'vote-lock': {
        // Satisfying click-lock
        osc(300, 'square', 0.12, 0.001, t, 0.06);
        osc(600, 'sine', 0.15, 0.001, t + 0.05, 0.12);
        osc(900, 'sine', 0.1, 0.001, t + 0.12, 0.15);
        break;
      }

      case 'results-reveal': {
        // Short drum roll then ta-da
        const rolls = 8;
        for (let i = 0; i < rolls; i++) {
          osc(100 + i * 10, 'sawtooth', 0.05, 0.001, t + i * 0.04, 0.05);
        }
        // ta-da chord
        [523, 659, 784].forEach((f, i) => osc(f, 'sine', 0.12, 0.001, t + rolls * 0.04 + i * 0.04, 0.5));
        break;
      }

      case 'majority': {
        // Triumphant fanfare
        [392, 494, 587, 784].forEach((f, i) => osc(f, 'sine', 0.13, 0.001, t + i * 0.07, 0.35));
        break;
      }

      case 'minority': {
        // Playful surprised tone
        osc(523, 'sine', 0.1, 0.001, t, 0.1);
        osc(415, 'sine', 0.1, 0.001, t + 0.1, 0.1);
        osc(330, 'sine', 0.1, 0.001, t + 0.2, 0.2);
        break;
      }

      case 'next-whoosh': {
        // Transition between questions
        const no = ctx.createOscillator();
        const ng = ctx.createGain();
        no.connect(ng); ng.connect(ctx.destination);
        no.type = 'sine';
        no.frequency.setValueAtTime(600, t);
        no.frequency.exponentialRampToValueAtTime(200, t + 0.2);
        ng.gain.setValueAtTime(0.08, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        no.start(t); no.stop(t + 0.24);
        break;
      }

      // ── timed mode sounds ─────────────────────────────────────────────────
      case 'timer-start': {
        osc(660, 'sine', 0.08, 0.001, t, 0.12);
        break;
      }

      case 'halfway-warn': {
        osc(880, 'sine', 0.07, 0.001, t, 0.08);
        osc(880, 'sine', 0.07, 0.001, t + 0.12, 0.08);
        break;
      }

      case 'urgent-tick': {
        // Escalating pitch tick (call multiple times, pitch provided externally
        // via type 'urgent-tick-N'); we just do a sharp high tick
        osc(1200, 'square', 0.07, 0.001, t, 0.05);
        break;
      }

      case 'heartbeat': {
        osc(80, 'sine', 0.18, 0.001, t, 0.12);
        osc(80, 'sine', 0.12, 0.001, t + 0.14, 0.1);
        break;
      }

      case 'times-up': {
        // Buzzer alarm
        [220, 220, 220].forEach((f, i) => osc(f, 'sawtooth', 0.14, 0.001, t + i * 0.15, 0.12));
        break;
      }

      case 'just-in-time': {
        // Exciting close-call sound
        [440, 554, 659, 880].forEach((f, i) => osc(f, 'sine', 0.12, 0.001, t + i * 0.06, 0.15));
        break;
      }

      // ── achievement sounds ────────────────────────────────────────────────
      case 'achievement': {
        // Epic fanfare with rising chords
        const fanfare = [392, 494, 587, 784, 987];
        fanfare.forEach((f, i) => {
          osc(f, 'sine', 0.13, 0.001, t + i * 0.08, 0.4);
          osc(f * 2, 'sine', 0.05, 0.001, t + i * 0.08, 0.25);
        });
        break;
      }

      case 'toast-sparkle': {
        // Sparkle chime for toast
        [1200, 1400, 1600, 1400, 1200].forEach((f, i) => osc(f, 'sine', 0.07, 0.001, t + i * 0.05, 0.1));
        break;
      }

      // ── fun / juice sounds ────────────────────────────────────────────────
      case 'confetti-pop': {
        // Popping sound
        [300, 500, 700, 400, 600].forEach((f, i) => {
          osc(f, 'square', 0.06, 0.001, t + i * 0.035, 0.05);
        });
        break;
      }

      case 'share': {
        // Whoosh send
        const so = ctx.createOscillator();
        const sg = ctx.createGain();
        so.connect(sg); sg.connect(ctx.destination);
        so.type = 'sine';
        so.frequency.setValueAtTime(300, t);
        so.frequency.exponentialRampToValueAtTime(1000, t + 0.15);
        sg.gain.setValueAtTime(0.08, t);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        so.start(t); so.stop(t + 0.22);
        break;
      }

      case 'copy': {
        // Satisfying snap
        osc(800, 'square', 0.08, 0.001, t, 0.04);
        osc(1200, 'sine', 0.07, 0.001, t + 0.03, 0.07);
        break;
      }

      case 'category-tick': {
        osc(700, 'sine', 0.05, 0.001, t, 0.06);
        break;
      }

      case 'levelup': {
        // Level-up fanfare
        const lvl = [262, 330, 392, 523, 659, 784, 1047];
        lvl.forEach((f, i) => {
          osc(f, 'sine', 0.14, 0.001, t + i * 0.07, 0.35);
          if (i < 3) osc(f * 1.5, 'sine', 0.05, 0.001, t + i * 0.07, 0.2);
        });
        break;
      }

      case 'daily-complete': {
        // Daily challenge complete
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => osc(f, 'sine', 0.12, 0.001, t + i * 0.07, 0.3));
        break;
      }

      // ── multiplayer sounds ────────────────────────────────────────────────
      case 'mp-join': {
        // Chime when successfully connected to a room
        [880, 1047, 1319].forEach((f, i) => osc(f, 'sine', 0.1, 0.001, t + i * 0.08, 0.25));
        break;
      }

      case 'mp-player-join': {
        // Notification when another player joins the room
        osc(660, 'sine', 0.1, 0.001, t, 0.1);
        osc(880, 'sine', 0.12, 0.001, t + 0.1, 0.18);
        break;
      }

      case 'mp-player-leave': {
        // Subtle sound when a player disconnects
        osc(440, 'sine', 0.08, 0.001, t, 0.12);
        osc(330, 'sine', 0.06, 0.001, t + 0.1, 0.15);
        break;
      }

      case 'mp-game-start': {
        // Exciting fanfare when game starts
        [392, 523, 659, 784, 1047].forEach((f, i) => {
          osc(f, 'sine', 0.13, 0.001, t + i * 0.07, 0.4);
          osc(f * 1.5, 'sine', 0.04, 0.001, t + i * 0.07, 0.2);
        });
        break;
      }

      case 'mp-all-voted': {
        // All players have voted
        [523, 659, 784].forEach((f, i) => osc(f, 'sine', 0.11, 0.001, t + i * 0.07, 0.28));
        break;
      }

      case 'mp-waiting': {
        // Subtle ambient pulse while waiting
        osc(440, 'sine', 0.05, 0.001, t, 0.15);
        osc(440, 'sine', 0.03, 0.001, t + 0.3, 0.15);
        break;
      }

      // ── navigation sounds ─────────────────────────────────────────────────
      case 'back': {
        // Reverse swoosh for back buttons
        const bo = ctx.createOscillator();
        const bg = ctx.createGain();
        bo.connect(bg); bg.connect(ctx.destination);
        bo.type = 'sine';
        bo.frequency.setValueAtTime(500, t);
        bo.frequency.exponentialRampToValueAtTime(180, t + 0.18);
        bg.gain.setValueAtTime(0.07, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        bo.start(t); bo.stop(t + 0.24);
        break;
      }

      case 'screen-enter': {
        // Variation of swoosh for entering a new screen
        const eo = ctx.createOscillator();
        const eg = ctx.createGain();
        eo.connect(eg); eg.connect(ctx.destination);
        eo.type = 'sine';
        eo.frequency.setValueAtTime(250, t);
        eo.frequency.exponentialRampToValueAtTime(700, t + 0.2);
        eg.gain.setValueAtTime(0.06, t);
        eg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        eo.start(t); eo.stop(t + 0.3);
        break;
      }

      // ── input sounds ──────────────────────────────────────────────────────
      case 'type': {
        // Very subtle key tap when typing in input fields
        osc(900, 'square', 0.025, 0.001, t, 0.03);
        break;
      }

      case 'input-clear': {
        // Quick sound when an input field is cleared
        osc(600, 'sine', 0.06, 0.001, t, 0.05);
        osc(400, 'sine', 0.04, 0.001, t + 0.04, 0.05);
        break;
      }

      // ── result sounds ─────────────────────────────────────────────────────
      case 'bar-fill': {
        // Satisfying filling-up sound
        const fo = ctx.createOscillator();
        const fg = ctx.createGain();
        fo.connect(fg); fg.connect(ctx.destination);
        fo.type = 'sine';
        fo.frequency.setValueAtTime(300, t);
        fo.frequency.linearRampToValueAtTime(600, t + 0.4);
        fg.gain.setValueAtTime(0.06, t);
        fg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        fo.start(t); fo.stop(t + 0.47);
        break;
      }

      case 'number-tick': {
        // Quick tick as vote numbers count up
        osc(700, 'square', 0.03, 0.001, t, 0.025);
        break;
      }

      // ── gameplay sounds ───────────────────────────────────────────────────
      case 'timeout-warning': {
        // More dramatic warning at 2 seconds left
        osc(1400, 'square', 0.1, 0.001, t, 0.06);
        osc(1400, 'square', 0.1, 0.001, t + 0.1, 0.06);
        osc(1400, 'square', 0.12, 0.001, t + 0.2, 0.08);
        break;
      }

      case 'streak': {
        // Quick ascending notes for 3+ answers in a row
        [523, 659, 784, 1047].forEach((f, i) => osc(f, 'sine', 0.12, 0.001, t + i * 0.05, 0.12));
        break;
      }

      case 'rare-question': {
        // Special sparkle sound for rarely-answered questions
        [1200, 1500, 1800, 1500, 1200, 1500, 1800].forEach((f, i) =>
          osc(f, 'sine', 0.06, 0.001, t + i * 0.04, 0.08));
        break;
      }

      // ── celebration sounds ────────────────────────────────────────────────
      case 'perfect-split': {
        // Special sound for exactly 50/50 vote split
        [523, 523, 659, 659, 784, 784].forEach((f, i) =>
          osc(f, 'sine', 0.1, 0.001, t + i * 0.06, 0.15));
        break;
      }

      case 'landslide': {
        // Dramatic sound for 90%+ one-sided vote
        const lo = ctx.createOscillator();
        const lg = ctx.createGain();
        lo.connect(lg); lg.connect(ctx.destination);
        lo.type = 'sawtooth';
        lo.frequency.setValueAtTime(200, t);
        lo.frequency.exponentialRampToValueAtTime(600, t + 0.3);
        lg.gain.setValueAtTime(0.0, t);
        lg.gain.linearRampToValueAtTime(0.12, t + 0.05);
        lg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        lo.start(t); lo.stop(t + 0.42);
        [392, 784].forEach((f, i) => osc(f, 'sine', 0.1, 0.001, t + 0.3 + i * 0.08, 0.25));
        break;
      }

      case 'personal-best': {
        // New fastest answer time
        [659, 784, 988, 1319].forEach((f, i) => {
          osc(f, 'sine', 0.12, 0.001, t + i * 0.06, 0.3);
          osc(f * 2, 'sine', 0.04, 0.001, t + i * 0.06, 0.15);
        });
        break;
      }

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

// ===== XP / LEVEL SYSTEM =====

const XP_PER_QUESTION = 10;
const XP_PER_TIMED_BONUS = 5;
const XP_PER_SECOND_REMAINING = 1;

function xpForLevel(level) {
  // Level N requires N * 100 XP total (0→1: 100, 1→2: 200, etc.)
  return level * 100;
}

function loadXP() {
  try {
    const saved = localStorage.getItem('wyr_xp_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { xp: 0, level: 1 };
}

function saveXP() {
  try {
    localStorage.setItem('wyr_xp_v1', JSON.stringify(xpData));
  } catch (e) {}
}

let xpData = loadXP();

function earnXP(amount) {
  xpData.xp += amount;
  let leveled = false;
  while (xpData.xp >= xpForLevel(xpData.level)) {
    xpData.xp -= xpForLevel(xpData.level);
    xpData.level++;
    leveled = true;
  }
  saveXP();
  renderXPBars();
  if (leveled) {
    triggerLevelUp(xpData.level);
  }
}

function renderXPBars() {
  const needed = xpForLevel(xpData.level);
  const pct = Math.min(100, Math.round((xpData.xp / needed) * 100));

  // Home screen XP bar
  const homeNum = document.getElementById('home-level-num');
  const homeText = document.getElementById('home-xp-text');
  const homeNext = document.getElementById('home-xp-next');
  const homeFill = document.getElementById('home-xp-fill');
  if (homeNum) homeNum.textContent = xpData.level;
  if (homeText) homeText.textContent = xpData.xp + ' XP';
  if (homeNext) homeNext.textContent = (needed - xpData.xp) + ' XP to next';
  if (homeFill) homeFill.style.width = pct + '%';

  // In-game XP row
  const gameLabel = document.getElementById('game-xp-label');
  const gameFill = document.getElementById('game-xp-fill');
  if (gameLabel) gameLabel.textContent = `Lv.${xpData.level} · ${xpData.xp} XP`;
  if (gameFill) gameFill.style.width = pct + '%';
}

function triggerLevelUp(newLevel) {
  playSound('levelup');
  triggerConfetti();
  const banner = document.getElementById('levelup-banner');
  const title = document.getElementById('levelup-title');
  const subtitle = document.getElementById('levelup-subtitle');
  if (!banner) return;
  if (title) title.textContent = '⭐ Level Up!';
  if (subtitle) subtitle.textContent = `You reached Level ${newLevel}!`;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3200);
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
  playSound('achievement');
  playSound('toast-sparkle');
}

// ===== CONFETTI =====

function triggerConfetti() {
  playSound('confetti-pop');
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

// ===== SPARKLE PARTICLES =====

function spawnSparkles(x, y) {
  const container = document.getElementById('sparkle-container');
  if (!container) return;
  const colors = ['#4f46e5','#f97316','#06b6d4','#22c55e','#a855f7','#eab308','#ef4444'];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    const size = Math.random() * 8 + 4;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 80 + 40;
    el.style.cssText = `
      left:${x}px; top:${y}px;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --sx:${Math.cos(angle) * dist}px;
      --sy:${Math.sin(angle) * dist}px;
      animation-delay:${Math.random() * 0.15}s;
      animation-duration:${0.5 + Math.random() * 0.4}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

// ===== SCREEN SHAKE =====

function triggerScreenShake() {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('screen-shake');
  void app.offsetWidth; // reflow
  app.classList.add('screen-shake');
  setTimeout(() => app.classList.remove('screen-shake'), 600);
}

// ===== FUN POPUP =====

const FUN_MESSAGES_GENERAL = [
  'Nice pick! 🎯', 'Interesting choice! 🤔', 'Bold move! 💪',
  'Classic! 👌', 'Controversial! 🌶️', 'Solid choice! ✅', 'Intriguing… 🧐',
  'Respect! 🫡', 'No going back now! 🚀', 'The people have spoken! 📢',
];
const FUN_MESSAGES_MAJORITY = [
  'Great minds think alike! 🧠', 'Popular choice! 🏆',
  'You\'re with the crowd! 🎉', 'You and {pct}% agree! 🤝',
  'The majority rules! 👑',
];
const FUN_MESSAGES_MINORITY = [
  'Unique thinker! 💎', 'Plot twist! 🎬', 'Standing out from the crowd! ⭐',
  'Rare opinion! 🦄', 'Going against the grain! 🔥', 'Rebel! ✊',
];

let funPopupTimer = null;

function showFunPopup(choice, pctA, pctB) {
  const chosenPct = choice === 'A' ? pctA : pctB;
  let msg;
  if (chosenPct >= 55) {
    const raw = FUN_MESSAGES_MAJORITY[Math.floor(Math.random() * FUN_MESSAGES_MAJORITY.length)];
    msg = raw.replace('{pct}', chosenPct);
  } else if (chosenPct <= 40) {
    msg = FUN_MESSAGES_MINORITY[Math.floor(Math.random() * FUN_MESSAGES_MINORITY.length)];
  } else {
    msg = FUN_MESSAGES_GENERAL[Math.floor(Math.random() * FUN_MESSAGES_GENERAL.length)];
  }
  const el = document.getElementById('fun-popup');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (funPopupTimer) clearTimeout(funPopupTimer);
  funPopupTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ===== COMBO COUNTER =====

const COMBO_LABELS = ['', '', '', 'FAST! ⚡', 'LIGHTNING! ⚡⚡', 'INSANE! 🔥🔥🔥'];

let comboCount = 0;
let comboTimer = null;

function triggerCombo(secondsRemaining, totalDuration) {
  const ratio = secondsRemaining / totalDuration;
  if (ratio > 0.6) comboCount++;
  else comboCount = 0;

  if (comboCount >= 3) {
    const label = COMBO_LABELS[Math.min(comboCount, COMBO_LABELS.length - 1)];
    showComboPopup(label);
    playSound('streak');
  }
}

function showComboPopup(text) {
  const el = document.getElementById('combo-popup');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  if (comboTimer) clearTimeout(comboTimer);
  comboTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

// ===== SESSION PROGRESS BAR =====

const SESSION_MILESTONE = 20; // bar fills over 20 questions

function updateSessionProgressBar() {
  const fill = document.getElementById('session-progress-fill');
  const label = document.getElementById('session-progress-label');
  if (fill) fill.style.width = Math.min(100, (sessionAnswered / SESSION_MILESTONE) * 100) + '%';
  if (label) label.textContent = sessionAnswered + ' answered';
}

// ===== DAILY CHALLENGE =====

const DAILY_CHALLENGES = [
  { category: 'Food',          goal: 10, desc: 'Answer 10 Food questions today!' },
  { category: 'Funny',         goal: 10, desc: 'Answer 10 Funny questions today!' },
  { category: 'Superpowers',   goal: 8,  desc: 'Answer 8 Superpowers questions today!' },
  { category: 'Animals',       goal: 10, desc: 'Answer 10 Animals questions today!' },
  { category: 'Hypothetical',  goal: 8,  desc: 'Answer 8 Hypothetical questions today!' },
  { category: 'Sports',        goal: 10, desc: 'Answer 10 Sports questions today!' },
  { category: 'Travel',        goal: 8,  desc: 'Answer 8 Travel questions today!' },
  { category: 'Technology',    goal: 10, desc: 'Answer 10 Technology questions today!' },
  { category: 'Money',         goal: 8,  desc: 'Answer 8 Money questions today!' },
  { category: 'Relationships', goal: 8,  desc: 'Answer 8 Relationships questions today!' },
  { category: 'Random',        goal: 12, desc: 'Answer 12 Random questions today!' },
  { category: 'School',        goal: 10, desc: 'Answer 10 School questions today!' },
];

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function getTodayChallenge() {
  // Use date as seed to pick a consistent challenge per day
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return DAILY_CHALLENGES[seed % DAILY_CHALLENGES.length];
}

function loadDailyProgress() {
  try {
    const saved = localStorage.getItem('wyr_daily_v1');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === todayKey()) return data;
    }
  } catch (e) {}
  return { date: todayKey(), progress: 0, completed: false };
}

function saveDailyProgress(data) {
  try {
    localStorage.setItem('wyr_daily_v1', JSON.stringify(data));
  } catch (e) {}
}

let dailyProgress = loadDailyProgress();

function recordDailyProgress(category) {
  const challenge = getTodayChallenge();
  if (dailyProgress.completed) return;
  if (category !== challenge.category) return;
  dailyProgress.progress = (dailyProgress.progress || 0) + 1;
  if (dailyProgress.progress >= challenge.goal) {
    dailyProgress.completed = true;
    saveDailyProgress(dailyProgress);
    completeDailyChallenge();
  } else {
    saveDailyProgress(dailyProgress);
  }
  renderDailyBadge();
}

function completeDailyChallenge() {
  playSound('daily-complete');
  triggerConfetti();
  earnXP(50);
  showToast('🎯 Daily Champion! Challenge Complete! +50 XP 🏆', 4000);
  renderDailyScreen();
}

function renderDailyBadge() {
  const badge = document.getElementById('daily-badge');
  if (!badge) return;
  const challenge = getTodayChallenge();
  const dp = loadDailyProgress();
  if (dp.completed) {
    badge.textContent = '✓ Done';
    badge.classList.add('done');
  } else if (dp.progress > 0) {
    badge.textContent = `${dp.progress}/${challenge.goal}`;
    badge.classList.remove('done');
  } else {
    badge.textContent = 'NEW';
    badge.classList.remove('done');
  }
}

function renderDailyScreen() {
  const challenge = getTodayChallenge();
  const dp = loadDailyProgress();
  const desc = document.getElementById('daily-desc');
  const progressText = document.getElementById('daily-progress-text');
  const progressFill = document.getElementById('daily-progress-fill');
  const progressPct = document.getElementById('daily-progress-pct');
  const rewardText = document.getElementById('daily-reward-text');
  if (desc) desc.textContent = challenge.desc;
  const prog = dp.progress || 0;
  const pct = Math.min(100, Math.round((prog / challenge.goal) * 100));
  if (progressText) progressText.textContent = `${prog} / ${challenge.goal}`;
  if (progressFill) progressFill.style.width = pct + '%';
  if (progressPct) progressPct.textContent = pct + '%';
  if (rewardText) {
    rewardText.textContent = dp.completed ? '✅ Completed! +50 XP earned!' : 'Reward: +50 XP + Daily Champion toast';
  }
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
  currentQuestionIndex: 0, // actual index in the questions[] array (used as API key)
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

  playSound('timer-start');

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerUI();

    const progress = timerRemaining / timerDuration;
    if (timerRemaining === Math.floor(timerDuration / 2) && timerRemaining > 0) {
      // Halfway warning
      playSound('halfway-warn');
    }
    if (timerRemaining <= 5 && timerRemaining > 3) {
      playSound('urgent-tick');
      document.getElementById('timer-container')?.classList.add('timer-warning');
    }
    if (timerRemaining <= 3 && timerRemaining > 0) {
      playSound('heartbeat');
      document.getElementById('timer-container')?.classList.add('timer-warning');
      triggerScreenShake();
    }
    if (timerRemaining === 2) {
      playSound('timeout-warning');
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
  playSound('times-up');
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
  state.currentQuestionIndex = idx; // track actual index for API
  state.currentIndex = (state.currentIndex + 1) % state.questions.length;
  return questions[idx];
}

// ===== DOM HELPERS =====

const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = $('screen-' + name);
  if (s) s.classList.add('active');
  if (appReady) playSound('swoosh');
}

let appReady = false;

let toastTimer;
function showToast(msg, duration = 2800) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(id, msg, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.innerHTML = msg;
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

// ===== VOTE API HELPERS =====

const API_BASE = ''; // Empty string = same origin (works when served by server.js)

async function submitVote(questionIndex, choice) {
  try {
    const res = await fetch(`${API_BASE}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, choice })
    });
    if (!res.ok) throw new Error(`Vote failed with status ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('Vote API unavailable, using fallback');
    return null;
  }
}

async function getVotes(questionIndex) {
  try {
    const res = await fetch(`${API_BASE}/api/votes/${questionIndex}`);
    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

function formatNumber(n) {
  return n.toLocaleString();
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
    btn.classList.remove('selected', 'winner-pulse', 'glow');
  });

  $('solo-results').classList.remove('visible');
  $('solo-bar-a').style.width = '0%';
  $('solo-bar-b').style.width = '0%';
  $('solo-next-btn').style.display = 'none';
  $('solo-share-btn').style.display = 'none';

  // Question reveal sound
  playSound('question-reveal');

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

  $('solo-opt-a').classList.toggle('selected', choice === 'A');
  $('solo-opt-b').classList.toggle('selected', choice === 'B');
  $('solo-opt-a').disabled = true;
  $('solo-opt-b').disabled = true;

  // Glow on chosen option
  const chosenBtn = $(choice === 'A' ? 'solo-opt-a' : 'solo-opt-b');
  chosenBtn.classList.add('glow');

  // Sparkles at button position
  if (chosenBtn) {
    const rect = chosenBtn.getBoundingClientRect();
    spawnSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  // Session tracking
  sessionAnswered++;
  if (choice === 'A') sessionChoicesA++; else sessionChoicesB++;

  // Persistent stats
  recordAnswer(choice, elapsed, state.currentQuestion?.category);

  // Daily challenge tracking
  recordDailyProgress(state.currentQuestion?.category);

  // XP earn
  let xpEarned = XP_PER_QUESTION;
  if (state.mode === 'timed') {
    xpEarned += XP_PER_TIMED_BONUS;
    if (elapsed !== null && timerDuration > 0) {
      const remaining = Math.max(0, timerDuration - elapsed);
      xpEarned += Math.floor(remaining * XP_PER_SECOND_REMAINING);
    }
  }
  earnXP(xpEarned);

  // Combo (timed mode)
  if (state.mode === 'timed' && elapsed !== null) {
    triggerCombo(Math.max(0, timerDuration - elapsed), timerDuration);
  }

  // Session progress bar
  updateSessionProgressBar();

  playSound('vote-lock');

  // Stats milestone sounds
  if ([50, 100, 500, 1000].includes(stats.totalAnswered)) {
    setTimeout(() => playSound('milestone'), 400);
  }

  // Attempt to submit the real vote to the API, fall back to simulated crowd
  submitVote(state.currentQuestionIndex, choice).then(data => {
    let pctA, pctB, votesA, votesB;

    if (data && typeof data.a === 'number' && typeof data.b === 'number') {
      // Real votes from server
      const total = data.a + data.b;
      if (total > 0) {
        pctA = Math.round((data.a / total) * 100);
        pctB = 100 - pctA;
      } else {
        pctA = choice === 'A' ? 100 : 0;
        pctB = 100 - pctA;
      }
      votesA = data.a;
      votesB = data.b;
    } else {
      // Fallback: simulate crowd — majority matches player's choice
      const majorityPct = Math.floor(Math.random() * 40) + 51;
      const minorityPct = 100 - majorityPct;
      pctA = choice === 'A' ? majorityPct : minorityPct;
      pctB = 100 - pctA;
      votesA = pctA;
      votesB = pctB;
    }

    state.votesA = votesA;
    state.votesB = votesB;

    lastAnsweredQuestion = state.currentQuestion;
    lastChoice = choice;
    lastPctA = pctA;
    lastPctB = pctB;

    $('solo-pct-a').textContent = pctA + '%';
    $('solo-pct-b').textContent = pctB + '%';
    $('solo-votes-a').textContent = `${formatNumber(votesA)} vote${votesA !== 1 ? 's' : ''}`;
    $('solo-votes-b').textContent = `${formatNumber(votesB)} vote${votesB !== 1 ? 's' : ''}`;

    const total = votesA + votesB;
    $('solo-total').textContent = `${formatNumber(total)} total responses`;

    $('solo-results').classList.add('visible');
    setTimeout(() => {
      $('solo-bar-a').style.width = pctA + '%';
      $('solo-bar-b').style.width = pctB + '%';
      playSound('bar-fill');
    }, 60);

    // Winner pulse + bounce on pct numbers
    setTimeout(() => {
      const winnerBtn = $(pctA >= pctB ? 'solo-opt-a' : 'solo-opt-b');
      winnerBtn.classList.add('winner-pulse');
      setTimeout(() => winnerBtn.classList.remove('winner-pulse'), 800);

      // Bounce chosen pct element
      const chosenPctEl = $(choice === 'A' ? 'solo-pct-a' : 'solo-pct-b');
      if (chosenPctEl) {
        chosenPctEl.classList.add('bounce');
        setTimeout(() => chosenPctEl.classList.remove('bounce'), 600);
      }

      // Results reveal sound
      playSound('results-reveal');

      // Fun popup
      showFunPopup(choice, pctA, pctB);

      // Special split sounds based on percentages
      if (pctA === 50 && pctB === 50) {
        setTimeout(() => playSound('perfect-split'), 600);
      } else if (pctA >= 90 || pctB >= 90) {
        setTimeout(() => playSound('landslide'), 600);
      } else {
        // Majority/minority sound + screen shake for minority
        const chosenPct = choice === 'A' ? pctA : pctB;
        if (chosenPct >= 55) {
          setTimeout(() => playSound('majority'), 600);
        } else if (chosenPct <= 40) {
          setTimeout(() => playSound('minority'), 600);
          setTimeout(() => triggerScreenShake(), 700);
        }
      }

      // Personal best sound (new fastest answer)
      if (elapsed !== null && elapsed > 0) {
        const prevBest = stats.fastestAnswer;
        if (prevBest !== null && elapsed < prevBest) {
          setTimeout(() => playSound('personal-best'), 800);
        }
      }
    }, 150);

    $('solo-next-btn').style.display = '';
    $('solo-share-btn').style.display = '';

    // History
    addToHistory(state.currentQuestion, choice, pctA, pctB);
  });
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
  playSound('menu-open');
}

function closeHistory() {
  $('history-panel').classList.remove('open');
  $('history-overlay').classList.remove('show');
  playSound('menu-close');
}

// ===== SHARE =====

function shareResult() {
  const q = lastAnsweredQuestion;
  if (!q) return;
  const chosenPct = lastChoice === 'A' ? lastPctA : lastPctB;
  const url = window.location.href;
  const text = `🤔 Would You Rather...\nA) ${q.optionA}\nB) ${q.optionB}\n\nI chose ${lastChoice}! (${chosenPct}% agree)\n\nPlay at: ${url}`;

  if (navigator.share) {
    playSound('share');
    navigator.share({ title: 'Would You Rather?', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      playSound('copy');
      showToast('📋 Copied to clipboard!');
    }).catch(() => {
      playSound('error');
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
    playSound('share');
    navigator.share({ title: 'Would You Rather Stats', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => { playSound('copy'); showToast('📋 Stats copied!'); }).catch(() => { playSound('error'); showToast('Could not copy'); });
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

function initHost(retryCount) {
  retryCount = retryCount || 0;
  state.isHost = true;
  state.mode = 'host';
  state.roomCode = generateRoomCode();
  state.players = [{ id: state.myName, name: state.myName }];
  state.connections = [];
  state.gameStarted = false;

  $('host-room-code').textContent = state.roomCode;
  $('host-room-code-copy').onclick = () => {
    navigator.clipboard.writeText(state.roomCode).then(() => showToast('Room code copied!'));
    playSound('copy');
  };

  setStatus('host-status', 'Connecting to relay…', 'info');

  const Peer = getPeerJS();
  if (!Peer) {
    setStatus('host-status', 'Connection service failed to load. <button class="btn btn-sm btn-secondary" onclick="initHost()">Tap to retry</button>', 'error');
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
      playSound('mp-player-join');

      conn.on('data', data => handleHostData(conn, data));
      conn.on('close', () => {
        state.connections = state.connections.filter(c => c !== conn);
        state.players = state.players.filter(p => p.id !== conn.peer);
        updatePlayerBadge();
        renderPlayerList('host-player-list');
        broadcastToClients({ type: 'players', players: state.players });
        playSound('mp-player-leave');
      });
    });
    conn.on('error', err => console.warn('conn error', err));
  });

  state.peer.on('error', err => {
    if (err.type === 'unavailable-id') {
      state.peer.destroy();
      if (retryCount < 3) {
        state.roomCode = generateRoomCode();
        $('host-room-code').textContent = state.roomCode;
        initHost(retryCount + 1);
      } else {
        setStatus('host-status', 'Could not create room after multiple attempts. <button class="btn btn-sm btn-secondary" onclick="initHost(0)">Try Again</button>', 'error');
      }
    } else {
      setStatus('host-status', 'Connection error: ' + escapeHtml(err.message) + ' <button class="btn btn-sm btn-secondary" onclick="initHost(0)">Try Again</button>', 'error');
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
    setStatus('join-status', 'Connection service failed to load. <button class="btn btn-sm btn-secondary" onclick="submitJoin()">Tap to retry</button>', 'error');
    return;
  }

  state.peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/',
    debug: 0,
  });

  const connectTimeout = setTimeout(() => {
    if (!state.hostConn || !state.hostConn.open) {
      setStatus('join-status', 'Connection timed out. Check the code and try again. <button class="btn btn-sm btn-secondary" onclick="submitJoin()">Retry</button>', 'error');
      if (state.peer) { state.peer.destroy(); state.peer = null; }
    }
  }, 15000);

  state.peer.on('open', () => {
    const hostPeerId = 'wyr-' + state.roomCode;
    state.hostConn = state.peer.connect(hostPeerId, {
      metadata: { name: state.myName },
      reliable: true,
    });

    state.hostConn.on('open', () => {
      clearTimeout(connectTimeout);
      setStatus('join-status', 'Connected! Waiting for host to start the game…', 'success');
      playSound('mp-join');
      showScreen('mp-client-lobby');
    });

    state.hostConn.on('data', data => handleClientData(data));

    state.hostConn.on('close', () => {
      showToast('Disconnected from host.');
      goHome();
    });

    state.hostConn.on('error', () => {
      clearTimeout(connectTimeout);
      setStatus('join-status', 'Could not connect. Check the code and try again. <button class="btn btn-sm btn-secondary" onclick="submitJoin()">Retry</button>', 'error');
    });
  });

  state.peer.on('error', err => {
    clearTimeout(connectTimeout);
    if (err.type === 'peer-unavailable') {
      setStatus('join-status', 'Room not found. Double-check the code. <button class="btn btn-sm btn-secondary" onclick="submitJoin()">Retry</button>', 'error');
    } else {
      setStatus('join-status', 'Error: ' + escapeHtml(err.message) + ' <button class="btn btn-sm btn-secondary" onclick="submitJoin()">Retry</button>', 'error');
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
      playSound('mp-all-voted');
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

  playSound('mp-game-start');
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
    playSound('bar-fill');
  }, 60);

  if (state.isHost) $('mp-next-btn').style.display = '';

  // Special celebration sounds based on vote split
  if (pctA === 50 && pctB === 50) {
    playSound('perfect-split');
  } else if (pctA >= 90 || pctB >= 90) {
    playSound('landslide');
  } else {
    playSound('ding');
  }
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
  showScreen('mp-create');
  $('create-name-input').value = '';
  setStatus('create-status', '', 'info');
  setTimeout(() => $('create-name-input').focus(), 100);
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

  // Render XP bar on load
  renderXPBars();
  renderDailyBadge();
  appReady = true;

  // --- Header ---
  $('btn-theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    playSound('toggle');
    setDarkMode(!isDark);
  });

  $('btn-settings').addEventListener('click', () => {
    loadSettingsScreen();
    showScreen('settings');
  });

  // --- Home screen ---
  $('btn-solo').addEventListener('click', () => showCategoryPicker('solo'));
  $('btn-timed').addEventListener('click', () => showScreen('timed-setup'));
  $('btn-daily').addEventListener('click', () => {
    renderDailyScreen();
    showScreen('daily');
  });
  $('btn-multiplayer').addEventListener('click', showMpSetup);
  $('btn-stats').addEventListener('click', () => {
    loadStatsScreen();
    showScreen('stats');
  });

  // --- Category picker ---
  $('btn-category-back').addEventListener('click', () => { playSound('back'); showScreen('home'); });
  $('btn-cat-all').addEventListener('click', () => {
    document.querySelectorAll('#category-checkboxes input[type=checkbox]').forEach(cb => cb.checked = true);
    playSound('category-tick');
  });
  $('btn-cat-none').addEventListener('click', () => {
    document.querySelectorAll('#category-checkboxes input[type=checkbox]').forEach(cb => cb.checked = false);
    playSound('category-tick');
  });
  $('btn-category-start').addEventListener('click', () => {
    selectedCategories = getSelectedCategories();
    if (selectedCategories.size === 0) {
      playSound('error');
      showToast('⚠️ Please select at least one category!');
      return;
    }
    startSolo(pendingGameMode);
  });

  // Category checkbox tick sounds
  document.getElementById('category-checkboxes')?.addEventListener('change', () => {
    playSound('category-tick');
  });

  // --- Timed setup ---
  $('btn-timed-back').addEventListener('click', () => { playSound('back'); showScreen('home'); });
  $('btn-timed-start').addEventListener('click', () => {
    const checked = document.querySelector('input[name="timer-duration"]:checked');
    timerDuration = checked ? parseInt(checked.value) : 10;
    showCategoryPicker('timed');
  });

  // --- Stats ---
  $('btn-stats-back').addEventListener('click', () => { playSound('back'); showScreen('home'); });
  $('btn-share-stats').addEventListener('click', shareStats);

  // --- Settings ---
  $('btn-settings-back').addEventListener('click', () => { playSound('back'); showScreen('home'); });
  $('setting-dark-mode').addEventListener('change', e => {
    playSound('toggle');
    setDarkMode(e.target.checked);
  });
  $('setting-sounds').addEventListener('change', e => {
    localStorage.setItem('wyr_sounds', e.target.checked ? 'true' : 'false');
    if (e.target.checked) playSound('toggle');
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

  // --- Daily challenge ---
  $('btn-daily-back').addEventListener('click', () => { playSound('back'); showScreen('home'); });
  $('btn-daily-start').addEventListener('click', () => {
    const challenge = getTodayChallenge();
    selectedCategories = new Set([challenge.category]);
    startSolo('solo');
  });

  // --- Solo game ---
  $('solo-opt-a').addEventListener('click', () => soloVote('A'));
  $('solo-opt-b').addEventListener('click', () => soloVote('B'));
  $('solo-opt-a').addEventListener('mouseenter', () => { if (!state.voted) playSound('hover-a'); });
  $('solo-opt-b').addEventListener('mouseenter', () => { if (!state.voted) playSound('hover-b'); });
  $('solo-next-btn').addEventListener('click', () => {
    playSound('next-whoosh');
    loadSoloQuestion();
  });
  $('solo-share-btn').addEventListener('click', shareResult);
  $('solo-home-btn').addEventListener('click', () => {
    clearTimer();
    showSessionSummary();
  });
  $('btn-history').addEventListener('click', openHistory);

  // Button hover sounds (general)
  document.querySelectorAll('.btn, .icon-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => playSound('hover'));
  });

  // --- History panel ---
  $('btn-history-close').addEventListener('click', closeHistory);
  $('history-overlay').addEventListener('click', closeHistory);

  // --- Session summary ---
  $('btn-play-again').addEventListener('click', () => startSolo(state.mode));
  $('btn-summary-home').addEventListener('click', goHome);

  // --- Multiplayer setup ---
  $('btn-mp-back').addEventListener('click', () => { playSound('back'); goHome(); });
  $('btn-mp-create').addEventListener('click', showMpCreate);
  $('btn-mp-join').addEventListener('click', showMpJoin);

  // --- Create room screen ---
  $('btn-create-back').addEventListener('click', () => { playSound('back'); showScreen('mp-setup'); });
  $('create-name-input').addEventListener('input', () => playSound('type'));
  $('btn-create-submit').addEventListener('click', () => {
    const name = $('create-name-input').value.trim().slice(0, 20);
    if (!name) {
      setStatus('create-status', 'Please enter your name.', 'error');
      playSound('error');
      return;
    }
    state.myName = name;
    initHost();
  });
  $('create-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-create-submit').click();
  });

  // --- Join screen ---
  $('btn-join-back').addEventListener('click', () => { playSound('back'); showScreen('mp-setup'); });
  $('btn-join-submit').addEventListener('click', submitJoin);
  $('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitJoin(); });
  $('join-code-input').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    playSound('type');
  });
  $('join-name-input').addEventListener('input', () => playSound('type'));

  // --- Host lobby ---
  $('btn-host-back').addEventListener('click', () => { playSound('back'); goHome(); showScreen('mp-setup'); });
  $('btn-host-start').addEventListener('click', hostStartGame);

  // --- Client lobby ---
  $('btn-client-back').addEventListener('click', () => { playSound('back'); goHome(); showScreen('home'); });

  // --- Multiplayer game ---
  $('mp-opt-a').addEventListener('click', () => mpVote('A'));
  $('mp-opt-b').addEventListener('click', () => mpVote('B'));
  $('mp-next-btn').addEventListener('click', mpNextQuestion);
  $('mp-home-btn').addEventListener('click', () => { playSound('back'); goHome(); showScreen('home'); });
});
