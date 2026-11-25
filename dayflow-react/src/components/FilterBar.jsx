import React from 'react';
import { CATEGORIES } from '../utils';

const FILTERS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'high', label: 'High Priority' }
];

export default function FilterBar({
  activeFilter,
  onFilterChange,
  filterCounts,
  activeCategory,
  onCategoryChange,
  onClearCompleted,
  onResetToday
}) {
  return (
    <section className="toolbar">
      <div className="filter-pills" role="tablist" aria-label="Task filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`filter-pill ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label} <span className="filter-count">{filterCounts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-actions">
        <select
          className="quick-select"
          aria-label="Filter by category"
          value={activeCategory}
          onChange={e => onCategoryChange(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={onClearCompleted}>
          Clear Completed
        </button>
        <button type="button" className="btn btn-danger-soft" onClick={onResetToday}>
          Reset Today
        </button>
      </div>
    </section>
  );
}
