import React from 'react';
import {
  RING_CIRCUMFERENCE,
  formatFullHeaderDate,
  getDailyPerformanceNarrative,
  getGreeting,
  getMotivationalMessage
} from '../utils';

export default function HeroDashboard({ now, todayStats, onOpenSummary }) {
  const ringOffset = RING_CIRCUMFERENCE * (1 - todayStats.percent / 100);
  const allDone = todayStats.total > 0 && todayStats.percent === 100;

  return (
    <>
      <section className={`celebration-banner ${allDone ? 'visible' : ''}`} role="status" aria-live="polite">
        <div className="celebration-content">
          <div className="celebration-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <strong>All today's tasks complete!</strong>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              You hit 100% completion for the day. Take a breather or review your daily summary.
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onOpenSummary}>
          View Summary
        </button>
      </section>

      <section className="hero-grid">
        <div className="card greeting-card">
          <div className="greeting-top">
            <div>
              <div className="greeting-date">{formatFullHeaderDate(now)}</div>
              <h1 className="greeting-heading">{getGreeting(now)}</h1>
              <p className="motivation-text">
                {getMotivationalMessage(todayStats.total, todayStats.completed, todayStats.percent)}
              </p>
            </div>

            <div className="progress-ring-wrap" aria-label="Today's completion progress">
              <svg className="progress-ring" viewBox="0 0 128 128">
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <circle className="progress-ring-track" cx="64" cy="64" r="54" />
                <circle
                  className="progress-ring-fill"
                  cx="64"
                  cy="64"
                  r="54"
                  style={{ strokeDashoffset: ringOffset.toFixed(2) }}
                />
              </svg>
              <div className="progress-ring-center">
                <span className="progress-percent">{todayStats.percent}%</span>
                <span className="progress-caption">Today</span>
              </div>
            </div>
          </div>

          <div className="linear-progress-wrap">
            <div className="linear-progress-meta">
              <span>Daily Completion Bar</span>
              <span>{todayStats.completed} of {todayStats.total} done</span>
            </div>
            <div className="linear-bar">
              <div className="linear-bar-fill" style={{ width: `${todayStats.percent}%` }} />
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-tile">
              <span className="stat-label">Total Today</span>
              <span className="stat-value">{todayStats.total}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Completed</span>
              <span className="stat-value completed">{todayStats.completed}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Pending</span>
              <span className="stat-value pending">{todayStats.pending}</span>
            </div>
          </div>
        </div>

        <aside className="card summary-card">
          <div className="summary-header">
            <div className="summary-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
              Daily Summary
            </div>
            <span className="summary-pill">{todayStats.percent}% Productive</span>
          </div>

          <div className="summary-metrics">
            <div className="summary-mini">
              <span>Planned Today</span>
              <strong>{todayStats.total}</strong>
            </div>
            <div className="summary-mini">
              <span>Completed</span>
              <strong style={{ color: 'var(--success)' }}>{todayStats.completed}</strong>
            </div>
            <div className="summary-mini">
              <span>Remaining</span>
              <strong style={{ color: 'var(--warning)' }}>{todayStats.pending}</strong>
            </div>
            <div className="summary-mini">
              <span>High Priority Left</span>
              <strong style={{ color: 'var(--danger)' }}>{todayStats.highPending}</strong>
            </div>
          </div>

          <p className="summary-narrative">{getDailyPerformanceNarrative(todayStats)}</p>

          <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={onOpenSummary}>
            Open Detailed End-of-Day Report
          </button>
        </aside>
      </section>
    </>
  );
}
