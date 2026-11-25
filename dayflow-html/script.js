(() => {
  'use strict';

  const STORAGE_KEYS = {
    TASKS: 'dayflow_tasks_v1',
    THEME: 'dayflow_theme_v1',
    INITIALIZED: 'dayflow_initialized_v1'
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 54;
  const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

  let tasks = [];
  let activeFilter = 'all';
  let activeCategory = 'ALL';
  let searchQuery = '';
  let previousTodayPercent = null;
  let pendingConfirmCallback = null;

  /* ---- Date & Utility Helpers ---- */
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
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-IN', {
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

  /* ---- LocalStorage ---- */
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
      console.error('Failed to read tasks from LocalStorage:', err);
    }

    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      const today = getLocalDateISO();
      const tomorrow = getTomorrowISO();
      tasks = [
        {
          id: generateId(),
          title: 'Plan top 3 priorities for today',
          description: 'Review calendar, block deep-work slots, and align key outcomes.',
          priority: 'High',
          category: 'Work',
          date: today,
          time: '09:30',
          completed: true,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: '60-minute focused study / deep work session',
          description: 'Keep notifications muted and wrap up the primary deliverable.',
          priority: 'High',
          category: 'Study',
          date: today,
          time: '14:00',
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: 'Evening walk and 15-minute stretch',
          description: 'Step away from screens and recharge energy.',
          priority: 'Medium',
          category: 'Health',
          date: today,
          time: '19:00',
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          title: 'Organise weekly budget & notes',
          description: 'Quick personal review scheduled for tomorrow.',
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
      console.error('Failed to save tasks to LocalStorage:', err);
    }
  }

  /* ---- Theme ---- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    sun.style.display = theme === 'dark' ? 'block' : 'none';
    moon.style.display = theme === 'dark' ? 'none' : 'block';
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (err) {
      console.error('Could not save theme preference:', err);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    applyTheme(saved === 'light' ? 'light' : 'dark');
  }

  /* ---- Greeting & Date ---- */
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

  /* ---- Progress & Summary ---- */
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
    if (stats.total === 0) return 'No tasks planned for today yet. Use Quick Add below to structure your day.';
    if (stats.percent === 100) return `Outstanding execution—you completed all ${stats.total} planned tasks today. Your consistency is paying off.`;
    if (stats.percent >= 75) return `Strong day overall (${stats.percent}% done). Wrap up the remaining ${stats.pending} ${stats.pending === 1 ? 'task' : 'tasks'} to close on a high note.`;
    if (stats.percent >= 40) {
      const highNote = stats.highPending > 0
        ? ` Prioritise your ${stats.highPending} high-priority item${stats.highPending > 1 ? 's' : ''} next.`
        : ' Steady progress so far.';
      return `You have finished ${stats.completed} of ${stats.total} tasks today.${highNote}`;
    }
    return `You still have ${stats.pending} of ${stats.total} tasks open today. Pick one priority task and give it 20 uninterrupted minutes.`;
  }

  function updateDashboardMetrics() {
    const stats = getTodayStats();

    document.getElementById('statTotalToday').textContent = stats.total;
    document.getElementById('statCompletedToday').textContent = stats.completed;
    document.getElementById('statPendingToday').textContent = stats.pending;
    document.getElementById('progressPercentLabel').textContent = `${stats.percent}%`;
    document.getElementById('linearProgressRatio').textContent = `${stats.completed} of ${stats.total} done`;

    const offset = RING_CIRCUMFERENCE * (1 - stats.percent / 100);
    document.getElementById('progressRingFill').style.strokeDashoffset = offset.toFixed(2);
    document.getElementById('linearProgressFill').style.width = `${stats.percent}%`;

    document.getElementById('motivationMessage').textContent = getMotivationalMessage(stats.total, stats.completed, stats.percent);

    document.getElementById('sumPlanned').textContent = stats.total;
    document.getElementById('sumCompleted').textContent = stats.completed;
    document.getElementById('sumRemaining').textContent = stats.pending;
    document.getElementById('sumHighLeft').textContent = stats.highPending;
    document.getElementById('summaryScorePill').textContent = `${stats.percent}% Productive`;
    document.getElementById('summaryNarrative').textContent = getDailyPerformanceNarrative(stats);

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

    const todayISO = getLocalDateISO();
    document.getElementById('count-all').textContent = tasks.length;
    document.getElementById('count-today').textContent = tasks.filter(t => t.date === todayISO).length;
    document.getElementById('count-upcoming').textContent = tasks.filter(t => t.date > todayISO).length;
    document.getElementById('count-pending').textContent = tasks.filter(t => !t.completed).length;
    document.getElementById('count-completed').textContent = tasks.filter(t => t.completed).length;
    document.getElementById('count-high').textContent = tasks.filter(t => t.priority === 'High').length;
  }

  /* ---- Filtering & Rendering ---- */
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
              ${task.completed ? `
                <button type="button" class="action-btn undo" data-action="toggle" data-id="${escapeHtml(task.id)}" title="Undo completion">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 14 4 9 9 4"></polyline>
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                  </svg>
                  Undo
                </button>
              ` : ''}
              <button type="button" class="action-btn" data-action="edit" data-id="${escapeHtml(task.id)}" title="Edit task">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
              </button>
              <button type="button" class="action-btn delete" data-action="delete" data-id="${escapeHtml(task.id)}" title="Delete task">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
                Delete
              </button>
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
      const showSplitHeaders = activeFilter !== 'pending' && activeFilter !== 'completed' && pendingItems.length > 0 && completedItems.length > 0;

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
        if (showSplitHeaders) html += `<div class="status-sublabel">Pending (${pendingItems.length})</div>`;
        html += `<div class="task-list">`;
        pendingItems.forEach(t => {
          html += renderTaskCard(t, t.date < todayISO && !t.completed);
        });
        html += `</div>`;
      }

      if (completedItems.length > 0) {
        if (showSplitHeaders) html += `<div class="status-sublabel">Completed (${completedItems.length})</div>`;
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

  function renderAll() {
    updateDashboardMetrics();
    renderTasks();
  }

  /* ---- CRUD Operations ---- */
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

  /* ---- Modals ---- */
  const taskModalBackdrop = document.getElementById('taskModalBackdrop');
  const summaryModalBackdrop = document.getElementById('summaryModalBackdrop');
  const confirmModalBackdrop = document.getElementById('confirmModalBackdrop');

  function openTaskModal(taskToEdit = null) {
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
      document.getElementById('taskDateInput').value = getLocalDateISO();
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

    const totalHistoryDone = tasks.filter(t => t.date < getLocalDateISO() && t.completed).length;

    document.getElementById('summaryModalBody').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; background:var(--input-bg); border:1px solid var(--border); padding:16px; border-radius:var(--radius-md);">
        <div>
          <div style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">${escapeHtml(formatDisplayDate(getLocalDateISO()))}</div>
          <div style="font-size:1.75rem; font-weight:800; letter-spacing:-0.03em;">${stats.percent}% Productivity</div>
        </div>
        <div class="summary-pill">${stats.completed} / ${stats.total} Tasks Done</div>
      </div>

      <div class="summary-metrics">
        <div class="summary-mini"><span>Total Planned</span><strong>${stats.total}</strong></div>
        <div class="summary-mini"><span>Tasks Completed</span><strong style="color:var(--success);">${stats.completed}</strong></div>
        <div class="summary-mini"><span>Tasks Remaining</span><strong style="color:var(--warning);">${stats.pending}</strong></div>
        <div class="summary-mini"><span>Historical Tasks Done</span><strong style="color:var(--info);">${totalHistoryDone}</strong></div>
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

  /* ---- Toast & Confetti ---- */
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

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#38bdf8', '#ec4899', '#8b5cf6'];
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

  /* ---- Event Bindings ---- */
  function bindEvents() {
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

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

    document.getElementById('openNewTaskBtn').addEventListener('click', () => openTaskModal());
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

    document.getElementById('openSummaryBtn').addEventListener('click', openSummaryModal);
    document.getElementById('cardFullSummaryBtn').addEventListener('click', openSummaryModal);
    document.getElementById('bannerSummaryBtn').addEventListener('click', openSummaryModal);
    document.getElementById('closeSummaryModalBtn').addEventListener('click', closeSummaryModal);
    document.getElementById('doneSummaryModalBtn').addEventListener('click', closeSummaryModal);
    summaryModalBackdrop.addEventListener('click', e => { if (e.target === summaryModalBackdrop) closeSummaryModal(); });

    document.getElementById('closeConfirmModalBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('cancelConfirmBtn').addEventListener('click', closeConfirmModal);
    confirmModalBackdrop.addEventListener('click', e => { if (e.target === confirmModalBackdrop) closeConfirmModal(); });
    document.getElementById('proceedConfirmBtn').addEventListener('click', () => {
      if (typeof pendingConfirmCallback === 'function') pendingConfirmCallback();
      closeConfirmModal();
    });

    document.getElementById('filterPills').addEventListener('click', e => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-pill').forEach(el => el.classList.remove('active'));
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
      renderTasks();
    });
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.classList.remove('visible');
      renderTasks();
      searchInput.focus();
    });

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
        message: `This will remove ${completedTodayCount} completed ${completedTodayCount === 1 ? 'task' : 'tasks'} from today while keeping your past task history safe.`,
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
        message: `You are about to remove all ${todayCount} task(s) scheduled for today (${formatDisplayDate(todayISO)}). Historical and upcoming tasks will NOT be touched.`,
        confirmLabel: "Reset Today's Tasks",
        onConfirm: () => {
          tasks = tasks.filter(t => t.date !== todayISO);
          saveTasks();
          renderAll();
          showToast("Today's tasks have been reset. Historical data preserved.");
        }
      });
    });

    document.getElementById('tasksContainer').addEventListener('click', e => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const { action, id } = actionEl.dataset;
      if (action === 'toggle') toggleTaskCompletion(id);
      else if (action === 'edit') {
        const task = tasks.find(t => t.id === id);
        if (task) openTaskModal(task);
      } else if (action === 'delete') deleteTask(id);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeTaskModal();
        closeSummaryModal();
        closeConfirmModal();
      }
    });
  }

  initTheme();
  updateGreetingAndDate();
  loadTasks();
  bindEvents();
  renderAll();
  setInterval(updateGreetingAndDate, 60000);
})();
