import React from 'react';
import { formatDisplayDate, formatTime12h } from '../utils';

export default function TaskCard({ task, todayISO, onToggleComplete, onEdit, onDelete }) {
  const isOverdue = task.date < todayISO && !task.completed;
  const dateBadgeText = `${formatDisplayDate(task.date)}${task.time ? ' • ' + formatTime12h(task.time) : ''}`;

  return (
    <article className={`task-card ${task.completed ? 'completed' : ''}`}>
      <button
        type="button"
        className="task-check-btn"
        onClick={() => onToggleComplete(task.id)}
        aria-label={task.completed ? 'Mark task as pending' : 'Mark task as completed'}
        aria-pressed={task.completed}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      <div className="task-body">
        <div className="task-top-row">
          <div className="task-title">{task.title}</div>
          <div className="task-actions">
            {task.completed && (
              <button
                type="button"
                className="action-btn undo"
                onClick={() => onToggleComplete(task.id)}
                title="Undo completion"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4" />
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                </svg>
                Undo
              </button>
            )}
            <button type="button" className="action-btn" onClick={() => onEdit(task)} title="Edit task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button type="button" className="action-btn delete" onClick={() => onDelete(task.id)} title="Delete task">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {task.description && <p className="task-desc">{task.description}</p>}

        <div className="task-badges">
          <span className={`badge badge-${task.priority.toLowerCase()}`}>
            {task.priority} Priority
          </span>
          <span className="badge badge-category">{task.category}</span>
          <span className={`badge ${isOverdue ? 'badge-overdue' : 'badge-time'}`}>
            {isOverdue ? 'Overdue • ' : ''}{dateBadgeText}
          </span>
        </div>
      </div>
    </article>
  );
}
