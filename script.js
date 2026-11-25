(() => {
  'use strict';

  const STORAGE_KEYS = {
    TASKS: 'dayflow_tasks_v1',
    THEME: 'dayflow_theme_v1',
    INITIALIZED: 'dayflow_initialized_v1',
    FOCUS_LOG: 'dayflow_focus_log_v1'
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 54;   // 339.292
  const FOCUS_CIRCUMFERENCE = 2 * Math.PI * 96;  // 603.185
  const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

  let tasks = [];
  let activeFilter = 'all';
  let activeCategory = 'ALL';
  let searchQuery = '';
  let previousTodayPercent = null;
  let pendingConfirmCallback = null;

  // Calendar state
  const initNow = new Date();
  let calYear = initNow.getFullYear();
  let calMonth = initNow.getMonth();
  let calSelectedISO = getLocalDateISO(initNow);

  // Focus Timer state
  let focusMode = 'focus'; // 'focus' | 'short' | 'long'
  let focusTotalSec = 25 * 60;
  let focusRemainingSec = 25 * 60;
  let focusIsRunning = false;
  let focusEndTimestamp = null;
  let focusIntervalId = null;
  let focusSoundEnabled = true;
  let focusLog = {}; // { 'YYYY-MM-DD': { sessions: number, minutes: number } }

  // PWA Install Prompt
  let deferredInstallPrompt = null;

  /* =========================================
     1. DATE & UTILITY HELPERS
     ========================================= */
  function getLocalDateISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateISO(d);
  }

  function formatDisplayDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateId() {
    return 'tsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* =========================================
     2. LOCALSTORAGE LOAD / SAVE
     ========================================= */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tasks = parsed;
          return;
        }
      }
    } catch (err) {
      console.error('Failed to read tasks:', err);
    }

    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      const today = getLocalDateISO();
      const tomorrow = getTomorrowISO();
      tasks = [
        {
          id: generateId(),
          title: 'Plan top 3 priorities for today',
          description: 'Review schedule, block deep-work slots, and align key outcomes.',
          priority: 'High',
          category: 'Work',
          date: today,
          time: '09:30',
          completed: true,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: '25-minute Focus Timer study session',
          description: 'Link this task in the Focus tab and complete one uninterrupted Pomodoro.',
          priority: 'High',
          category: 'Study',
          date: today,
          time: '16:00',
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: 'Evening walk & quick stretch',
          description: 'Step away from screens and recharge.',
          priority: 'Medium',
          category: 'Health',
          date: today,
          time: '19:00',
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: 'Review upcoming week on Calendar',
          description: 'Add deadlines and personal goals for tomorrow.',
          priority: 'Low',
          category: 'Personal',
          date: tomorrow,
          time: '11:00',
          completed: false,
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      saveTasks();
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (err) {
      console.error('Failed to save tasks:', err);
    }
  }

  function loadFocusLog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FOCUS_LOG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') focusLog = parsed;
      }
    } catch (err) {
      console.error('Failed to read focus log:', err);
    }
  }

  function saveFocusLog() {
    try {
      localStorage.setItem(STORAGE_KEYS.FOCUS_LOG, JSON.stringify(focusLog));
    } catch (err) {
      console.error('Failed to save focus log:', err);
    }
  }

  function getTodayFocusStats() {
    const todayISO = getLocalDateISO();
    return focusLog[todayISO] || { sessions: 0, minutes: 0 };
  }

  /* =========================================
     3. THEME & GREETING
     ========================================= */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeIconSun').style.display = theme === 'dark' ? 'block' : 'none';
    document.getElementById('themeIconMoon').style.display = theme === 'dark' ? 'none' : 'block';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#3A4EFB' : '#DEE0ED');
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (err) {
      console.error('Theme save failed:', err);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    applyTheme(saved === 'light' ? 'light' : 'dark');
  }

  function updateGreetingAndDate() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good Evening!';
    if (hour >= 5 && hour < 12) greeting = 'Good Morning!';
    else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon!';
    else if (hour >= 17 && hour < 22) greeting = 'Good Evening!';
    else greeting = 'Good Night!';

    document.getElementById('greetingText').textContent = greeting;
    document.getElementById('currentDateLabel').textContent = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /* =========================================
     4. DASHBOARD METRICS & SUMMARY
     ========================================= */
  function getTodayStats() {
    const todayISO = getLocalDateISO();
    const todayTasks = tasks.filter(t => t.date === todayISO);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const highPending = todayTasks.filter(t => !t.completed && t.priority === 'High').length;
    return { todayTasks, total, completed, pending, percent, highPending };
  }

  function getMotivationalMessage(total, completed, percent) {
    if (total === 0) return 'Clean slate today. Add a few focused tasks to get momentum going.';
    if (percent === 0) return 'Start with one small win—knocking out the first task builds instant momentum.';
    if (percent < 40) return `You're off the mark (${completed} done). Keep chipping away one task at a time.`;
    if (percent < 75) return 'Solid rhythm! You are past the midway point—stay locked in.';
    if (percent < 100) return 'Almost at the finish line! Just a little push left to wrap up your day.';
    return 'Flawless finish! Every single task on your list for today is checked off.';
  }

  function getDailyPerformanceNarrative(stats) {
    const fStats = getTodayFocusStats();
    const focusSuffix = fStats.minutes > 0 ? ` Plus ${fStats.minutes} min of deep focus logged.` : '';
    if (stats.total === 0) return 'No tasks planned for today yet. Use Quick Add to structure your day.' + focusSuffix;
    if (stats.percent === 100) return `Outstanding execution—you completed all ${stats.total} planned tasks today.${focusSuffix}`;
    if (stats.percent >= 75) return `Strong day overall (${stats.percent}% done). Wrap up the remaining ${stats.pending} ${stats.pending === 1 ? 'task' : 'tasks'}.${focusSuffix}`;
    if (stats.percent >= 40) {
      const highNote = stats.highPending > 0
        ? ` Prioritise your ${stats.highPending} high-priority item${stats.highPending > 1 ? 's' : ''} next.`
        : ' Steady progress so far.';
      return `You finished ${stats.completed} of ${stats.total} tasks today.${highNote}${focusSuffix}`;
    }
    return `You have ${stats.pending} of ${stats.total} tasks open today. Try a 25-minute Focus Timer session to knock one out.${focusSuffix}`;
  }

  function renderInlineBreakdown() {
    const listEl = document.getElementById('inlineBreakdownList');
    if (!listEl) return;

    const stats = getTodayStats();
    const categories = ['Work', 'Study', 'Personal', 'Health', 'Other'];
    const rows = categories
      .map(cat => {
        const catTasks = stats.todayTasks.filter(t => t.category === cat);
        if (catTasks.length === 0) return '';
        const done = catTasks.filter(t => t.completed).length;
        const pct = Math.round((done / catTasks.length) * 100);
        return `
          <div class="breakdown-item">
            <div class="breakdown-row">
              <span>${escapeHtml(cat)}</span>
              <span style="color: var(--text-secondary);">${done}/${catTasks.length} (${pct}%)</span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    listEl.innerHTML =
      rows || '<p style="font-size: 0.88rem; color: var(--text-muted);">No tasks planned for today yet.</p>';
  }

  function updateDashboardMetrics() {
    const stats = getTodayStats();
    const fStats = getTodayFocusStats();
    const todayISO = getLocalDateISO();

    document.getElementById('statTotalToday').textContent = stats.total;
    document.getElementById('statCompletedToday').textContent = stats.completed;
    document.getElementById('statPendingToday').textContent = stats.pending;
    document.getElementById('progressPercentLabel').textContent = `${stats.percent}%`;
    document.getElementById('linearProgressRatio').textContent = `${stats.completed} of ${stats.total} done`;

    const ring = document.getElementById('progressRingFill');
    const offset = RING_CIRCUMFERENCE * (1 - stats.percent / 100);
    ring.style.strokeDashoffset = offset.toFixed(2);
    ring.style.opacity = stats.percent === 0 ? '0' : '1';
    document.getElementById('linearProgressFill').style.width = `${stats.percent}%`;

    document.getElementById('motivationMessage').textContent = getMotivationalMessage(
      stats.total,
      stats.completed,
      stats.percent
    );

    // Summary section metrics
    document.getElementById('sumPlanned').textContent = stats.total;
    document.getElementById('sumCompleted').textContent = stats.completed;
    document.getElementById('sumRemaining').textContent = stats.pending;
    document.getElementById('sumFocusTime').textContent = `${fStats.minutes} min`;
    document.getElementById('summaryScorePill').textContent = `${stats.percent}% Productive`;
    document.getElementById('summaryNarrative').textContent = getDailyPerformanceNarrative(stats);

    // Bento & nav badges
    const totalPendingAll = tasks.filter(t => !t.completed).length;
    const upcomingCount = tasks.filter(t => t.date > todayISO && !t.completed).length;
    document.getElementById('navPendingBadge').textContent = totalPendingAll;
    document.getElementById('bentoTasksText').textContent =
      totalPendingAll === 0 ? 'All caught up!' : `${totalPendingAll} pending ${totalPendingAll === 1 ? 'task' : 'tasks'}`;
    document.getElementById('bentoCalendarText').textContent =
      upcomingCount === 0 ? 'Plan upcoming dates' : `${upcomingCount} upcoming scheduled`;
    document.getElementById('bentoFocusText').textContent =
      `${fStats.minutes} min • ${fStats.sessions} ${fStats.sessions === 1 ? 'session' : 'sessions'} today`;
    document.getElementById('bentoSummaryText').textContent =
      `${stats.percent}% done (${stats.completed}/${stats.total})`;

    // Celebration banner & confetti
    const banner = document.getElementById('celebrationBanner');
    if (stats.total > 0 && stats.percent === 100) {
      banner.classList.add('visible');
      if (previousTodayPercent !== null && previousTodayPercent < 100) {
        launchConfetti();
        showToast('100% Daily Goal Achieved! Great work today.');
      }
    } else {
      banner.classList.remove('visible');
    }
    previousTodayPercent = stats.percent;

    // Filter counts
    document.getElementById('count-all').textContent = tasks.length;
    document.getElementById('count-today').textContent = tasks.filter(t => t.date === todayISO).length;
    document.getElementById('count-upcoming').textContent = tasks.filter(t => t.date > todayISO).length;
    document.getElementById('count-pending').textContent = tasks.filter(t => !t.completed).length;
    document.getElementById('count-completed').textContent = tasks.filter(t => t.completed).length;
    document.getElementById('count-high').textContent = tasks.filter(t => t.priority === 'High').length;

    renderInlineBreakdown();
  }

  /* =========================================
     5. TASKS LIST RENDERING
     ========================================= */
  function getFilteredTasks() {
    const todayISO = getLocalDateISO();
    const q = searchQuery.trim().toLowerCase();

    return tasks.filter(task => {
      if (activeFilter === 'today' && task.date !== todayISO) return false;
      if (activeFilter === 'upcoming' && task.date <= todayISO) return false;
      if (activeFilter === 'completed' && !task.completed) return false;
      if (activeFilter === 'pending' && task.completed) return false;
      if (activeFilter === 'high' && task.priority !== 'High') return false;
      if (activeCategory !== 'ALL' && task.category !== activeCategory) return false;

      if (q) {
        const haystack = `${task.title} ${task.description || ''} ${task.category} ${task.priority}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function sortTasks(list) {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });
  }

  function renderTaskCard(task, isOverdue) {
    const priorityClass = `badge-${task.priority.toLowerCase()}`;
    const timeText = task.time ? formatTime12h(task.time) : 'Anytime';
    const dateBadgeText = `${formatDisplayDate(task.date)}${task.time ? ' • ' + timeText : ''}`;

    return `
      <article class="task-card ${task.completed ? 'completed' : ''}" data-id="${escapeHtml(task.id)}">
        <button type="button" class="task-check-btn" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.completed ? 'Mark task as pending' : 'Mark task as completed'}" aria-pressed="${task.completed}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>

        <div class="task-body">
          <div class="task-top-row">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-actions">
              ${!task.completed ? `
                <button type="button" class="action-btn undo" data-action="focus-task" data-id="${escapeHtml(task.id)}" title="Start Focus Timer on this task">
                  Focus
                </button>
              ` : `
                <button type="button" class="action-btn undo" data-action="toggle" data-id="${escapeHtml(task.id)}" title="Undo completion">
                  Undo
                </button>
              `}
              <button type="button" class="action-btn" data-action="edit" data-id="${escapeHtml(task.id)}" title="Edit task">Edit</button>
              <button type="button" class="action-btn delete" data-action="delete" data-id="${escapeHtml(task.id)}" title="Delete task">Delete</button>
            </div>
          </div>

          ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

          <div class="task-badges">
            <span class="badge ${priorityClass}">${escapeHtml(task.priority)} Priority</span>
            <span class="badge badge-category">${escapeHtml(task.category)}</span>
            <span class="badge ${isOverdue ? 'badge-overdue' : 'badge-time'}">
              ${isOverdue ? 'Overdue • ' : ''}${escapeHtml(dateBadgeText)}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  function renderTasks() {
    const container = document.getElementById('tasksContainer');
    const filtered = getFilteredTasks();
    const todayISO = getLocalDateISO();
    const tomorrowISO = getTomorrowISO();

    if (filtered.length === 0) {
      const emptyMsg = searchQuery.trim()
        ? `No tasks matched "${escapeHtml(searchQuery.trim())}". Try another keyword or clear your filters.`
        : 'No tasks found in this view. Add a new task to stay ahead of your schedule.';

      container.innerHTML = `
        <div class="card empty-state">
          <div class="empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <h3>Nothing here right now</h3>
          <p>${emptyMsg}</p>
          <button type="button" class="btn btn-primary" id="emptyAddTaskBtn">Create a Task</button>
        </div>
      `;
      const emptyBtn = document.getElementById('emptyAddTaskBtn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openTaskModal());
      return;
    }

    const buckets = [
      { key: 'overdue', title: 'Overdue Tasks', dotClass: 'overdue', items: [] },
      { key: 'today', title: `Today — ${formatDisplayDate(todayISO)}`, dotClass: 'today', items: [] },
      { key: 'tomorrow', title: `Tomorrow — ${formatDisplayDate(tomorrowISO)}`, dotClass: 'upcoming', items: [] },
      { key: 'upcoming', title: 'Upcoming Dates', dotClass: 'upcoming', items: [] },
      { key: 'history', title: 'Past History (Completed)', dotClass: 'history', items: [] }
    ];
    const map = Object.fromEntries(buckets.map(b => [b.key, b]));

    filtered.forEach(task => {
      if (task.date === todayISO) map.today.items.push(task);
      else if (task.date === tomorrowISO) map.tomorrow.items.push(task);
      else if (task.date > tomorrowISO) map.upcoming.items.push(task);
      else if (!task.completed) map.overdue.items.push(task);
      else map.history.items.push(task);
    });

    let html = '';
    buckets.forEach(bucket => {
      if (bucket.items.length === 0) return;

      const pendingItems = sortTasks(bucket.items.filter(t => !t.completed));
      const completedItems = sortTasks(bucket.items.filter(t => t.completed));
      const showSplit =
        activeFilter !== 'pending' &&
        activeFilter !== 'completed' &&
        pendingItems.length > 0 &&
        completedItems.length > 0;

      html += `
        <div class="date-group">
          <div class="date-group-header">
            <div class="date-group-title">
              <span class="date-dot ${bucket.dotClass}"></span>
              <span>${escapeHtml(bucket.title)}</span>
            </div>
            <span class="date-group-meta">${bucket.items.length} ${bucket.items.length === 1 ? 'task' : 'tasks'}</span>
          </div>
      `;

      if (pendingItems.length > 0) {
        if (showSplit) html += `<div class="status-sublabel">Pending (${pendingItems.length})</div>`;
        html += `<div class="task-list">`;
        pendingItems.forEach(t => {
          html += renderTaskCard(t, t.date < todayISO && !t.completed);
        });
        html += `</div>`;
      }

      if (completedItems.length > 0) {
        if (showSplit) html += `<div class="status-sublabel">Completed (${completedItems.length})</div>`;
        html += `<div class="task-list">`;
        completedItems.forEach(t => {
          html += renderTaskCard(t, false);
        });
        html += `</div>`;
      }

      html += `</div>`;
    });

    container.innerHTML = html;
  }

  /* =========================================
     6. INTERACTIVE CALENDAR SECTION
     ========================================= */
  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calMonthLabel');
    if (!grid || !monthLabel) return;

    const firstDay = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startWeekday = firstDay.getDay();
    const todayISO = getLocalDateISO();

    monthLabel.textContent = firstDay.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });

    // Map tasks by date
    const byDate = {};
    tasks.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = { pending: 0, done: 0 };
      if (t.completed) byDate[t.date].done++;
      else byDate[t.date].pending++;
    });

    let html = '';
    for (let i = 0; i < startWeekday; i++) {
      html += `<div class="cal-cell empty" aria-hidden="true"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(calMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const iso = `${calYear}-${mStr}-${dStr}`;
      const info = byDate[iso];

      const classes = ['cal-cell'];
      if (iso === todayISO) classes.push('today');
      if (iso === calSelectedISO) classes.push('selected');

      let dotsHtml = '';
      if (info) {
        if (info.pending > 0) dotsHtml += `<span class="cal-dot pending"></span>`;
        if (info.done > 0) dotsHtml += `<span class="cal-dot done"></span>`;
      }

      html += `
        <button type="button" class="${classes.join(' ')}" data-cal-date="${iso}" aria-label="${formatDisplayDate(iso)}">
          <span>${day}</span>
          <span class="cal-dots">${dotsHtml}</span>
        </button>
      `;
    }

    grid.innerHTML = html;
    renderCalendarAgenda();
  }

  function renderCalendarAgenda() {
    const titleEl = document.getElementById('calSelectedDateTitle');
    const listEl = document.getElementById('calAgendaList');
    if (!titleEl || !listEl) return;

    const todayISO = getLocalDateISO();
    const label = calSelectedISO === todayISO
      ? `Today — ${formatDisplayDate(calSelectedISO)}`
      : formatDisplayDate(calSelectedISO);
    titleEl.textContent = label;

    const dayTasks = sortTasks(tasks.filter(t => t.date === calSelectedISO));

    if (dayTasks.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 28px 12px; color: var(--text-muted); font-size: 0.88rem;">
          No tasks scheduled for this date.<br/>Click <strong>+ Add Here</strong> to plan one.
        </div>
      `;
      return;
    }

    listEl.innerHTML = dayTasks
      .map(t => renderTaskCard(t, t.date < todayISO && !t.completed))
      .join('');
  }

  /* =========================================
     7. FOCUS TIMER (POMODORO + WEB AUDIO CHIME)
     ========================================= */
  function playFocusChime() {
    if (!focusSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.16;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.48);
      });
    } catch (err) {
      console.error('Audio chime skipped:', err);
    }
  }

  function formatMMSS(sec) {
    const clamped = Math.max(0, Math.ceil(sec));
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateFocusUI() {
    const timeStr = formatMMSS(focusRemainingSec);
    document.getElementById('focusTimeDisplay').textContent = timeStr;

    const ratio = focusTotalSec > 0 ? focusRemainingSec / focusTotalSec : 0;
    const offset = FOCUS_CIRCUMFERENCE * (1 - ratio);
    document.getElementById('focusRingFill').style.strokeDashoffset = offset.toFixed(2);

    const startBtn = document.getElementById('focusStartPauseBtn');
    startBtn.textContent = focusIsRunning ? 'Pause' : (focusRemainingSec < focusTotalSec ? 'Resume' : 'Start Focus');

    const modeMap = { focus: 'DEEP FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };
    document.getElementById('focusStateLabel').textContent = modeMap[focusMode] || 'DEEP FOCUS';

    const dot = document.getElementById('focusLiveDot');
    if (dot) dot.classList.toggle('running', focusIsRunning);

    document.title = focusIsRunning
      ? `${timeStr} • ${modeMap[focusMode]} — DayFlow`
      : 'DayFlow — Daily Productivity & Focus Suite';

    const fStats = getTodayFocusStats();
    document.getElementById('focusSessionsToday').textContent = fStats.sessions;
    document.getElementById('focusMinutesToday').textContent = fStats.minutes;
    document.getElementById('focusTodayMinutesPill').textContent = `${fStats.minutes} min`;
  }

  function syncFocusTaskDropdown() {
    const select = document.getElementById('focusTaskSelect');
    const completeBtn = document.getElementById('focusCompleteLinkedBtn');
    const label = document.getElementById('focusActiveTaskLabel');
    if (!select) return;

    const currentVal = select.value;
    const pendingTasks = sortTasks(tasks.filter(t => !t.completed));

    let optionsHtml = `<option value="">— Free Focus Session —</option>`;
    pendingTasks.forEach(t => {
      optionsHtml += `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)} (${escapeHtml(t.category)})</option>`;
    });
    select.innerHTML = optionsHtml;

    if (currentVal && pendingTasks.some(t => t.id === currentVal)) {
      select.value = currentVal;
    } else {
      select.value = '';
    }

    const chosen = pendingTasks.find(t => t.id === select.value);
    if (chosen) {
      label.textContent = chosen.title;
      completeBtn.style.display = 'inline-flex';
    } else {
      label.textContent = 'Free focus session';
      completeBtn.style.display = 'none';
    }
  }

  function setFocusDuration(minutes, mode = focusMode) {
    pauseFocusTimer();
    focusMode = mode;
    focusTotalSec = Math.max(1, Math.min(180, minutes)) * 60;
    focusRemainingSec = focusTotalSec;
    document.getElementById('focusCustomMinutes').value = Math.round(focusTotalSec / 60);
    updateFocusUI();
  }

  function startFocusTimer() {
    if (focusIsRunning) return;
    if (focusRemainingSec <= 0) focusRemainingSec = focusTotalSec;
    focusIsRunning = true;
    focusEndTimestamp = Date.now() + focusRemainingSec * 1000;

    focusIntervalId = setInterval(() => {
      const left = Math.round((focusEndTimestamp - Date.now()) / 1000);
      if (left <= 0) {
        focusRemainingSec = 0;
        pauseFocusTimer();
        handleFocusSessionComplete();
      } else {
        focusRemainingSec = left;
        updateFocusUI();
      }
    }, 300);

    updateFocusUI();
  }

  function pauseFocusTimer() {
    focusIsRunning = false;
    if (focusIntervalId) {
      clearInterval(focusIntervalId);
      focusIntervalId = null;
    }
    updateFocusUI();
  }

  function handleFocusSessionComplete() {
    playFocusChime();
    if (focusMode === 'focus') {
      const todayISO = getLocalDateISO();
      const minsLogged = Math.max(1, Math.round(focusTotalSec / 60));
      if (!focusLog[todayISO]) focusLog[todayISO] = { sessions: 0, minutes: 0 };
      focusLog[todayISO].sessions += 1;
      focusLog[todayISO].minutes += minsLogged;
      saveFocusLog();
      launchConfetti();
      showToast(`Focus session complete! +${minsLogged} min logged.`);
    } else {
      showToast('Break finished! Ready for your next focus block.');
    }
    focusRemainingSec = focusTotalSec;
    renderAll();
  }

  /* =========================================
     8. MASTER RENDER & CRUD
     ========================================= */
  function renderAll() {
    updateDashboardMetrics();
    renderTasks();
    renderCalendar();
    syncFocusTaskDropdown();
    updateFocusUI();
  }

  function addTask({ title, description, priority, category, date, time }) {
    tasks.unshift({
      id: generateId(),
      title: title.trim(),
      description: (description || '').trim(),
      priority: priority || 'Medium',
      category: category || 'Work',
      date: date || getLocalDateISO(),
      time: time || '',
      completed: false,
      createdAt: new Date().toISOString()
    });
    saveTasks();
    renderAll();
    showToast('Task added successfully.');
  }

  function updateTask(id, updates) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx] = {
      ...tasks[idx],
      title: updates.title.trim(),
      description: (updates.description || '').trim(),
      priority: updates.priority,
      category: updates.category,
      date: updates.date,
      time: updates.time || ''
    };
    saveTasks();
    renderAll();
    showToast('Task updated.');
  }

  function toggleTaskCompletion(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasks();
    renderAll();

    if (task.completed) {
      showToast(`Completed "${task.title}"`, {
        undoLabel: 'Undo',
        onUndo: () => toggleTaskCompletion(id)
      });
    } else {
      showToast(`Moved "${task.title}" back to pending.`);
    }
  }

  function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const removed = tasks[idx];
    tasks.splice(idx, 1);
    saveTasks();
    renderAll();
    showToast(`Deleted "${removed.title}"`, {
      undoLabel: 'Restore',
      onUndo: () => {
        if (!tasks.some(t => t.id === removed.id)) {
          tasks.splice(Math.min(idx, tasks.length), 0, removed);
          saveTasks();
          renderAll();
        }
      }
    });
  }

  /* =========================================
     9. MODALS
     ========================================= */
  const taskModalBackdrop = document.getElementById('taskModalBackdrop');
  const summaryModalBackdrop = document.getElementById('summaryModalBackdrop');
  const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');

  function openTaskModal(taskToEdit = null, prefillDate = null) {
    const titleInput = document.getElementById('taskTitleInput');
    if (taskToEdit) {
      document.getElementById('taskModalTitle').textContent = 'Edit Task';
      document.getElementById('taskIdInput').value = taskToEdit.id;
      titleInput.value = taskToEdit.title;
      document.getElementById('taskDescInput').value = taskToEdit.description || '';
      document.getElementById('taskPriorityInput').value = taskToEdit.priority;
      document.getElementById('taskCategoryInput').value = taskToEdit.category;
      document.getElementById('taskDateInput').value = taskToEdit.date;
      document.getElementById('taskTimeInput').value = taskToEdit.time || '';
    } else {
      document.getElementById('taskModalTitle').textContent = 'Create New Task';
      document.getElementById('taskIdInput').value = '';
      titleInput.value = '';
      document.getElementById('taskDescInput').value = '';
      document.getElementById('taskPriorityInput').value = 'Medium';
      document.getElementById('taskCategoryInput').value = 'Work';
      document.getElementById('taskDateInput').value = prefillDate || getLocalDateISO();
      document.getElementById('taskTimeInput').value = '';
    }
    taskModalBackdrop.classList.add('open');
    taskModalBackdrop.setAttribute('aria-hidden', 'false');
    setTimeout(() => titleInput.focus(), 60);
  }

  function closeTaskModal() {
    taskModalBackdrop.classList.remove('open');
    taskModalBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openSummaryModal() {
    const stats = getTodayStats();
    const fStats = getTodayFocusStats();
    const categories = ['Work', 'Study', 'Personal', 'Health', 'Other'];
    const categoryRows = categories
      .map(cat => {
        const catTasks = stats.todayTasks.filter(t => t.category === cat);
        if (catTasks.length === 0) return '';
        const done = catTasks.filter(t => t.completed).length;
        const pct = Math.round((done / catTasks.length) * 100);
        return `
          <div class="breakdown-item">
            <div class="breakdown-row">
              <span>${escapeHtml(cat)}</span>
              <span style="color: var(--text-secondary);">${done}/${catTasks.length} (${pct}%)</span>
            </div>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    document.getElementById('summaryModalBody').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; background:var(--input-bg); border:1px solid var(--border); padding:16px; border-radius:var(--radius-md);">
        <div>
          <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">${escapeHtml(formatDisplayDate(getLocalDateISO()))}</div>
          <div style="font-size:1.75rem; font-weight:800; letter-spacing:-0.03em;">${stats.percent}% Productivity</div>
        </div>
        <div class="summary-pill">${stats.completed} / ${stats.total} Done</div>
      </div>

      <div class="summary-metrics">
        <div class="summary-mini"><span>Total Planned</span><strong>${stats.total}</strong></div>
        <div class="summary-mini"><span>Tasks Completed</span><strong style="color:var(--success);">${stats.completed}</strong></div>
        <div class="summary-mini"><span>Focus Sessions</span><strong style="color:var(--lime);">${fStats.sessions}</strong></div>
        <div class="summary-mini"><span>Focus Minutes</span><strong style="color:var(--blue-end);">${fStats.minutes} min</strong></div>
      </div>

      <div class="summary-narrative">
        <strong>Daily Performance Review:</strong><br/>
        ${escapeHtml(getDailyPerformanceNarrative(stats))}
      </div>

      <div>
        <div style="font-size:0.84rem; font-weight:700; margin-bottom:10px;">Today's Category Breakdown</div>
        <div class="breakdown-list">
          ${categoryRows || '<div style="font-size:0.85rem; color:var(--text-muted);">No tasks planned for today yet.</div>'}
        </div>
      </div>
    `;

    summaryModalBackdrop.classList.add('open');
    summaryModalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeSummaryModal() {
    summaryModalBackdrop.classList.remove('open');
    summaryModalBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openConfirmModal({ title, message, confirmLabel, extraOptionText, onConfirm }) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    document.getElementById('proceedConfirmBtn').textContent = confirmLabel || 'Confirm';

    const extraWrap = document.getElementById('confirmExtraOption');
    const extraCheckbox = document.getElementById('confirmExtraCheckbox');
    extraCheckbox.checked = false;

    if (extraOptionText) {
      document.getElementById('confirmExtraLabel').textContent = extraOptionText;
      extraWrap.style.display = 'flex';
    } else {
      extraWrap.style.display = 'none';
    }

    pendingConfirmCallback = () => onConfirm(extraCheckbox.checked);
    confirmModalBackdrop.classList.add('open');
    confirmModalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeConfirmModal() {
    confirmModalBackdrop.classList.remove('open');
    confirmModalBackdrop.setAttribute('aria-hidden', 'true');
    pendingConfirmCallback = null;
  }

  /* =========================================
     10. TOAST & CONFETTI
     ========================================= */
  function showToast(message, options = {}) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (options.undoLabel && typeof options.onUndo === 'function') {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = options.undoLabel;
      undoBtn.addEventListener('click', () => {
        options.onUndo();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 4200);
  }

  function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3A4EFB', '#33A4FA', '#E3FF3B', '#10b981', '#ff4d6d', '#ffffff'];
    const particles = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 140,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4.5,
      vy: 2.8 + Math.random() * 4.2,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 9,
      opacity: 1
    }));

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = 0;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.angle += p.spin;
        if (frame > 95) p.opacity = Math.max(0, p.opacity - 0.02);
        if (p.opacity > 0 && p.y < canvas.height + 30) {
          active++;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.angle * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      frame++;
      if (active > 0 && frame < 200) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(animate);
  }

  /* =========================================
     11. SECTION NAVIGATION, INTERACTIVE FX & PWA
     ========================================= */
  function switchSection(sectionName) {
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.toggle('active', sec.dataset.section === sectionName);
    });
    document.querySelectorAll('[data-section-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sectionBtn === sectionName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initInteractiveEffects() {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;

    document.addEventListener('pointermove', e => {
      if (!isFinePointer) return;
      const target = e.target.closest('.card, .task-card');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      target.style.setProperty('--my', `${e.clientY - rect.top}px`);

      if (target.classList.contains('greeting-card') || target.classList.contains('focus-timer-card')) {
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        target.style.transform = `perspective(1100px) rotateX(${(-y * 3.5).toFixed(2)}deg) rotateY(${(x * 3.5).toFixed(2)}deg)`;
      }
    });

    document.querySelectorAll('.greeting-card, .focus-timer-card').forEach(card => {
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn, .filter-pill');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple-wave';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 580);
    });
  }

  function initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('Service Worker registration skipped:', err);
        });
      });
    }

    const installBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('Installing DayFlow on your device...');
        }
        deferredInstallPrompt = null;
        installBtn.style.display = 'none';
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) installBtn.style.display = 'none';
      showToast('DayFlow installed! You can now launch it from your home screen.');
    });

    window.addEventListener('offline', () => showToast('You are offline — DayFlow works locally.'));
    window.addEventListener('online', () => showToast('Back online!'));
  }

  /* =========================================
     12. EVENT BINDINGS
     ========================================= */
  function bindEvents() {
    // Theme toggle
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Section tabs & Bento shortcuts
    document.getElementById('sectionNav').addEventListener('click', e => {
      const btn = e.target.closest('[data-section-btn]');
      if (btn) switchSection(btn.dataset.sectionBtn);
    });

    document.addEventListener('click', e => {
      const gotoEl = e.target.closest('[data-goto]');
      if (gotoEl) switchSection(gotoEl.dataset.goto);
    });

    // Quick-add form
    document.getElementById('quickAddForm').addEventListener('submit', e => {
      e.preventDefault();
      const titleEl = document.getElementById('quickTitle');
      if (!titleEl.value.trim()) return;
      addTask({
        title: titleEl.value,
        description: '',
        priority: document.getElementById('quickPriority').value,
        category: document.getElementById('quickCategory').value,
        date: getLocalDateISO(),
        time: document.getElementById('quickTime').value
      });
      titleEl.value = '';
      document.getElementById('quickTime').value = '';
      titleEl.focus();
    });

    // Task modal buttons
    document.getElementById('openNewTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('tasksQuickModalBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('closeTaskModalBtn').addEventListener('click', closeTaskModal);
    document.getElementById('cancelTaskModalBtn').addEventListener('click', closeTaskModal);
    taskModalBackdrop.addEventListener('click', e => { if (e.target === taskModalBackdrop) closeTaskModal(); });

    document.getElementById('taskForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('taskIdInput').value;
      const payload = {
        title: document.getElementById('taskTitleInput').value,
        description: document.getElementById('taskDescInput').value,
        priority: document.getElementById('taskPriorityInput').value,
        category: document.getElementById('taskCategoryInput').value,
        date: document.getElementById('taskDateInput').value,
        time: document.getElementById('taskTimeInput').value
      };
      if (!payload.title.trim()) return;
      if (id) updateTask(id, payload);
      else addTask(payload);
      closeTaskModal();
    });

    // Summary modal
    document.getElementById('cardFullSummaryBtn').addEventListener('click', openSummaryModal);
    document.getElementById('closeSummaryModalBtn').addEventListener('click', closeSummaryModal);
    document.getElementById('doneSummaryModalBtn').addEventListener('click', closeSummaryModal);
    summaryModalBackdrop.addEventListener('click', e => { if (e.target === summaryModalBackdrop) closeSummaryModal(); });

    // Confirm modal
    document.getElementById('closeConfirmModalBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('cancelConfirmBtn').addEventListener('click', closeConfirmModal);
    confirmModalBackdrop.addEventListener('click', e => { if (e.target === confirmModalBackdrop) closeConfirmModal(); });
    document.getElementById('proceedConfirmBtn').addEventListener('click', () => {
      if (typeof pendingConfirmCallback === 'function') pendingConfirmCallback();
      closeConfirmModal();
    });

    // Filters & Search
    document.getElementById('filterPills').addEventListener('click', e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('#filterPills .filter-pill').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      renderTasks();
    });

    document.getElementById('categoryFilter').addEventListener('change', e => {
      activeCategory = e.target.value;
      renderTasks();
    });

    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      searchClearBtn.classList.toggle('visible', searchQuery.length > 0);
      if (searchQuery.trim().length > 0) switchSection('tasks');
      renderTasks();
    });
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.classList.remove('visible');
      renderTasks();
      searchInput.focus();
    });

    // Clear Completed & Reset Today
    document.getElementById('clearCompletedBtn').addEventListener('click', () => {
      const todayISO = getLocalDateISO();
      const completedTodayCount = tasks.filter(t => t.date === todayISO && t.completed).length;
      const totalCompletedCount = tasks.filter(t => t.completed).length;
      if (totalCompletedCount === 0) {
        showToast('No completed tasks to clear.');
        return;
      }
      openConfirmModal({
        title: 'Clear Completed Tasks',
        message: `Remove ${completedTodayCount} completed task(s) from today while keeping your past task history safe.`,
        confirmLabel: 'Clear Completed',
        extraOptionText: `Also remove older completed tasks (${totalCompletedCount - completedTodayCount} historical)`,
        onConfirm: includeHistory => {
          const before = tasks.length;
          tasks = tasks.filter(t => {
            if (!t.completed) return true;
            if (includeHistory) return false;
            return t.date !== todayISO;
          });
          saveTasks();
          renderAll();
          showToast(`Cleared ${before - tasks.length} completed task(s).`);
        }
      });
    });

    document.getElementById('resetTodayBtn').addEventListener('click', () => {
      const todayISO = getLocalDateISO();
      const todayCount = tasks.filter(t => t.date === todayISO).length;
      if (todayCount === 0) {
        showToast("Today's task list is already empty.");
        return;
      }
      openConfirmModal({
        title: "Reset Today's Tasks?",
        message: `Remove all ${todayCount} task(s) scheduled for today (${formatDisplayDate(todayISO)}). Historical and upcoming tasks will NOT be touched.`,
        confirmLabel: "Reset Today's Tasks",
        onConfirm: () => {
          tasks = tasks.filter(t => t.date !== todayISO);
          saveTasks();
          renderAll();
          showToast("Today's tasks reset. Historical data preserved.");
        }
      });
    });

    // Delegated Task Actions (works in both Tasks tab & Calendar Agenda!)
    function handleTaskActionClick(e) {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const { action, id } = actionEl.dataset;
      if (action === 'toggle') {
        toggleTaskCompletion(id);
      } else if (action === 'edit') {
        const task = tasks.find(t => t.id === id);
        if (task) openTaskModal(task);
      } else if (action === 'delete') {
        deleteTask(id);
      } else if (action === 'focus-task') {
        const select = document.getElementById('focusTaskSelect');
        if (select) {
          select.value = id;
          syncFocusTaskDropdown();
        }
        switchSection('focus');
        showToast('Task linked to Focus Timer. Hit Start!');
      }
    }

    document.getElementById('tasksContainer').addEventListener('click', handleTaskActionClick);
    document.getElementById('calAgendaList').addEventListener('click', handleTaskActionClick);

    // Calendar Controls
    document.getElementById('calPrevMonthBtn').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });

    document.getElementById('calNextMonthBtn').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    document.getElementById('calTodayBtn').addEventListener('click', () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      calSelectedISO = getLocalDateISO(now);
      renderCalendar();
    });

    document.getElementById('calendarGrid').addEventListener('click', e => {
      const cell = e.target.closest('[data-cal-date]');
      if (!cell) return;
      calSelectedISO = cell.dataset.calDate;
      renderCalendar();
    });

    document.getElementById('calAddForDateBtn').addEventListener('click', () => {
      openTaskModal(null, calSelectedISO);
    });

    // Focus Timer Controls
    document.getElementById('focusModePills').addEventListener('click', e => {
      const btn = e.target.closest('[data-focus-mode]');
      if (!btn) return;
      document.querySelectorAll('#focusModePills .filter-pill').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      setFocusDuration(parseInt(btn.dataset.minutes, 10), btn.dataset.focusMode);
    });

    document.getElementById('focusStartPauseBtn').addEventListener('click', () => {
      if (focusIsRunning) pauseFocusTimer();
      else startFocusTimer();
    });

    document.getElementById('focusResetBtn').addEventListener('click', () => {
      pauseFocusTimer();
      focusRemainingSec = focusTotalSec;
      updateFocusUI();
    });

    document.getElementById('focusPlusFiveBtn').addEventListener('click', () => {
      focusTotalSec += 5 * 60;
      focusRemainingSec += 5 * 60;
      if (focusIsRunning && focusEndTimestamp) focusEndTimestamp += 5 * 60 * 1000;
      updateFocusUI();
      showToast('+5 minutes added.');
    });

    document.getElementById('focusApplyCustomBtn').addEventListener('click', () => {
      const val = parseInt(document.getElementById('focusCustomMinutes').value, 10);
      if (isNaN(val) || val < 1 || val > 180) {
        showToast('Enter minutes between 1 and 180.');
        return;
      }
      setFocusDuration(val, focusMode);
      showToast(`Timer set to ${val} min.`);
    });

    document.getElementById('focusSoundToggleBtn').addEventListener('click', () => {
      focusSoundEnabled = !focusSoundEnabled;
      document.getElementById('focusSoundLabel').textContent = `Sound: ${focusSoundEnabled ? 'On' : 'Off'}`;
    });

    document.getElementById('focusTaskSelect').addEventListener('change', syncFocusTaskDropdown);

    document.getElementById('focusCompleteLinkedBtn').addEventListener('click', () => {
      const id = document.getElementById('focusTaskSelect').value;
      if (id) toggleTaskCompletion(id);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeTaskModal();
        closeSummaryModal();
        closeConfirmModal();
      }
    });
  }

  /* =========================================
     13. BOOTSTRAP
     ========================================= */
  initTheme();
  updateGreetingAndDate();
  loadTasks();
  loadFocusLog();
  bindEvents();
  initInteractiveEffects();
  initPWA();
  renderAll();

  setInterval(updateGreetingAndDate, 60000);
})();
