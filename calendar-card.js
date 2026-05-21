// ============================================================
//  Calendar Card for Home Assistant
//
//  A clean day + week grid card with event popups and todo support.
//
//  Setup:
//    1. Copy to /config/www/calendar-card.js
//    2. Lovelace resource: /local/calendar-card.js?v=1  (module)
//    3. Card YAML:
//         type: custom:calendar-card
//         calendar_entity: calendar.your_real_entity
//         todo_entity: todo.your_real_entity   (optional)
// ============================================================

class CalendarCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass     = null;
    this._config   = {};
    this._events   = [];
    this._todos    = [];
    this._popup    = null;
    this._styleTag = null;
    this._timer    = null;
  }

  setConfig(config) {
    if (!config.calendar_entity) throw new Error('calendar_entity is required');
    this._config = {
      calendar_entity: config.calendar_entity,
      todo_entity:     config.todo_entity || null,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._timer) {
      this._load();
      this._timer = setInterval(() => this._load(), 60000);
    }
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    this._popup?.remove();
    this._styleTag?.remove();
  }

  async _load() {
    if (!this._hass) return;
    await Promise.all([
      this._loadCalendar(),
      this._loadTodos(),
    ]);
    this._render();
  }

  async _loadCalendar() {
    const now    = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    sunday.setHours(0, 0, 0, 0);
    const end = new Date(sunday);
    end.setDate(sunday.getDate() + 7);
    try {
      const data = await this._hass.callApi(
        'GET',
        `calendars/${this._config.calendar_entity}?start=${sunday.toISOString()}&end=${end.toISOString()}`
      );
      this._events = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('CalendarCard: _loadCalendar failed', err);
      this._events = [];
    }
  }

  async _loadTodos() {
    if (!this._config.todo_entity) return;
    try {
      const resp = await this._hass.callWS({
        type:      'todo/item/list',
        entity_id: this._config.todo_entity,
      });
      const today = this._dateKey(new Date());
      this._todos = (resp?.items || []).filter(t => {
        if (t.status !== 'needs_action') return false;
        if (!t.due) return true;
        return t.due.slice(0, 10) <= today;
      });
    } catch (err) {
      console.error('CalendarCard: _loadTodos failed', err);
      this._todos = [];
    }
  }

  _dateKey(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  _evDateKey(ev) {
    if (!ev?.start) return '';
    if (ev.start.dateTime) {
      const d = new Date(ev.start.dateTime);
      return this._dateKey(d);
    }
    return (ev.start.date || '').slice(0, 10);
  }

  _fmt12(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  _fmtDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  _weekDays() {
    const now = new Date();
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay());
    sun.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      return d;
    });
  }

  _evsByDay() {
    const map = {};
    this._events.forEach(ev => {
      const k = this._evDateKey(ev);
      if (!k) return;
      (map[k] = map[k] || []).push(ev);
    });
    return map;
  }

  _render() {
    const now      = new Date();
    const todayKey = this._dateKey(now);
    const days     = this._weekDays();
    const byDay    = this._evsByDay();
    const todayEvs = byDay[todayKey] || [];

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const todayHTML = todayEvs.length
      ? todayEvs.map((ev, i) => {
          const allDay = !ev.start?.dateTime;
          const time   = allDay ? 'All day' : this._fmt12(ev.start.dateTime);
          return `<div class="ev-row" data-idx="${i}">
            <span class="dot"></span>
            <span class="ev-time">${time}</span>
            <span class="ev-name">${ev.summary || 'Untitled'}</span>
            <span class="chevron">›</span>
          </div>`;
        }).join('')
      : '<p class="empty">No events today</p>';

    const todoHTML = this._config.todo_entity
      ? (this._todos.length
          ? this._todos.map((t, i) => `
              <div class="todo" data-tidx="${i}">
                <div class="cb"></div>
                <span class="todo-text">${t.summary || 'Task'}</span>
              </div>`).join('')
          : '<p class="empty">No tasks due today</p>')
      : '';

    const todoSection = this._config.todo_entity
      ? `<div class="label">Tasks</div>${todoHTML}`
      : '';

    const headers = days.map(d => {
      const k = this._dateKey(d);
      const isToday = k === todayKey;
      const isPast  = k < todayKey;
      return `<div class="gh ${isToday?'today':''} ${isPast?'past':''}">
        <span class="gdow">${DAYS[d.getDay()]}</span>
        <div class="gnum-wrap"><span class="gnum">${d.getDate()}</span></div>
      </div>`;
    }).join('');

    const cells = days.map(d => {
      const k = this._dateKey(d);
      const isToday = k === todayKey;
      const isPast  = k < todayKey;
      const evs     = byDay[k] || [];
      const inner   = evs.length
        ? evs.map(ev => {
            const allDay = !ev.start?.dateTime;
            const time   = allDay ? 'All day' : this._fmt12(ev.start.dateTime);
            const gi     = this._events.indexOf(ev);
            return `<div class="gev" data-idx="${gi}">
              <span class="gev-time">${time}</span>
              <span class="gev-name">${ev.summary || 'Untitled'}</span>
            </div>`;
          }).join('')
        : '<span class="gempty">—</span>';
      return `<div class="gc ${isToday?'today':''} ${isPast?'past':''}">${inner}</div>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--primary-font-family,'Segoe UI',system-ui,sans-serif); }
        .panel { background:var(--card-background-color,#1c1f26); border-radius:16px; margin-bottom:10px; box-shadow:var(--ha-card-box-shadow,0 2px 12px rgba(0,0,0,.4)); overflow:hidden; }
        .panel:last-child { margin-bottom:0; }
        .padded { padding:20px 20px 16px; }
        .day-hdr  { display:flex; align-items:baseline; gap:10px; margin-bottom:2px; }
        .day-name { font-size:1.7em; font-weight:700; color:var(--primary-text-color,#f0f0f0); }
        .day-num  { font-size:1.05em; color:var(--secondary-text-color,#777); }
        .month    { font-size:.67em; letter-spacing:.12em; text-transform:uppercase; color:var(--accent-color,#03a9f4); margin-bottom:16px; font-weight:500; }
        .label    { font-size:.6em; letter-spacing:.12em; text-transform:uppercase; color:var(--secondary-text-color,#555); margin:12px 0 6px; font-weight:700; }
        .empty    { font-size:.8em; color:var(--secondary-text-color,#555); font-style:italic; padding:4px 0; }
        .ev-row   { display:flex; align-items:center; gap:9px; padding:6px 6px 6px 4px; border-bottom:1px solid var(--divider-color,rgba(255,255,255,.05)); cursor:pointer; border-radius:6px; transition:background .12s; }
        .ev-row:last-child { border-bottom:none; }
        .ev-row:hover { background:rgba(255,255,255,.06); }
        .dot      { width:7px; height:7px; border-radius:50%; background:var(--accent-color,#03a9f4); flex-shrink:0; }
        .ev-time  { font-size:.69em; color:var(--secondary-text-color,#555); min-width:54px; flex-shrink:0; }
        .ev-name  { font-size:.83em; color:var(--primary-text-color,#ddd); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chevron  { color:var(--secondary-text-color,#444); flex-shrink:0; }
        .todo     { display:flex; align-items:center; gap:10px; padding:6px 4px; border-bottom:1px solid var(--divider-color,rgba(255,255,255,.05)); }
        .todo:last-child { border-bottom:none; }
        .todo.done { opacity:.35; }
        .cb       { width:18px; height:18px; flex-shrink:0; border:2px solid var(--secondary-text-color,#555); border-radius:5px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s, border-color .15s; }
        .cb.checked { background:var(--accent-color,#03a9f4); border-color:var(--accent-color,#03a9f4); }
        .cb.checked::after { content:''; width:5px; height:9px; border:2px solid #fff; border-top:none; border-left:none; transform:rotate(45deg) translate(-1px,-1px); display:block; }
        .todo-text { font-size:.83em; color:var(--primary-text-color,#ccc); flex:1; }
        .todo.done .todo-text { text-decoration:line-through; color:var(--secondary-text-color,#555); }
        .grid-hdr  { display:grid; grid-template-columns:repeat(7,1fr); border-bottom:1px solid var(--divider-color,rgba(255,255,255,.09)); }
        .gh        { padding:10px 4px 8px; display:flex; flex-direction:column; align-items:center; gap:4px; border-right:1px solid var(--divider-color,rgba(255,255,255,.06)); }
        .gh:last-child { border-right:none; }
        .gh.today  { background:rgba(3,169,244,.1); }
        .gh.past   { opacity:.4; }
        .gdow      { font-size:.58em; text-transform:uppercase; letter-spacing:.09em; color:var(--secondary-text-color,#555); font-weight:700; }
        .gh.today .gdow { color:var(--accent-color,#03a9f4); }
        .gnum-wrap { width:27px; height:27px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
        .gh.today .gnum-wrap { background:var(--accent-color,#03a9f4); }
        .gnum      { font-size:.92em; font-weight:700; color:var(--secondary-text-color,#bbb); }
        .gh.today .gnum { color:#fff; }
        .grid-body { display:grid; grid-template-columns:repeat(7,1fr); align-items:start; }
        .gc        { padding:6px 4px 10px; border-right:1px solid var(--divider-color,rgba(255,255,255,.06)); min-height:90px; }
        .gc:last-child { border-right:none; }
        .gc.today  { background:rgba(3,169,244,.05); }
        .gc.past   { opacity:.35; }
        .gev       { margin-bottom:4px; padding:3px 5px 4px; border-radius:5px; background:rgba(3,169,244,.13); border-left:2px solid var(--accent-color,#03a9f4); cursor:pointer; transition:opacity .12s; }
        .gev:hover { opacity:.7; outline:1px solid var(--accent-color,#03a9f4); }
        .gev-time  { font-size:.56em; color:var(--accent-color,#03a9f4); font-weight:600; display:block; margin-bottom:1px; }
        .gev-name  { font-size:.7em; color:var(--primary-text-color,#ddd); line-height:1.25; word-break:break-word; display:block; }
        .gempty    { font-size:.7em; color:var(--divider-color,#2a2a35); text-align:center; padding-top:16px; display:block; }
      </style>
      <div class="panel padded">
        <div class="day-hdr">
          <span class="day-name">${now.toLocaleDateString([],{weekday:'long'})}</span>
          <span class="day-num">${now.getDate()}</span>
        </div>
        <div class="month">${MONTHS[now.getMonth()]} ${now.getFullYear()}</div>
        <div class="label">Today</div>
        ${todayHTML}
        ${todoSection}
      </div>
      <div class="panel">
        <div class="grid-hdr">${headers}</div>
        <div class="grid-body">${cells}</div>
      </div>
    `;
    this._wire();
  }

  _wire() {
    this._ensurePopup();
    this.shadowRoot.addEventListener('click', e => {
      const cb = e.target.closest('.cb');
      if (cb) {
        const row = cb.closest('[data-tidx]');
        if (row) this._checkTodo(parseInt(row.dataset.tidx), row, cb);
        return;
      }
      if (e.target.closest('.todo')) return;
      const evEl = e.target.closest('[data-idx]');
      if (evEl) this._openPopup(parseInt(evEl.dataset.idx));
    });
  }

  _checkTodo(idx, row, cb) {
    const todo = this._todos[idx];
    if (!todo) return;
    cb.classList.add('checked');
    row.classList.add('done');
    setTimeout(() => {
      row.style.cssText = `max-height:${row.offsetHeight}px;overflow:hidden;transition:max-height .35s ease,opacity .35s ease,padding .35s ease`;
      requestAnimationFrame(() => {
        row.style.maxHeight = '0';
        row.style.opacity   = '0';
        row.style.padding   = '0';
      });
    }, 400);
    if (this._hass && this._config.todo_entity) {
      this._hass.callService('todo', 'update_item', {
        entity_id: this._config.todo_entity,
        item:      todo.summary,
        status:    'completed',
      }).catch(err => console.warn('CalendarCard: todo update failed', err));
    }
  }

  _ensurePopup() {
    if (this._popup) return;
    this._styleTag = document.createElement('style');
    this._styleTag.textContent = `
      #cc-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:999999; opacity:0; pointer-events:none; transition:opacity .18s; font-family:'Segoe UI',system-ui,sans-serif; }
      #cc-overlay.open { opacity:1; pointer-events:all; }
      #cc-box { background:var(--card-background-color,#1c1f26); border-radius:18px; padding:22px 22px 18px; width:min(340px,90vw); box-shadow:0 12px 48px rgba(0,0,0,.85); transform:translateY(14px) scale(.97); transition:transform .18s; position:relative; max-height:80vh; overflow-y:auto; }
      #cc-overlay.open #cc-box { transform:none; }
      #cc-x { position:absolute; top:14px; right:16px; background:none; border:none; color:#888; font-size:1.3em; cursor:pointer; padding:2px 6px; border-radius:6px; }
      #cc-x:hover { color:#fff; }
      #cc-title { font-size:1.05em; font-weight:700; color:#f0f0f0; padding-right:28px; margin-bottom:14px; line-height:1.3; }
      .cc-row { display:flex; align-items:flex-start; gap:10px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,.07); }
      .cc-row:last-child { border-bottom:none; }
      .cc-icon { width:20px; text-align:center; flex-shrink:0; margin-top:1px; }
      .cc-col  { display:flex; flex-direction:column; flex:1; min-width:0; }
      .cc-lbl  { font-size:.67em; color:#666; text-transform:uppercase; letter-spacing:.09em; font-weight:700; margin-bottom:2px; }
      .cc-val  { font-size:.85em; color:#ddd; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
    `;
    document.head.appendChild(this._styleTag);
    this._popup = document.createElement('div');
    this._popup.id = 'cc-overlay';
    this._popup.innerHTML = `<div id="cc-box"><button id="cc-x">✕</button><div id="cc-title"></div><div id="cc-body"></div></div>`;
    document.body.appendChild(this._popup);
    this._popup.addEventListener('click', e => { if (e.target === this._popup) this._closePopup(); });
    this._popup.querySelector('#cc-x').addEventListener('click', () => this._closePopup());
  }

  _openPopup(idx) {
    const ev = this._events[idx];
    if (!ev || !this._popup) return;
    document.getElementById('cc-title').textContent = ev.summary || 'Untitled';
    const rows = [];
    const allDay = !ev.start?.dateTime;
    if (allDay) {
      let label = this._fmtDate(ev.start?.date || '');
      if (ev.end?.date && ev.end.date !== ev.start?.date) {
        const d = new Date(ev.end.date);
        d.setDate(d.getDate() - 1);
        const endLabel = this._fmtDate(this._dateKey(d));
        if (endLabel !== label) label += ` – ${endLabel}`;
      }
      rows.push({ icon:'📅', lbl:'Date', val:label });
    } else {
      const s = new Date(ev.start.dateTime);
      rows.push({ icon:'📅', lbl:'Date', val:s.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}) });
      rows.push({ icon:'🕐', lbl:'Time', val: ev.end?.dateTime
        ? `${this._fmt12(ev.start.dateTime)} – ${this._fmt12(ev.end.dateTime)}`
        : this._fmt12(ev.start.dateTime) });
    }
    if (ev.location) rows.push({ icon:'📍', lbl:'Location', val:ev.location });
    if (ev.description) {
      const clean = ev.description.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
      if (clean) rows.push({ icon:'📝', lbl:'Notes', val:clean });
    }
    document.getElementById('cc-body').innerHTML = rows.map(r =>
      `<div class="cc-row"><span class="cc-icon">${r.icon}</span><div class="cc-col"><span class="cc-lbl">${r.lbl}</span><span class="cc-val">${r.val}</span></div></div>`
    ).join('');
    this._popup.classList.add('open');
    this._esc = e => { if (e.key === 'Escape') this._closePopup(); };
    document.addEventListener('keydown', this._esc);
  }

  _closePopup() {
    this._popup?.classList.remove('open');
    if (this._esc) { document.removeEventListener('keydown', this._esc); this._esc = null; }
  }

  static getStubConfig() {
    return { calendar_entity: 'calendar.your_calendar' };
  }
}

customElements.define('calendar-card', CalendarCard);
window.customCards = window.customCards || [];
window.customCards.push({ type:'calendar-card', name:'Calendar Card', description:'Two-panel calendar card with day view, week grid, event popups and todo support' });
