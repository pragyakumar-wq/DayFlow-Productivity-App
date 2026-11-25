import React, { useState } from 'react';
import { CATEGORIES } from '../utils';

export default function QuickAdd({ todayISO, onAddTask }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('Work');
  const [time, setTime] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      id: null,
      title: title.trim(),
      description: '',
      priority,
      category,
      date: todayISO,
      time
    });

    setTitle('');
    setTime('');
  }

  return (
    <section className="card quick-add-card">
      <form className="quick-add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="quick-add-input"
          placeholder="Quick add a task for today... (Press Enter)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={140}
          required
        />
        <select
          className="quick-select"
          aria-label="Task priority"
          value={priority}
          onChange={e => setPriority(e.target.value)}
        >
          <option value="Medium">Medium Priority</option>
          <option value="High">High Priority</option>
          <option value="Low">Low Priority</option>
        </select>
        <select
          className="quick-select"
          aria-label="Task category"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="time"
          className="quick-select"
          aria-label="Task time"
          title="Optional deadline time"
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Add Task</button>
      </form>
    </section>
  );
}
