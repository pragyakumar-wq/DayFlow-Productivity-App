import React from 'react';
import { sortTasks } from '../utils';
import TaskCard from './TaskCard';

export default function TaskList({
  groupedBuckets,
  activeFilter,
  searchQuery,
  todayISO,
  onToggleComplete,
  onEdit,
  onDelete,
  onCreateTask
}) {
  if (groupedBuckets.length === 0) {
    return (
      <section className="tasks-container" aria-live="polite">
        <div className="card empty-state">
          <div className="empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h3>Nothing here right now</h3>
          <p>
            {searchQuery.trim()
              ? `No tasks matched "${searchQuery.trim()}". Try another keyword or clear your filters.`
              : 'No tasks found in this view. Add a new task to stay ahead of your schedule.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={onCreateTask}>
            Create a Task
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tasks-container" aria-live="polite">
      {groupedBuckets.map(bucket => {
        const pendingItems = sortTasks(bucket.items.filter(t => !t.completed));
        const completedItems = sortTasks(bucket.items.filter(t => t.completed));
        const showSplit =
          activeFilter !== 'pending' &&
          activeFilter !== 'completed' &&
          pendingItems.length > 0 &&
          completedItems.length > 0;

        return (
          <div className="date-group" key={bucket.key}>
            <div className="date-group-header">
              <div className="date-group-title">
                <span className={`date-dot ${bucket.dotClass}`} />
                <span>{bucket.title}</span>
              </div>
              <span className="date-group-meta">
                {bucket.items.length} {bucket.items.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            {pendingItems.length > 0 && (
              <>
                {showSplit && <div className="status-sublabel">Pending ({pendingItems.length})</div>}
                <div className="task-list">
                  {pendingItems.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      todayISO={todayISO}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </>
            )}

            {completedItems.length > 0 && (
              <>
                {showSplit && <div className="status-sublabel">Completed ({completedItems.length})</div>}
                <div className="task-list">
                  {completedItems.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      todayISO={todayISO}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
