export const STORAGE_KEYS = {
  TASKS: 'dayflow_tasks_v1',
  THEME: 'dayflow_theme_v1',
  INITIALIZED: 'dayflow_initialized_v1'
};

export const RING_CIRCUMFERENCE = 2 * Math.PI * 54;
export const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };
export const CATEGORIES = ['Work', 'Study', 'Personal', 'Health', 'Other'];

export function getLocalDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateISO(d);
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatFullHeaderDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

export function generateId() {
  return 'tsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning!';
  if (hour >= 12 && hour < 17) return 'Good Afternoon!';
  if (hour >= 17 && hour < 22) return 'Good Evening!';
  return 'Good Night!';
}

export function getMotivationalMessage(total, completed, percent) {
  if (total === 0) return 'Clean slate today. Add a few focused tasks to get momentum going.';
  if (percent === 0) return 'Start with one small win—knocking out the first task builds instant momentum.';
  if (percent < 40) return `You're off the mark (${completed} done). Keep chipping away one task at a time.`;
  if (percent < 75) return 'Solid rhythm! You are past the midway point—stay locked in.';
  if (percent < 100) return 'Almost at the finish line! Just a little push left to wrap up your day.';
  return 'Flawless finish! Every single task on your list for today is checked off.';
}

export function getDailyPerformanceNarrative(stats) {
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

export function loadInitialTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to read tasks:', err);
  }

  if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
    const today = getLocalDateISO();
    const tomorrow = getTomorrowISO();
    const starter = [
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
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(starter));
    return starter;
  }

  return [];
}

export function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return (a.time || '23:59').localeCompare(b.time || '23:59');
  });
}

export function launchConfetti(canvas) {
  if (!canvas) return;
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
