import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import HeroDashboard from './components/HeroDashboard';
import QuickAdd from './components/QuickAdd';
import FilterBar from './components/FilterBar';
import TaskList from './components/TaskList';
import { ConfirmModal, SummaryModal, TaskModal } from './components/Modals';
import {
  STORAGE_KEYS,
  formatDisplayDate,
  generateId,
  getLocalDateISO,
  getTomorrowISO,
  launchConfetti,
  loadInitialTasks
} from './utils';

export default function App() {
  const [tasks, setTasks] = useState(loadInitialTasks);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.THEME) === 'light' ? 'light' : 'dark'
  );
  const [now, setNow] = useState(() => new Date());

  const [activeFilter, setActiveFilter] = useState('all');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [toasts, setToasts] = useState([]);

  const confettiCanvasRef = useRef(null);
  const prevPercentRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (err) {
      console.error('Could not save theme:', err);
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (err) {
      console.error('Could not save tasks:', err);
    }
  }, [tasks]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        setTaskModalOpen(false);
        setSummaryOpen(false);
        setConfirmConfig(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function showToast(message, options = {}) {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, ...options }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4200);
  }

  const todayISO = getLocalDateISO(now);
  const tomorrowISO = getTomorrowISO();

  const todayStats = useMemo(() => {
    const todayTasks = tasks.filter(t => t.date === todayISO);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const highPending = todayTasks.filter(t => !t.completed && t.priority === 'High').length;
    return { todayTasks, total, completed, pending, percent, highPending };
  }, [tasks, todayISO]);

  useEffect(() => {
    if (
      todayStats.total > 0 &&
      todayStats.percent === 100 &&
      prevPercentRef.current !== null &&
      prevPercentRef.current < 100
    ) {
      launchConfetti(confettiCanvasRef.current);
      showToast('100% Daily Goal Achieved! Great work today.');
    }
    prevPercentRef.current = todayStats.percent;
  }, [todayStats.total, todayStats.percent]);

  const filterCounts = useMemo(() => ({
    all: tasks.length,
    today: tasks.filter(t => t.date === todayISO).length,
    upcoming: tasks.filter(t => t.date > todayISO).length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    high: tasks.filter(t => t.priority === 'High').length
  }), [tasks, todayISO]);

  const groupedBuckets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter(task => {
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

    return buckets.filter(b => b.items.length > 0);
  }, [tasks, activeFilter, activeCategory, searchQuery, todayISO, tomorrowISO]);

  function handleSaveTask(payload) {
    if (payload.id) {
      setTasks(prev => prev.map(t => (t.id === payload.id ? { ...t, ...payload } : t)));
      showToast('Task updated.');
    } else {
      const newTask = {
        ...payload,
        id: generateId(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      setTasks(prev => [newTask, ...prev]);
      showToast('Task added successfully.');
    }
  }

  function handleToggleComplete(id) {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    const nextState = !target.completed;

    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, completed: nextState, completedAt: nextState ? new Date().toISOString() : null }
          : t
      )
    );

    if (nextState) {
      showToast(`Completed "${target.title}"`, {
        undoLabel: 'Undo',
        onUndo: () => {
          setTasks(prev =>
            prev.map(t => (t.id === id ? { ...t, completed: false, completedAt: null } : t))
          );
        }
      });
    } else {
      showToast(`Moved "${target.title}" back to pending.`);
    }
  }

  function handleDeleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const removed = tasks[idx];
    setTasks(prev => prev.filter(t => t.id !== id));

    showToast(`Deleted "${removed.title}"`, {
      undoLabel: 'Restore',
      onUndo: () => {
        setTasks(prev => {
          if (prev.some(t => t.id === removed.id)) return prev;
          const copy = [...prev];
          copy.splice(Math.min(idx, copy.length), 0, removed);
          return copy;
        });
      }
    });
  }

  function handleClearCompleted() {
    const completedTodayCount = tasks.filter(t => t.date === todayISO && t.completed).length;
    const totalCompletedCount = tasks.filter(t => t.completed).length;
    if (totalCompletedCount === 0) {
      showToast('No completed tasks to clear.');
      return;
    }

    setConfirmConfig({
      title: 'Clear Completed Tasks',
      message: `This will remove ${completedTodayCount} completed ${completedTodayCount === 1 ? 'task' : 'tasks'} from today while keeping your past task history safe.`,
      confirmLabel: 'Clear Completed',
      extraOptionText: `Also remove older completed tasks (${totalCompletedCount - completedTodayCount} historical)`,
      onConfirm: includeHistory => {
        setTasks(prev => {
          const next = prev.filter(t => {
            if (!t.completed) return true;
            if (includeHistory) return false;
            return t.date !== todayISO;
          });
          showToast(`Cleared ${prev.length - next.length} completed task(s).`);
          return next;
        });
      }
    });
  }

  function handleResetToday() {
    const todayCount = tasks.filter(t => t.date === todayISO).length;
    if (todayCount === 0) {
      showToast("Today's task list is already empty.");
      return;
    }

    setConfirmConfig({
      title: "Reset Today's Tasks?",
      message: `You are about to remove all ${todayCount} task(s) scheduled for today (${formatDisplayDate(todayISO)}). Your historical tasks and upcoming schedule will NOT be touched.`,
      confirmLabel: "Reset Today's Tasks",
      onConfirm: () => {
        setTasks(prev => prev.filter(t => t.date !== todayISO));
        showToast("Today's tasks have been reset. Historical data preserved.");
      }
    });
  }

  return (
    <>
      <canvas id="confettiCanvas" ref={confettiCanvasRef} />

      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenSummary={() => setSummaryOpen(true)}
        onOpenNewTask={() => {
          setEditingTask(null);
          setTaskModalOpen(true);
        }}
      />

      <main className="container">
        <HeroDashboard
          now={now}
          todayStats={todayStats}
          onOpenSummary={() => setSummaryOpen(true)}
        />

        <QuickAdd todayISO={todayISO} onAddTask={handleSaveTask} />

        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filterCounts={filterCounts}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onClearCompleted={handleClearCompleted}
          onResetToday={handleResetToday}
        />

        <TaskList
          groupedBuckets={groupedBuckets}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          todayISO={todayISO}
          onToggleComplete={handleToggleComplete}
          onEdit={task => {
            setEditingTask(task);
            setTaskModalOpen(true);
          }}
          onDelete={handleDeleteTask}
          onCreateTask={() => {
            setEditingTask(null);
            setTaskModalOpen(true);
          }}
        />
      </main>

      <TaskModal
        isOpen={taskModalOpen}
        taskToEdit={editingTask}
        onClose={() => setTaskModalOpen(false)}
        onSave={handleSaveTask}
      />

      <SummaryModal
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        stats={todayStats}
        tasks={tasks}
      />

      <ConfirmModal
        config={confirmConfig}
        onClose={() => setConfirmConfig(null)}
      />

      <div className="toast-container" aria-live="polite">
        {toasts.map(toast => (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.undoLabel && toast.onUndo && (
              <button
                type="button"
                className="toast-undo"
                onClick={() => {
                  toast.onUndo();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
              >
                {toast.undoLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
