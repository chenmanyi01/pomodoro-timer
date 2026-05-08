/* ============================
   番茄钟 — 应用逻辑
   ============================ */

// ======================== 倒计时引擎 ========================
class Timer {
  constructor() {
    this.remaining = 0;
    this.total = 0;
    this._id = null;
    this.running = false;
    this.phase = 'work';
    this.onTick = null;
    this.onDone = null;
    this.onPhaseChange = null;
  }

  start(seconds, phase) {
    this.stop();
    this.phase = phase;
    this.total = seconds;
    this.remaining = seconds;
    this.running = true;
    this.onPhaseChange?.(phase);
    this._id = setInterval(() => {
      this.remaining--;
      this.onTick?.(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onDone?.(this.phase);
      }
    }, 1000);
  }

  pause() {
    if (this._id) { clearInterval(this._id); this._id = null; }
    this.running = false;
  }

  resume() {
    if (this.running || this.remaining <= 0) return;
    this.running = true;
    this._id = setInterval(() => {
      this.remaining--;
      this.onTick?.(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onDone?.(this.phase);
      }
    }, 1000);
  }

  stop() {
    if (this._id) { clearInterval(this._id); this._id = null; }
    this.running = false;
  }

  reset() {
    this.stop();
    this.remaining = this.total;
    this.onTick?.(this.remaining);
  }

  get progress() {
    return this.total ? 1 - this.remaining / this.total : 0;
  }
}

// ======================== 任务管理 ========================
class Tasks {
  constructor() { this.list = this._load(); }
  _load() { try { return JSON.parse(localStorage.getItem('tasks')) || []; } catch { return []; } }
  _save() { localStorage.setItem('tasks', JSON.stringify(this.list)); }

  add(text) {
    const t = { id: Date.now()+'', text: text.trim(), done: false };
    this.list.unshift(t); this._save(); return t;
  }
  toggle(id) { const t = this.list.find(x=>x.id===id); if(t){t.done=!t.done;this._save()} return t; }
  remove(id) { this.list = this.list.filter(x=>x.id!==id); this._save(); }
  clearDone() { this.list = this.list.filter(x=>!x.done); this._save(); }
  get counts() { return { total:this.list.length, done:this.list.filter(x=>x.done).length }; }
}

// ======================== 统计管理 ========================
class Stats {
  constructor() { this.data = this._load(); }
  _load() { try { return JSON.parse(localStorage.getItem('stats')) || { days:{} }; } catch { return { days:{} }; } }
  _save() { localStorage.setItem('stats', JSON.stringify(this.data)); }

  _todayKey() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

  record(workMinutes) {
    const k = this._todayKey();
    if (!this.data.days[k]) this.data.days[k] = { count:0, focusMinutes:0 };
    this.data.days[k].count++;
    this.data.days[k].focusMinutes += workMinutes;
    this._save();
  }

  today() { return this.data.days[this._todayKey()] || { count:0, focusMinutes:0 }; }

  week() {
    let t = 0;
    for (let i=0; i<7; i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (this.data.days[k]) t += this.data.days[k].count;
    }
    return t;
  }

  total() {
    return Object.values(this.data.days).reduce((s,d)=>s+d.count, 0);
  }

  last7() {
    const r = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      r.push({
        label: `${d.getMonth()+1}/${d.getDate()}`,
        minutes: this.data.days[k]?.focusMinutes || 0,
        count: this.data.days[k]?.count || 0,
      });
    }
    return r;
  }

  reset() { this.data = { days:{} }; this._save(); }
}

// ======================== 音效引擎 ========================
class Sound {
  constructor() { this.ctx = null; this.src = null; this.gain = null; this.playing = false; }

