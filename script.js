/* ==========================================================
   script.js – Kanban board with Add / Edit / Delete / Move support
   ==========================================================*/
document.addEventListener('DOMContentLoaded', () => {

  /* -------------------------------------------------
     1️⃣  Elements & State
   ------------------------------------------------- */
  const addTaskBtn                 = document.getElementById('add-task-btn');
  const modal                      = document.getElementById('task-modal');
  const closeModalBtn              = document.querySelector('.close-modal');
  const taskForm                   = document.getElementById('task-form');

  const todoTasksContainer         = document.getElementById('todo-tasks');
  const inprogressTasksContainer   = document.getElementById('inprogress-tasks');
  const doneTasksContainer         = document.getElementById('done-tasks');
  const kanbanBoard                = document.querySelector('.kanban-board');

  const todoCount                  = document.getElementById('todo-count');
  const inprogressCount            = document.getElementById('inprogress-count');
  const doneCount                  = document.getElementById('done-count');

  const searchInput                = document.getElementById('search-input');
  const filterCategory             = document.getElementById('filter-category');
  const filterPriority             = document.getElementById('filter-priority');

  const themeToggle                = document.getElementById('theme-toggle');
  const root                       = document.documentElement;

  /* -----------------------------------------------
     2️⃣  LOCAL STORAGE (STATE)
   ----------------------------------------------- */
  let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  const filters = { search: '', category: 'all', priority: 'all' };

  /* -----------------------------------------------
     3️⃣  GLOBAL: COLUMN ORDER
   ----------------------------------------------- */
  const STATUS_ORDER = ['todo', 'inprogress', 'done']; // left → right

  /* -----------------------------------------------
     4️⃣  THEME
   ----------------------------------------------- */
  const setThemeIcon = (theme) => {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
  };

  const initTheme = () => {
    const saved   = localStorage.getItem('theme');
    const system  = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme   = saved || (system ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    setThemeIcon(theme);
  };

  const toggleTheme = () => {
    const current = root.getAttribute('data-theme') || 'dark';
    const next    = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setThemeIcon(next);
  };

  /* -----------------------------------------------
     5️⃣  STORAGE
   ----------------------------------------------- */
  const saveTasks = () => localStorage.setItem('tasks', JSON.stringify(tasks));

  /* -----------------------------------------------
     6️⃣  HELPERS
   ----------------------------------------------- */
  const formatDate = iso => {
    if (!iso) return 'No due date';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isOverdue = (iso, status) => {
    if (!iso || status === 'done') return false;
    const endOfDue = new Date(iso + 'T23:59:59');
    return new Date() > endOfDue;
  };

  const applyFilters = task => {
    const c = filters.category === 'all' || task.category === filters.category;
    const p = filters.priority === 'all' || task.priority === filters.priority;
    const s = !filters.search || `${task.title} ${task.description || ''}`.toLowerCase().includes(filters.search);
    return c && p && s;
  };

  const updateCounts = filtered => {
    todoCount.textContent     = filtered.filter(t => t.status === 'todo').length;
    inprogressCount.textContent = filtered.filter(t => t.status === 'inprogress').length;
    doneCount.textContent     = filtered.filter(t => t.status === 'done').length;
  };

  /* -----------------------------------------------
     7️⃣  RENDER
   ----------------------------------------------- */
  const renderTasks = () => {
    // clear all columns
    todoTasksContainer.innerHTML      = '';
    inprogressTasksContainer.innerHTML = '';
    doneTasksContainer.innerHTML      = '';

    const filtered = tasks.filter(applyFilters);
    updateCounts(filtered);

    const columns = {
      todo:      { el: todoTasksContainer,      i: 0 },
      inprogress:{ el: inprogressTasksContainer, i: 0 },
      done:      { el: doneTasksContainer,      i: 0 }
    };

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.dataset.id = task.id;
      card.dataset.priority = task.priority;
      card.dataset.category = task.category;

      const overdue = isOverdue(task.dueDate, task.status);
      const dueDate = formatDate(task.dueDate);

      // only show “previous” btn if not in the left‑most column
      const firstStatus = STATUS_ORDER[0];

      card.innerHTML = `
        <h4>${task.title}</h4>
        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
        <div class="task-footer">
          <div class="meta">
            <span class="chip priority ${task.priority.toLowerCase()}">${task.priority}</span>
            <span class="chip">${task.category}</span>
            <span class="task-date ${overdue ? 'overdue' : ''}">
              <i class="fas fa-calendar-alt"></i> ${dueDate}
            </span>
          </div>
          <div class="task-actions">
            ${task.status !== firstStatus
              ? '<button class="move-prev-btn" title="Move to previous"><i class="fas fa-arrow-left"></i></button>'
              : ''}
            ${task.status !== 'done'
              ? '<button class="move-btn" title="Move to next"><i class="fas fa-arrow-right"></i></button>'
              : ''}
            <button class="edit-btn" title="Edit Task"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" title="Delete Task"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      `;

      const col = columns[task.status];
      if (col) {
        card.style.setProperty('--stagger', col.i++);
        col.el.appendChild(card);
      }
    });
  };

  /* -----------------------------------------------
     8️⃣  MODAL (Add / Edit)
   ----------------------------------------------- */
  let editTaskId = null;                     // id of task being edited

  const showModal = () => modal.style.display = 'flex';

  const closeModal = () => {
    modal.style.display = 'none';
    taskForm.reset();
    editTaskId = null;
    // clear modal title placeholder if you used one
    const title = modal.querySelector('.modal-title');
    if (title) title.textContent = 'Add New Task';
  };

  const handleFormSubmit = e => {
    e.preventDefault();

    const title    = document.getElementById('task-title').value.trim();
    const desc     = document.getElementById('task-desc').value.trim();
    const category = document.getElementById('task-category').value;
    const priority = document.getElementById('task-priority').value;
    const due      = document.getElementById('task-due-date').value;

    if (editTaskId) {                     // ---- EDIT MODE ----
      const task = tasks.find(t => t.id === editTaskId);
      if (task) {
        task.title       = title;
        task.description = desc;
        task.category    = category;
        task.priority    = priority;
        task.dueDate     = due;
        // status stays unchanged
      }
    } else {                               // ---- CREATE MODE ----
      const newTask = {
        id:          'task-' + Date.now(),
        title,
        description: desc,
        category,
        priority,
        dueDate:     due,
        status:      'todo'                  // new task always starts in “todo”
      };
      tasks.push(newTask);
    }

    saveTasks();
    renderTasks();
    closeModal();
  };

  /* -----------------------------------------------
     9️⃣  INTERACTIONS
   ----------------------------------------------- */
  const handleKanbanClick = e => {
    const target = e.target;
    const card   = target.closest('.task-card');
    if (!card) return;

    const id  = card.dataset.id;
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) return;        // safety

    /* a) Delete */
    if (target.closest('.delete-btn')) {
      card.classList.add('deleting');
      setTimeout(() => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
      }, 350);
      return;
    }

    /* b) Move Next */
    if (target.closest('.move-btn')) {
      const curIdx = STATUS_ORDER.indexOf(tasks[idx].status);
      const next   = STATUS_ORDER[curIdx + 1];
      if (next) {
        tasks[idx].status = next;
        saveTasks();
        renderTasks();
      }
      return;
    }

    /* c) Move Previous */
    if (target.closest('.move-prev-btn')) {
      const curIdx = STATUS_ORDER.indexOf(tasks[idx].status);
      const prev   = STATUS_ORDER[curIdx - 1];
      if (prev) {
        tasks[idx].status = prev;
        saveTasks();
        renderTasks();
      }
      return;
    }

    /* d) Edit */
    if (target.closest('.edit-btn')) {
      const task = tasks[idx];
      if (!task) return;

      // pre‑populate the form
      document.getElementById('task-title').value        = task.title;
      document.getElementById('task-desc').value         = task.description;
      document.getElementById('task-category').value    = task.category;
      document.getElementById('task-priority').value    = task.priority;
      document.getElementById('task-due-date').value     = task.dueDate ?? '';

      // remember which task is being edited
      editTaskId = task.id;

      // optional: update modal header
      const title = modal.querySelector('.modal-title');
      if (title) title.textContent = 'Edit Task';

      showModal();
      return;
    }
  };

  /* -----------------------------------------------
     🔎  Filter & Search
   ----------------------------------------------- */
  const handleSearch = e => { filters.search = e.target.value.toLowerCase(); renderTasks(); };
  const handleCategory = e => { filters.category = e.target.value; renderTasks(); };
  const handlePriority = e => { filters.priority = e.target.value; renderTasks(); };

  /* -----------------------------------------------
     🔧  EVENT LISTENERS
   ----------------------------------------------- */
  addTaskBtn.addEventListener('click', () => {
    // reset form for fresh Add mode
    editTaskId = null;
    taskForm.reset();
    const title = modal.querySelector('.modal-title');
    if (title) title.textContent = 'Add New Task';
    showModal();
  });

  closeModalBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  taskForm.addEventListener('submit', handleFormSubmit);
  kanbanBoard.addEventListener('click', handleKanbanClick);

  searchInput.addEventListener('input', handleSearch);
  filterCategory.addEventListener('change', handleCategory);
  filterPriority.addEventListener('change', handlePriority);

  themeToggle.addEventListener('click', toggleTheme);

  /* -----------------------------------------------
     ✔  INITIAL RENDER
   ----------------------------------------------- */
  initTheme();
  renderTasks();
});
