// ======================== Timer ========================
class Timer {
  constructor() {
    this.remaining = 0;
    this.total = 0;
    this.interval = null;
    this.running = false;
    this.phase = 'work'; // work | break | longbreak
    this.onTick = null;
    this.onComplete = null;
    this.onPhaseChange = null;
  }

  start(durationSeconds, phase) {
    this.stop();
    this.phase = phase;
    this.total = durationSeconds;
    this.remaining = durationSeconds;
    this.running = true;

    if (this.onPhaseChange) this.onPhaseChange(phase);

    this.interval = setInterval(() => {
      this.remaining--;
      if (this.onTick) this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete(this.phase);
      }
    }, 1000);
  }

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.running = false;
    }
  }

  resume() {
    if (!this.running && this.remaining > 0) {
      this.running = true;
      this.interval = setInterval(() => {
        this.remaining--;
        if (this.onTick) this.onTick(this.remaining);
        if (this.remaining <= 0) {
          this.stop();
          if (this.onComplete) this.onComplete(this.phase);
        }
      }, 1000);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }

  reset() {
    this.stop();
    this.remaining = this.total;
    if (this.onTick) this.onTick(this.remaining);
  }

  getProgress() {
    if (this.total === 0) return 0;
    return 1 - (this.remaining / this.total);
  }
}

// ======================== TaskManager ========================
class TaskManager {
  constructor() {
    this.tasks = this.load();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem('pomodoro_tasks')) || [];
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(this.tasks));
  }

  add(text) {
    const task = {
      id: Date.now().toString(),
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
    };
    this.tasks.unshift(task);
    this.save();
    return task;
  }

  toggle(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.done = !task.done;
      this.save();
    }
    return task;
  }

  remove(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
  }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => !t.done);
    this.save();
  }

  getStats() {
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.done).length;
    return { total, done };
  }
}

// ======================== StatsManager ========================
class StatsManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem('pomodoro_stats')) || { days: {} };
    } catch {
      return { days: {} };
    }
  }

  save() {
    localStorage.setItem('pomodoro_stats', JSON.stringify(this.data));
  }

  getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  recordPomodoro() {
    const key = this.getTodayKey();
    if (!this.data.days[key]) {
      this.data.days[key] = { count: 0, focusMinutes: 0 };
    }
    this.data.days[key].count++;
    // Default work session is 25 min
    this.data.days[key].focusMinutes += 25;
    this.save();
  }

  getToday() {
    const key = this.getTodayKey();
    return this.data.days[key] || { count: 0, focusMinutes: 0 };
  }

  getWeek() {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (this.data.days[key]) {
        total += this.data.days[key].count;
      }
    }
    return total;
  }

  getTotal() {
    let total = 0;
    for (const key in this.data.days) {
      total += this.data.days[key].count;
    }
    return total;
  }

  getLast7Days() {
    const result = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const minutes = this.data.days[key] ? this.data.days[key].focusMinutes : 0;
      result.push({ label, minutes, count: this.data.days[key] ? this.data.days[key].count : 0 });
    }
    return result;
  }

  reset() {
    this.data = { days: {} };
    this.save();
  }
}

// ======================== Sound Engine ========================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseNode = null;
    this.noiseGain = null;
    this.noisePlaying = false;
  }

  ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Alarm beep — plays 3 quick beeps
  playAlarm() {
    const ctx = this.ensureCtx();
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.2);

      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.2);
    }
  }

  // White noise generator
  startWhiteNoise(volume = 0.3) {
    if (this.noisePlaying) return;
    const ctx = this.ensureCtx();

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    // Filter to make it sound more natural (pink-ish noise)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start();
    this.noiseNode = source;
    this.noiseGain = gainNode;
    this.noisePlaying = true;
  }

  stopWhiteNoise() {
    if (this.noiseNode) {
      try { this.noiseNode.stop(); } catch {}
      this.noiseNode = null;
      this.noiseGain = null;
    }
    this.noisePlaying = false;
  }

  setNoiseVolume(vol) {
    if (this.noiseGain) {
      this.noiseGain.gain.value = vol;
    }
  }
}