  _ctx() {
    if (!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  alarm() {
    const c = this._ctx(), now = c.currentTime;
    for (let i=0;i<3;i++) {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.3, now+i*0.3);
      g.gain.exponentialRampToValueAtTime(0.01, now+i*0.3+0.2);
      o.start(now+i*0.3); o.stop(now+i*0.3+0.2);
    }
  }

  startNoise(vol=0.3) {
    if (this.playing) return;
    const c = this._ctx(), len = c.sampleRate*2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const gain = c.createGain(); gain.value = vol;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1000;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start();
    this.src = src; this.gain = gain; this.playing = true;
  }

  stopNoise() { try{this.src?.stop()}catch{} this.src=null; this.gain=null; this.playing=false; }
  setNoise(v) { if(this.gain) this.gain.gain.value = v; }
}

// ======================== 图表 ========================
function drawChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const W = 340, H = 160, dpr = window.devicePixelRatio||1;
  canvas.width = W*dpr; canvas.height = H*dpr;
  ctx.scale(dpr,dpr);
  const dark = document.body.classList.contains('dark');
  const txt = dark ? '#8888aa' : '#7f8c8d';
  const bar = '#E74C3C';
  const grid = dark ? '#2a2a45' : '#e8e8e8';
  const bg = dark ? '#1a1a2e' : '#ffffff';

  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0,0,W,H,12); ctx.fill();

  if (!data?.length) {
    ctx.fillStyle=txt; ctx.font='13px sans-serif'; ctx.textAlign='center';
    ctx.fillText('暂无数据', W/2, H/2); return;
  }

  const PAD = { t:18, b:26, l:10, r:10 };
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d=>d.minutes), 1);
  const bw = cw / data.length * 0.55;
  const gap = cw / data.length * 0.45;

  // 网格
  ctx.strokeStyle = grid; ctx.lineWidth = .5;
  for (let i=0;i<=4;i++) {
    const y = PAD.t + ch/4*i;
    ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(PAD.l+cw,y); ctx.stroke();
  }

  // 柱子
  data.forEach((d,i) => {
    const x = PAD.l + (bw+gap)*i + gap/2;
    const bh = (d.minutes/max)*ch, y = PAD.t+ch-bh;
    ctx.fillStyle = dark ? '#2a2a45' : '#ecf0f1';
    ctx.beginPath(); ctx.roundRect(x, PAD.t, bw, ch, [3,3,0,0]); ctx.fill();
    if (bh>0) {
      const g = ctx.createLinearGradient(x,PAD.t,x,PAD.t+ch);
      g.addColorStop(0,bar); g.addColorStop(1,dark?'#C0392B':'#E74C3C');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, [3,3,0,0]); ctx.fill();
      ctx.fillStyle=txt; ctx.font='10px sans-serif'; ctx.textAlign='center';
      ctx.fillText(d.count, x+bw/2, y-4);
    }
    ctx.fillStyle=txt; ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText(d.label, x+bw/2, PAD.t+ch+16);
  });
}

