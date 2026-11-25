import React, { useEffect, useState } from 'react';
import {
  CATEGORIES,
  formatDisplayDate,
  getDailyPerformanceNarrative,
  getLocalDateISO
} from '../utils';

export function TaskModal({ isOpen, taskToEdit, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('Work');
  const [date, setDate] = useState(getLocalDateISO());
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority);
      setCategory(taskToEdit.category);
      setDate(taskToEdit.date);
      setTime(taskToEdit.time || '');
    } else {
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setCategory('Work');
      setDate(getLocalDateISO());
      setTime('');
    }
  }, [isOpen, taskToEdit]);

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: taskToEdit?.id || null,
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      date,
      time
    });
    onClose();
  }

  return (
    <div
      className="modal-backdrop open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{taskToEdit ? 'Edit Task' : 'Create New Task'}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="r-task-title">Task Title *</label>
              <input
                id="r-task-title"
                type="text"
                className="form-control"
                placeholder="e.g., Finish quarterly report"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={140}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="r-task-desc">Description</label>
              <textarea
                id="r-task-desc"
                className="form-control"
                placeholder="Add helpful notes, checklist items, or context..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="r-task-priority">Priority</label>
                <select
                  id="r-task-priority"
                  className="form-control"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="r-task-category">Category</label>
                <select
                  id="r-task-category"
                  className="form-control"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="r-task-date">Due Date *</label>
                <input
                  id="r-task-date"
                  type="date"
                  className="form-control"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="r-task-time">Deadline Time (Optional)</label>
                <input
                  id="r-task-time"
                  type="time"
                  className="form-control"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SummaryModal({ isOpen, onClose, stats, tasks }) {
  if (!isOpen) return null;

  const todayISO = getLocalDateISO();
  const totalHistoryDone = tasks.filter(t => t.date < todayISO && t.completed).length;

  const categoryBreakdowns = CATEGORIES.map(cat => {
    const catTasks = stats.todayTasks.filter(t => t.category === cat);
    if (catTasks.length === 0) return null;
    const done = catTasks.filter(t => t.completed).length;
    const pct = Math.round((done / catTasks.length) * 100);
    return { cat, done, total: catTasks.length, pct };
  }).filter(Boolean);

  return (
    <div
      className="modal-backdrop open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>End-of-Day Performance Summary</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close summary">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            padding: '16px',
            borderRadius: 'var(--radius-md)'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {formatDisplayDate(todayISO)}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                {stats.percent}% Productivity
              </div>
            </div>
            <div className="summary-pill">{stats.completed} / {stats.total} Tasks Done</div>
          </div>

          <div className="summary-metrics">
            <div className="summary-mini">
              <span>Total Planned</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="summary-mini">
              <span>Tasks Completed</span>
              <strong style={{ color: 'var(--success)' }}>{stats.completed}</strong>
            </div>
            <div className="summary-mini">
              <span>Tasks Remaining</span>
              <strong style={{ color: 'var(--warning)' }}>{stats.pending}</strong>
            </div>
            <div className="summary-mini">
              <span>Historical Tasks Done</span>
              <strong style={{ color: 'var(--info)' }}>{totalHistoryDone}</strong>
            </div>
          </div>

          <div className="summary-narrative">
            <strong>Daily Performance Review:</strong>
            <br />
            {getDailyPerformanceNarrative(stats)}
          </div>

          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: '10px' }}>
              Today's Category Breakdown
            </div>
            <div className="breakdown-list">
              {categoryBreakdowns.length > 0 ? (
                categoryBreakdowns.map(item => (
                  <div className="breakdown-item" key={item.cat}>
                    <div className="breakdown-row">
                      <span>{item.cat}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.done}/{item.total} ({item.pct}%)
                      </span>
                    </div>
                    <div className="breakdown-bar">
                      <div className="breakdown-fill" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No tasks planned for today yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal({ config, onClose }) {
  const [extraChecked, setExtraChecked] = useState(false);

  useEffect(() => {
    setExtraChecked(false);
  }, [config]);

  if (!config) return null;

  return (
    <div
      className="modal-backdrop open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{config.title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close confirmation">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{config.message}</p>
          {config.extraOptionText && (
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={extraChecked}
                onChange={e => setExtraChecked(e.target.checked)}
              />
              <span>{config.extraOptionText}</span>
            </label>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-danger-soft"
            onClick={() => {
              config.onConfirm(extraChecked);
              onClose();
            }}
          >
            {config.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