// ======================== Chart Renderer ========================
function renderChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;

  ctx.scale(dpr, dpr);

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#8888aa' : '#7f8c8d';
  const barColor = isDark ? '#E74C3C' : '#E74C3C';
  const barBg = isDark ? '#2a2a45' : '#ecf0f1';
  const gridColor = isDark ? '#2a2a45' : '#e8e8e8';

  const pad = { top: 20, bottom: 28, left: 10, right: 10 };
  const chartW = w / dpr - pad.left - pad.right;
  const chartH = h / dpr - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w / dpr, h / dpr);

  if (!data || data.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', (w / dpr) / 2, (h / dpr) / 2);
    return;
  }

  const maxVal = Math.max(...data.map(d => d.minutes), 1);
  const barW = chartW / data.length * 0.6;
  const gap = chartW / data.length * 0.4;

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  }

  // Draw bars
  data.forEach((d, i) => {
    const x = pad.left + (barW + gap) * i + gap / 2;
    const barH = (d.minutes / maxVal) * chartH;
    const y = pad.top + chartH - barH;

    // Bar background
    ctx.fillStyle = barBg;
    ctx.beginPath();
    ctx.roundRect(x, pad.top, barW, chartH, [3, 3, 0, 0]);
    ctx.fill();

    // Bar fill
    if (barH > 0) {
      const gradient = ctx.createLinearGradient(x, pad.top, x, pad.top + chartH);
      gradient.addColorStop(0, barColor);
      gradient.addColorStop(1, isDark ? '#C0392B' : '#E74C3C');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
      ctx.fill();

      // Label on top
      if (d.minutes > 0) {
        ctx.fillStyle = textColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.count}`, x + barW / 2, y - 4);
      }
    }

    // Day label
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, pad.top + chartH + 16);
  });
}

// ======================== Main App ========================
class PomodoroApp {
  constructor() {
    this.timer = new Timer();
    this.tasks = new TaskManager();
    this.stats = new StatsManager();
    this.sound = new SoundEngine();

    this.settings = this.loadSettings();
    this.currentPomodoroCount = 0;

    this.dailyCompleted = 0;

    this.setupDOM();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.loadSettings();
    this.applyTheme();
    this.renderTasks();
    this.updateStats();
    this.renderChart();
    this.updateDots();

    // Set initial timer display
    this.setPhaseDisplay('work');
    this.timerDisplay.textContent = this.formatTime(this.getPhaseDuration('work'));
  }

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('pomodoro_settings'));
      if (s) return s;
    } catch {}
    return {
      workDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      longInterval: 4,
      notification: true,
      sound: true,
      autoBreak: true,
      autoWork: false,
      whiteNoise: false,
      noiseVolume: 30,
      darkMode: true,
    };
  }

  saveSettings() {
    localStorage.setItem('pomodoro_settings', JSON.stringify(this.settings));
  }

  setupDOM() {
    this.timerDisplay = document.getElementById('timerDisplay');
    this.timerPhase = document.getElementById('timerPhase');
    this.timerPomodoros = document.getElementById('timerPomodoros');
    this.ringProgress = document.getElementById('ringProgress');
    this.btnStart = document.getElementById('btnStart');
    this.btnReset = document.getElementById('btnReset');
    this.btnSkip = document.getElementById('btnSkip');
    this.progressDots = document.getElementById('progressDots');
    this.progressLabel = document.getElementById('progressLabel');
    this.taskInput = document.getElementById('taskInput');
    this.btnAddTask = document.getElementById('btnAddTask');
    this.taskList = document.getElementById('taskList');
    this.taskCount = document.getElementById('taskCount');
    this.btnClearCompleted = document.getElementById('btnClearCompleted');
    this.statsChart = document.getElementById('statsChart');

    // Settings elements
    this.settingWork = document.getElementById('settingWork');
    this.settingShortBreak = document.getElementById('settingShortBreak');
    this.settingLongBreak = document.getElementById('settingLongBreak');
    this.settingLongInterval = document.getElementById('settingLongInterval');
    this.settingNotification = document.getElementById('settingNotification');
    this.settingSound = document.getElementById('settingSound');
    this.settingAutoBreak = document.getElementById('settingAutoBreak');
    this.settingAutoWork = document.getElementById('settingAutoWork');
    this.settingWhiteNoise = document.getElementById('settingWhiteNoise');
    this.settingNoiseVolume = document.getElementById('settingNoiseVolume');

    // Title bar buttons
    this.btnTheme = document.getElementById('btnTheme');
    this.btnMinimize = document.getElementById('btnMinimize');
    this.btnClose = document.getElementById('btnClose');

    // Stats
    this.statToday = document.getElementById('statToday');
    this.statWeek = document.getElementById('statWeek');
    this.statTotal = document.getElementById('statTotal');
    this.statFocus = document.getElementById('statFocus');
    this.btnResetStats = document.getElementById('btnResetStats');
  }

  setupEventListeners() {
    // Timer controls
    this.btnStart.addEventListener('click', () => this.toggleTimer());
    this.btnReset.addEventListener('click', () => this.resetTimer());
    this.btnSkip.addEventListener('click', () => this.skipPhase());

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
        if (tab.dataset.tab === 'stats') this.renderChart();
      });
    });

    // Tasks
    this.btnAddTask.addEventListener('click', () => this.addTask());
    this.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addTask();
    });
    this.btnClearCompleted.addEventListener('click', () => {
      this.tasks.clearCompleted();
      this.renderTasks();
    });

    // Settings
    const saveSettings = () => this.saveSettings();
    this.settingWork.addEventListener('change', () => {
      this.settings.workDuration = parseInt(this.settingWork.value) || 25;
      saveSettings();
      if (this.timer.phase === 'work' && !this.timer.running) {
        this.timerDisplay.textContent = this.formatTime(this.getPhaseDuration('work'));
      }
    });
    this.settingShortBreak.addEventListener('change', () => {
      this.settings.shortBreak = parseInt(this.settingShortBreak.value) || 5;
      saveSettings();
      if (this.timer.phase === 'break' && !this.timer.running) {
        this.timerDisplay.textContent = this.formatTime(this.getPhaseDuration('break'));
      }
    });
    this.settingLongBreak.addEventListener('change', () => {
      this.settings.longBreak = parseInt(this.settingLongBreak.value) || 15;
      saveSettings();
      if (this.timer.phase === 'longbreak' && !this.timer.running) {
        this.timerDisplay.textContent = this.formatTime(this.getPhaseDuration('longbreak'));
      }
    });
    this.settingLongInterval.addEventListener('change', () => {
      this.settings.longInterval = parseInt(this.settingLongInterval.value) || 4;
      saveSettings();
    });
    this.settingNotification.addEventListener('change', () => {
      this.settings.notification = this.settingNotification.checked;
      saveSettings();
    });
    this.settingSound.addEventListener('change', () => {
      this.settings.sound = this.settingSound.checked;
      saveSettings();
    });
    this.settingAutoBreak.addEventListener('change', () => {
      this.settings.autoBreak = this.settingAutoBreak.checked;
      saveSettings();
    });
    this.settingAutoWork.addEventListener('change', () => {
      this.settings.autoWork = this.settingAutoWork.checked;
      saveSettings();
    });
    this.settingWhiteNoise.addEventListener('change', () => {
      this.settings.whiteNoise = this.settingWhiteNoise.checked;
      saveSettings();
      if (this.settings.whiteNoise) {
        this.sound.startWhiteNoise(this.settings.noiseVolume / 100);
      } else {
        this.sound.stopWhiteNoise();
      }
    });
    this.settingNoiseVolume.addEventListener('input', () => {
      this.settings.noiseVolume = parseInt(this.settingNoiseVolume.value) || 30;
      this.sound.setNoiseVolume(this.settings.noiseVolume / 100);
      saveSettings();
    });

    // Theme
    this.btnTheme.addEventListener('click', () => {
      this.settings.darkMode = !this.settings.darkMode;
      this.applyTheme();
      this.saveSettings();
      this.renderChart();
    });

    // Title bar buttons
    if (window.electronAPI) {
      this.btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
      this.btnClose.addEventListener('click', () => window.electronAPI.closeWindow());
    } else {
      this.btnMinimize.style.display = 'none';
      this.btnClose.style.display = 'none';
    }

    // Reset stats
    this.btnResetStats.addEventListener('click', () => {
      if (confirm('确定要重置所有数据吗？此操作不可撤销。')) {
        this.stats.reset();
        this.updateStats();
        this.renderChart();
        this.currentPomodoroCount = 0;
        this.dailyCompleted = 0;
        this.updateDots();
      }
    });

    // Timer callbacks
    this.timer.onTick = (remaining) => {
      this.timerDisplay.textContent = this.formatTime(remaining);
      this.updateProgress();
      // Update tray tooltip
      const phaseLabel = this.getPhaseLabel(this.timer.phase);
      if (window.electronAPI) {
        window.electronAPI.setTrayTooltip(
          `🍅 ${phaseLabel}: ${this.formatTime(remaining)}`
        );
      }
    };

    this.timer.onComplete = (phase) => {
      this.handlePhaseComplete(phase);
    };

    this.timer.onPhaseChange = (phase) => {
      this.setPhaseDisplay(phase);
    };
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if typing in input
      if (e.target.tagName === 'INPUT') {
        if (e.key === 'Enter' && e.target.id === 'taskInput') {
          this.addTask();
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.toggleTimer();
          break;
        case 'r':
        case 'R':
          this.resetTimer();
          break;
        case 's':
        case 'S':
          this.skipPhase();
          break;
        case 'n':
        case 'N':
          this.taskInput.focus();
          break;
      }
    });
  }

  getPhaseDuration(phase) {
    switch (phase) {
      case 'work': return this.settings.workDuration * 60;
      case 'break': return this.settings.shortBreak * 60;
      case 'longbreak': return this.settings.longBreak * 60;
      default: return 25 * 60;
    }
  }

  getPhaseLabel(phase) {
    switch (phase) {
      case 'work': return '工作中';
      case 'break': return '短休息';
      case 'longbreak': return '长休息';
      default: return '';
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  setPhaseDisplay(phase) {
    this.timerPhase.textContent = this.getPhaseLabel(phase);
    document.body.className = document.body.className.replace(/phase-\w+/g, '');
    document.body.classList.add(`phase-${phase}`);
    this.updateProgress();
  }

  updateProgress() {
    const progress = this.timer.getProgress();
    const circumference = 2 * Math.PI * 100;
    const offset = circumference * (1 - progress);
    this.ringProgress.style.strokeDashoffset = offset;

    // Animate ring container
    const container = document.querySelector('.timer-ring-container');
    container.classList.toggle('running', this.timer.running);
  }

  toggleTimer() {
    if (this.timer.running) {
      this.timer.pause();
      this.btnStart.textContent = '▶ 继续';
      this.btnStart.className = 'ctrl-btn primary';
    } else if (this.timer.remaining > 0) {
      this.timer.resume();
      this.btnStart.textContent = '⏸ 暂停';
      this.btnStart.className = 'ctrl-btn primary running';
    }
  }

  resetTimer() {
    this.timer.reset();
    if (!this.timer.remaining || this.timer.remaining <= 0) {
      const duration = this.getPhaseDuration(this.timer.phase);
      this.timer.total = duration;
      this.timer.remaining = duration;
      this.timerDisplay.textContent = this.formatTime(duration);
    }
    this.btnStart.textContent = '▶ 开始';
    this.btnStart.className = 'ctrl-btn primary';
    this.updateProgress();
  }

  skipPhase() {
    this.timer.stop();
    this.btnStart.textContent = '▶ 开始';
    this.btnStart.className = 'ctrl-btn primary';
    this.handlePhaseComplete(this.timer.phase);
  }

  handlePhaseComplete(phase) {
    // Play sound
    if (this.settings.sound) {
      this.sound.playAlarm();
    }

    // Show notification
    if (this.settings.notification) {
      let title, body;
      if (phase === 'work') {
        title = '🍅 工作完成！';
        body = '太棒了！该休息一下了。';
      } else {
        title = '☕️ 休息结束！';
        body = '准备好迎接下一个番茄了吗？';
      }
      if (window.electronAPI) {
        window.electronAPI.sendNotification(title, body);
      } else {
        // Fallback: try browser notification
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(title, { body });
          });
        }
      }
    }

    if (phase === 'work') {
      // Work session completed - record it
      this.currentPomodoroCount++;
      this.dailyCompleted++;
      this.stats.recordPomodoro();
      this.updateStats();
      this.updateDots();

      // Determine next break type
      const nextPhase = this.currentPomodoroCount % this.settings.longInterval === 0
        ? 'longbreak' : 'break';

      this.timerPomodoros.textContent = `已完成 ${this.currentPomodoroCount} 个番茄`;

      if (this.settings.autoBreak) {
        const duration = this.getPhaseDuration(nextPhase);
        this.timer.start(duration, nextPhase);
        this.btnStart.textContent = '⏸ 暂停';
        this.btnStart.className = 'ctrl-btn primary running';
      } else {
        const duration = this.getPhaseDuration(nextPhase);
        this.timer.total = duration;
        this.timer.remaining = duration;
        this.timer.phase = nextPhase;
        this.timerDisplay.textContent = this.formatTime(duration);
        this.setPhaseDisplay(nextPhase);
        this.btnStart.textContent = '▶ 开始';
        this.btnStart.className = 'ctrl-btn primary';
      }
    } else {
      // Break completed - back to work
      this.timerPomodoros.textContent = `已完成 ${this.currentPomodoroCount} 个番茄`;

      if (this.settings.autoWork) {
        const duration = this.getPhaseDuration('work');
        this.timer.start(duration, 'work');
        this.btnStart.textContent = '⏸ 暂停';
        this.btnStart.className = 'ctrl-btn primary running';
      } else {
        const duration = this.getPhaseDuration('work');
        this.timer.total = duration;
        this.timer.remaining = duration;
        this.timer.phase = 'work';
        this.timerDisplay.textContent = this.formatTime(duration);
        this.setPhaseDisplay('work');
        this.btnStart.textContent = '▶ 开始';
        this.btnStart.className = 'ctrl-btn primary';
      }
    }
  }

  addTask() {
    const text = this.taskInput.value.trim();
    if (!text) return;
    this.tasks.add(text);
    this.taskInput.value = '';
    this.renderTasks();
  }

  renderTasks() {
    const { total, done } = this.tasks.getStats();
    this.taskCount.textContent = `${done}/${total} 已完成`;

    if (this.tasks.tasks.length === 0) {
      this.taskList.innerHTML = '<div class="empty-state">暂无任务，添加一个开始吧</div>';
      return;
    }

    this.taskList.innerHTML = '';
    this.tasks.tasks.forEach(task => {
      const item = document.createElement('div');
      item.className = `task-item${task.done ? ' done' : ''}`;

      const checkbox = document.createElement('div');
      checkbox.className = 'task-checkbox';
      checkbox.addEventListener('click', () => {
        this.tasks.toggle(task.id);
        this.renderTasks();
      });

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      const delBtn = document.createElement('button');
      delBtn.className = 'task-delete';
      delBtn.textContent = '×';
      delBtn.title = '删除任务';
      delBtn.addEventListener('click', () => {
        this.tasks.remove(task.id);
        this.renderTasks();
      });

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(delBtn);
      this.taskList.appendChild(item);
    });
  }

  updateStats() {
    const today = this.stats.getToday();
    this.statToday.textContent = today.count;
    this.statWeek.textContent = this.stats.getWeek();
    this.statTotal.textContent = this.stats.getTotal();

    const hours = Math.floor(today.focusMinutes / 60);
    const mins = today.focusMinutes % 60;
    this.statFocus.textContent = `${hours}h ${mins}m`;

    this.progressLabel.textContent = `今日完成: ${today.count} 个番茄`;
  }

  updateDots() {
    const dots = this.progressDots.querySelectorAll('.dot');
    const today = this.stats.getToday();
    const completed = today.count % dots.length;

    dots.forEach((dot, i) => {
      dot.classList.toggle('completed', i < completed);
    });
  }

  renderChart() {
    if (!this.statsChart) return;
    const data = this.stats.getLast7Days();
    renderChart(this.statsChart, data);
  }

  applyTheme() {
    document.body.classList.toggle('dark', this.settings.darkMode);
    document.body.classList.toggle('light', !this.settings.darkMode);
    this.btnTheme.textContent = this.settings.darkMode ? '🌙' : '☀️';
  }
}

// ======================== Initialize ========================
document.addEventListener('DOMContentLoaded', () => {
  // Request notification permission if in browser
  if (!window.electronAPI && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  window.app = new PomodoroApp();
});