// ======================== 主应用 ========================
const App = {
  timer: new Timer(),
  tasks: new Tasks(),
  stats: new Stats(),
  sound: new Sound(),

  pomosDone: 0,

  // ---------- 初始化 ----------
  init() {
    this.cache();
    this.loadSettings();
    this.applyTheme();
    this.bindEvents();
    this.renderTasks();
    this.refreshStats();
    this.refreshDots();
    this.setPhase('work');
    this.showTime(this.workSeconds());

    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.target.tagName==='INPUT' && e.target.id==='taskInput') {
        if (e.key==='Enter') this.addTask();
        return;
      }
      switch(e.key) {
        case ' ': e.preventDefault(); this.toggle(); break;
        case 'r': case 'R': this.reset(); break;
        case 's': case 'S': this.skip(); break;
        case 'n': case 'N': document.getElementById('taskInput').focus(); break;
      }
    });

    // 请求通知权限
    if (!window.electronAPI && 'Notification' in window && Notification.permission==='default') {
      Notification.requestPermission();
    }
  },

  // ---------- DOM 缓存 ----------
  cache() {
    this.el = {};
    const ids = ['timerDisplay','phaseLabel','pomoCount','ringProgress',
      'btnStart','btnReset','btnSkip','dotRow','dotLabel',
      'taskInput','btnAddTask','taskList','taskProgress','clearDone',
      'chart','toggleTheme','btnMinimize','btnClose',
      'statToday','statWeek','statTotal','statFocus',
      'sWork','sShort','sLong','sInterval','sNotify','sSound',
      'sAutoBreak','sAutoWork','sNoise','sNoiseVol','resetAll'];
    ids.forEach(id => this.el[id] = document.getElementById(id));
  },

  // ---------- 设置 ----------
  loadSettings() {
    try {
      this.s = JSON.parse(localStorage.getItem('settings'));
    } catch {}
    this.s = Object.assign({
      work:25, short:5, long:15, interval:4,
      notify:true, sound:true, autoBreak:true, autoWork:false,
      noise:false, noiseVol:30, dark:true,
    }, this.s);
  },
  saveSettings() {
    localStorage.setItem('settings', JSON.stringify(this.s));
  },

  // ---------- 事件绑定 ----------
  bindEvents() {
    this.el.btnStart.onclick = () => this.toggle();
    this.el.btnReset.onclick = () => this.reset();
    this.el.btnSkip.onclick = () => this.skip();
    this.el.btnAddTask.onclick = () => this.addTask();
    this.el.clearDone.onclick = () => { this.tasks.clearDone(); this.renderTasks(); };
    this.el.toggleTheme.onclick = () => { this.s.dark=!this.s.dark; this.applyTheme(); this.saveSettings(); this.drawChart(); };

    // 标题栏
    if (window.electronAPI) {
      this.el.btnMinimize.onclick = () => window.electronAPI.minimize();
      this.el.btnClose.onclick = () => window.electronAPI.close();
    } else {
      this.el.btnMinimize.style.display = 'none';
      this.el.btnClose.style.display = 'none';
    }

    // 标签切换
    document.querySelectorAll('.tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-'+tab.dataset.panel).classList.add('active');
        if (tab.dataset.panel === 'stats') this.drawChart();
      };
    });

    // 设置变更
    const debounceSave = () => { this.saveSettings(); this.syncSettings(); };
    ['sWork','sShort','sLong','sInterval'].forEach(id => {
      this.el[id].onchange = debounceSave;
    });
    ['sNotify','sSound','sAutoBreak','sAutoWork','sNoise'].forEach(id => {
      this.el[id].onchange = () => {
        const k = id.replace('s','').toLowerCase();
        const map = { notify:'notify', sound:'sound', autobreak:'autoBreak', autowork:'autoWork', noise:'noise' };
        this.s[map[k]] = this.el[id].checked;
        this.saveSettings();
        if (id === 'sNoise') {
          if (this.s.noise) this.sound.startNoise(this.s.noiseVol/100);
          else this.sound.stopNoise();
        }
      };
    });
    this.el.sNoiseVol.oninput = () => {
      this.s.noiseVol = +this.el.sNoiseVol.value;
      this.sound.setNoise(this.s.noiseVol/100);
      this.saveSettings();
    };

    this.el.resetAll.onclick = () => {
      if (confirm('确定重置所有数据？不可撤销。')) {
        this.stats.reset();
        this.pomosDone = 0;
        this.refreshStats();
        this.refreshDots();
        this.drawChart();
      }
    };

    // 阶段完成回调
    this.timer.onTick = (r) => {
      this.el.timerDisplay.textContent = this.fmt(r);
      this.updateRing();
      window.electronAPI?.setTrayTooltip(`🍅 ${this.phaseLabel()}: ${this.fmt(r)}`);
    };

    this.timer.onDone = (ph) => this.phaseDone(ph);
    this.timer.onPhaseChange = (ph) => this.setPhase(ph);
  },

  // ---------- 设置同步到 UI ----------
  syncSettings() {
    this.el.sWork.value = this.s.work;
    this.el.sShort.value = this.s.short;
    this.el.sLong.value = this.s.long;
    this.el.sInterval.value = this.s.interval;
    this.el.sNotify.checked = this.s.notify;
    this.el.sSound.checked = this.s.sound;
    this.el.sAutoBreak.checked = this.s.autoBreak;
    this.el.sAutoWork.checked = this.s.autoWork;
    this.el.sNoise.checked = this.s.noise;
    this.el.sNoiseVol.value = this.s.noiseVol;
    if (!this.timer.running) this.el.timerDisplay.textContent = this.fmt(this.workSeconds());
  },

  // ---------- 主题 ----------
  applyTheme() {
    document.body.classList.toggle('dark', this.s.dark);
    document.body.classList.toggle('light', !this.s.dark);
    this.el.toggleTheme.textContent = this.s.dark ? '🌙' : '☀️';
  },

  // ---------- 计时器 ----------
  workSeconds() { return this.s.work * 60; },
  shortSeconds() { return this.s.short * 60; },
  longSeconds() { return this.s.long * 60; },

  phaseLabel(ph) {
    const map = { work:'工作中', break:'短休息', longbreak:'长休息' };
    return map[ph || this.timer.phase];
  },

  fmt(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  },

  setPhase(ph) {
    this.timer.phase = ph;
    document.body.className = document.body.className.replace(/phase-\w+/g,'');
    document.body.classList.add('phase-'+ph);
    this.el.phaseLabel.textContent = this.phaseLabel(ph);
    this.updateRing();
  },

  showTime(s) {
    this.el.timerDisplay.textContent = this.fmt(s);
  },

  updateRing() {
    const circ = 2 * Math.PI * 100;
    this.el.ringProgress.style.strokeDashoffset = circ * (1 - this.timer.progress);
    const wrap = document.querySelector('.ring-wrapper');
    wrap.classList.toggle('running', this.timer.running);
  },

  toggle() {
    if (this.timer.running) {
      this.timer.pause();
      this.el.btnStart.textContent = '▶ 继续';
      this.el.btnStart.className = 'btn btn-primary';
    } else if (this.timer.remaining > 0) {
      this.timer.resume();
      this.el.btnStart.textContent = '⏸ 暂停';
      this.el.btnStart.className = 'btn btn-primary running';
    } else {
      const dur = this.timer.phase==='work' ? this.workSeconds()
               : this.timer.phase==='break' ? this.shortSeconds() : this.longSeconds();
      this.timer.start(dur, this.timer.phase);
      this.el.btnStart.textContent = '⏸ 暂停';
      this.el.btnStart.className = 'btn btn-primary running';
    }
  },

  reset() {
    this.timer.reset();
    if (!this.timer.remaining) {
      const dur = this.timer.phase==='work' ? this.workSeconds()
               : this.timer.phase==='break' ? this.shortSeconds() : this.longSeconds();
      this.timer.total = dur; this.timer.remaining = dur;
      this.el.timerDisplay.textContent = this.fmt(dur);
    }
    this.el.btnStart.textContent = '▶ 开始';
    this.el.btnStart.className = 'btn btn-primary';
    this.updateRing();
  },

  skip() {
    this.timer.stop();
    this.el.btnStart.textContent = '▶ 开始';
    this.el.btnStart.className = 'btn btn-primary';
    this.phaseDone(this.timer.phase);
  },

  phaseDone(ph) {
    // 音效
    if (this.s.sound) this.sound.alarm();
    // 通知
    if (this.s.notify) {
      const t = ph==='work' ? '🍅 工作完成！' : '☕️ 休息结束！';
      const b = ph==='work' ? '太棒了，该休息一下了' : '准备好迎接下一个番茄了吗？';
      if (window.electronAPI) window.electronAPI.notify(t, b);
      else if (Notification.permission==='granted') new Notification(t, { body:b });
    }

    if (ph === 'work') {
      // 记录番茄
      this.pomosDone++;
      this.stats.record(this.s.work);
      this.el.pomoCount.textContent = `已完成 ${this.pomosDone} 个番茄`;
      this.refreshStats();
      this.refreshDots();

      const next = this.pomosDone % this.s.interval === 0 ? 'longbreak' : 'break';
      const dur = next==='longbreak' ? this.longSeconds() : this.shortSeconds();

      if (this.s.autoBreak) {
        this.timer.start(dur, next);
        this.el.btnStart.textContent = '⏸ 暂停';
        this.el.btnStart.className = 'btn btn-primary running';
      } else {
        this.timer.total = dur; this.timer.remaining = dur;
        this.timer.phase = next;
        this.el.timerDisplay.textContent = this.fmt(dur);
        this.setPhase(next);
        this.el.btnStart.textContent = '▶ 开始';
        this.el.btnStart.className = 'btn btn-primary';
      }
    } else {
      // 休息结束回工作
      this.el.pomoCount.textContent = `已完成 ${this.pomosDone} 个番茄`;
      const dur = this.workSeconds();
      if (this.s.autoWork) {
        this.timer.start(dur, 'work');
        this.el.btnStart.textContent = '⏸ 暂停';
        this.el.btnStart.className = 'btn btn-primary running';
      } else {
        this.timer.total = dur; this.timer.remaining = dur;
        this.timer.phase = 'work';
        this.el.timerDisplay.textContent = this.fmt(dur);
        this.setPhase('work');
        this.el.btnStart.textContent = '▶ 开始';
        this.el.btnStart.className = 'btn btn-primary';
      }
    }
  },

  // ---------- 任务 ----------
  addTask() {
    const text = this.el.taskInput.value.trim();
    if (!text) return;
    this.tasks.add(text);
    this.el.taskInput.value = '';
    this.renderTasks();
  },

  renderTasks() {
    const { total, done } = this.tasks.counts;
    this.el.taskProgress.textContent = `${done}/${total} 已完成`;
    if (!this.tasks.list.length) {
      this.el.taskList.innerHTML = '<div class="empty-state">暂无任务，添加一个开始吧</div>';
      return;
    }
    this.el.taskList.innerHTML = '';
    this.tasks.list.forEach(t => {
      const div = document.createElement('div');
      div.className = 'task-item' + (t.done ? ' done' : '');
      div.innerHTML = `
        <div class="task-cb"></div>
        <span class="task-text">${this.esc(t.text)}</span>
        <button class="task-del">×</button>`;
      div.querySelector('.task-cb').onclick = () => { this.tasks.toggle(t.id); this.renderTasks(); };
      div.querySelector('.task-del').onclick = () => { this.tasks.remove(t.id); this.renderTasks(); };
      this.el.taskList.appendChild(div);
    });
  },

  esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; },

  // ---------- 统计 ----------
  refreshStats() {
    const today = this.stats.today();
    this.el.statToday.textContent = today.count;
    this.el.statWeek.textContent = this.stats.week();
    this.el.statTotal.textContent = this.stats.total();
    this.el.statFocus.textContent = `${Math.floor(today.focusMinutes/60)}h ${today.focusMinutes%60}m`;
    this.el.dotLabel.textContent = `今日完成 ${today.count} 个番茄`;
  },

  refreshDots() {
    const dots = this.el.dotRow.querySelectorAll('.dot');
    const n = Math.min(this.stats.today().count, 8);
    dots.forEach((d,i) => d.classList.toggle('done', i < n));
  },

  drawChart() {
    drawChart(this.el.chart, this.stats.last7());
  },
};

// ======================== 启动 ========================
document.addEventListener('DOMContentLoaded', () => App.init());
