const STORAGE = {
  tasks: "kanban-redesign-tasks-v1",
  mode: "kanban-redesign-storage-mode-v1",
  supabase: "kanban-redesign-supabase-v1",
  theme: "kanban-redesign-theme-v1"
};

const STATUSES = ["todo", "progress", "done"];
let tasks = [];
let editingId = null;
let storageMode = localStorage.getItem(STORAGE.mode) || "local";
let supabaseClient = null;
let supabaseConfig = loadSupabaseConfig();

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() :
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

function isOverdue(task) {
  return Boolean(task.due_date) &&
    task.due_date < todayISO() &&
    task.status !== "done";
}

function isSoon(task) {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(`${task.due_date}T23:59:59`);
  const diff = (due - new Date()) / 86400000;
  return diff >= 0 && diff <= 3;
}

function dueLabel(task) {
  if (!task.due_date) return "No due date";
  if (isOverdue(task)) return `Overdue · ${task.due_date}`;
  if (isSoon(task)) return `Due soon · ${task.due_date}`;
  return `Due · ${task.due_date}`;
}

function defaultTasks() {
  return [
    {
      id: uid(),
      title: "Create project",
      description: "Set up the basic project files.",
      status: "todo",
      priority: "medium",
      due_date: "",
      category: "Project",
      color: "blue",
      created_at: new Date().toISOString()
    },
    {
      id: uid(),
      title: "Build interface",
      description: "Create the main board.",
      status: "progress",
      priority: "high",
      due_date: "",
      category: "Project",
      color: "purple",
      created_at: new Date().toISOString()
    }
  ];
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE.tasks);
    tasks = raw ? JSON.parse(raw) : defaultTasks();
  } catch {
    tasks = defaultTasks();
  }
  saveLocal();
}

function saveLocal() {
  localStorage.setItem(STORAGE.tasks, JSON.stringify(tasks));
}

function loadSupabaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.supabase)) || {
      url: "",
      key: "",
      boardId: "",
      accessKey: ""
    };
  } catch {
    return { url: "", key: "", boardId: "", accessKey: "" };
  }
}

function saveSupabaseConfig() {
  localStorage.setItem(STORAGE.supabase, JSON.stringify(supabaseConfig));
}

function setView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  $(`${view}View`).classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function showModal(id) {
  $(id).classList.remove("hidden");
}

function hideModal(id) {
  $(id).classList.add("hidden");
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2200);
}

function filteredTasks() {
  const q = $("searchInput").value.trim().toLowerCase();
  const priority = $("priorityFilter").value;
  const category = $("categoryFilter").value;
  const due = $("dueFilter").value;

  return tasks.filter(task => {
    const haystack = [
      task.title,
      task.description,
      task.category
    ].join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
    if (priority !== "all" && task.priority !== priority) return false;

    const taskCategory = task.category || "Uncategorized";
    if (category !== "all" && taskCategory !== category) return false;

    if (due === "overdue" && !isOverdue(task)) return false;
    if (due === "soon" && !isSoon(task)) return false;
    if (due === "none" && task.due_date) return false;

    return true;
  });
}

function render() {
  const visible = filteredTasks();

  STATUSES.forEach(status => {
    const list = $(status);
    list.innerHTML = "";

    const matching = visible.filter(task => task.status === status);
    matching.forEach(task => list.appendChild(taskCard(task)));

    $(`${status}Count`).textContent =
      tasks.filter(task => task.status === status).length;
  });

  renderStats();
  renderCategories();
  renderUpcoming();
  updateStorageUI();
}

function taskCard(task) {
  const card = document.createElement("article");
  card.className = `task color-${task.color || "blue"}`;
  card.draggable = true;
  card.dataset.id = task.id;

  const priority = task.priority || "medium";
  const dueClass = isOverdue(task) ? "overdue" : isSoon(task) ? "soon" : "";

  card.innerHTML = `
    <div class="task-top">
      <span class="priority priority-${escapeHTML(priority)}">${escapeHTML(priority.toUpperCase())}</span>
      <span class="task-menu-dot">●</span>
    </div>

    <h3>${escapeHTML(task.title)}</h3>

    ${task.description
      ? `<p>${escapeHTML(task.description)}</p>`
      : ""}

    <div class="task-meta">
      <span class="due ${dueClass}">${escapeHTML(dueLabel(task))}</span>
      ${task.category
        ? `<span class="tag">${escapeHTML(task.category)}</span>`
        : ""}
    </div>

    <div class="task-actions">
      <button class="edit">Edit</button>
      <button class="delete">Delete</button>
    </div>
  `;

  card.querySelector(".edit").onclick = () => editTask(task.id);
  card.querySelector(".delete").onclick = () => deleteTask(task.id);

  card.addEventListener("dragstart", event => {
    event.dataTransfer.setData("text/plain", task.id);
  });

  return card;
}

function renderStats() {
  $("greeting").textContent = greeting();
  $("statTotal").textContent = tasks.length;
  $("statProgress").textContent =
    tasks.filter(task => task.status === "progress").length;
  $("statDone").textContent =
    tasks.filter(task => task.status === "done").length;
  $("statOverdue").textContent =
    tasks.filter(isOverdue).length;
}

function renderCategories() {
  const counts = {};

  tasks.forEach(task => {
    const category = task.category || "Uncategorized";
    counts[category] = (counts[category] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  $("categoryList").innerHTML = entries.length
    ? entries.map(([name, count]) => `
        <div class="category-item">
          <span>${escapeHTML(name)}</span>
          <strong>${count}</strong>
        </div>
      `).join("")
    : `<div class="empty">No categories yet.</div>`;

  const current = $("categoryFilter").value;
  $("categoryFilter").innerHTML =
    `<option value="all">All categories</option>` +
    entries.map(([name]) =>
      `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`
    ).join("");

  if ([...$("categoryFilter").options].some(o => o.value === current)) {
    $("categoryFilter").value = current;
  }
}

function renderUpcoming() {
  const upcoming = tasks
    .filter(task => task.status !== "done" && task.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6);

  $("upcomingList").innerHTML = upcoming.length
    ? upcoming.map(task => `
        <div class="upcoming-item">
          <div>
            <strong>${escapeHTML(task.title)}</strong>
            <span>${escapeHTML(task.category || "Uncategorized")}</span>
          </div>
          <time class="${isOverdue(task) ? "overdue" : ""}">
            ${escapeHTML(dueLabel(task))}
          </time>
        </div>
      `).join("")
    : `<div class="empty">No dated tasks coming up.</div>`;
}

function openAddModal() {
  editingId = null;
  $("modalTitle").textContent = "Add Task";
  $("taskTitle").value = "";
  $("taskDescription").value = "";
  $("taskStatus").value = "todo";
  $("taskPriority").value = "medium";
  $("taskDueDate").value = "";
  $("taskCategory").value = "";
  $("taskColor").value = "blue";
  showModal("taskModal");
  $("taskTitle").focus();
}

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  editingId = id;
  $("modalTitle").textContent = "Edit Task";
  $("taskTitle").value = task.title;
  $("taskDescription").value = task.description || "";
  $("taskStatus").value = task.status;
  $("taskPriority").value = task.priority || "medium";
  $("taskDueDate").value = task.due_date || "";
  $("taskCategory").value = task.category || "";
  $("taskColor").value = task.color || "blue";
  showModal("taskModal");
  $("taskTitle").focus();
}

async function saveTask() {
  const title = $("taskTitle").value.trim();

  if (!title) {
    toast("A task title is required.");
    $("taskTitle").focus();
    return;
  }

  const existing = editingId
    ? tasks.find(task => task.id === editingId)
    : null;

  const task = {
    id: existing?.id || uid(),
    title,
    description: $("taskDescription").value.trim(),
    status: $("taskStatus").value,
    priority: $("taskPriority").value,
    due_date: $("taskDueDate").value || "",
    category: $("taskCategory").value.trim(),
    color: $("taskColor").value,
    created_at: existing?.created_at || new Date().toISOString()
  };

  if (existing) {
    Object.assign(existing, task);
  } else {
    tasks.push(task);
  }

  await persistUpsert(task);
  hideModal("taskModal");
  editingId = null;
  render();
  toast(existing ? "Task updated." : "Task added.");
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  tasks = tasks.filter(task => task.id !== id);
  await persistDelete(id);
  render();
  toast("Task deleted.");
}

async function moveTask(id, status) {
  const task = tasks.find(item => item.id === id);
  if (!task || task.status === status) return;

  task.status = status;
  await persistUpsert(task);
  render();
}

function localRow(task) {
  return {
    id: task.id,
    board_id: supabaseConfig.boardId,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority || "medium",
    due_date: task.due_date || null,
    category: task.category || null,
    color: task.color || "blue",
    created_at: task.created_at || new Date().toISOString()
  };
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    priority: row.priority || "medium",
    due_date: row.due_date || "",
    category: row.category || "",
    color: row.color || "blue",
    created_at: row.created_at
  };
}

async function loadSupabaseLibrary() {
  if (window.supabase) return true;

  return new Promise(resolve => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function connectSupabase(config = supabaseConfig) {
  if (!config.url || !config.key || !config.boardId || !config.accessKey) {
    throw new Error("Enter the Supabase URL, key, Board ID, and Board access key.");
  }

  const loaded = await loadSupabaseLibrary();
  if (!loaded) {
    throw new Error("Could not load the Supabase library. Check your internet connection.");
  }

  supabaseClient = window.supabase.createClient(config.url, config.key);

  const { data, error } = await supabaseClient.rpc("kanban_get_tasks", {
    p_board_id: config.boardId,
    p_access_key: config.accessKey
  });

  if (error) throw error;

  tasks = (data || []).map(fromRow);
  supabaseConfig = { ...config };
  saveSupabaseConfig();
  storageMode = "supabase";
  localStorage.setItem(STORAGE.mode, "supabase");
  render();
}

async function createSupabaseBoard() {
  const url = $("supabaseUrl").value.trim();
  const key = $("supabaseKey").value.trim();

  if (!url || !key) {
    setSupabaseStatus("Enter the project URL and key first.", true);
    return;
  }

  try {
    setSupabaseStatus("Creating board...");

    const loaded = await loadSupabaseLibrary();
    if (!loaded) throw new Error("Could not load the Supabase library.");

    const client = window.supabase.createClient(url, key);
    const boardId = uid();
    const accessKey = uid().replaceAll("-", "");

    const { error } = await client.rpc("kanban_create_board", {
      p_board_id: boardId,
      p_access_key: accessKey
    });

    if (error) throw error;

    supabaseConfig = { url, key, boardId, accessKey };
    saveSupabaseConfig();

    $("boardId").value = boardId;
    $("boardAccessKey").value = accessKey;

    setSupabaseStatus(
      "Board created. Save/share the Board ID and access key if another browser needs access."
    );
    toast("Supabase board created.");
  } catch (error) {
    console.error(error);
    setSupabaseStatus(error.message || "Could not create board.", true);
  }
}

async function connectFromSettings() {
  const config = {
    url: $("supabaseUrl").value.trim(),
    key: $("supabaseKey").value.trim(),
    boardId: $("boardId").value.trim(),
    accessKey: $("boardAccessKey").value.trim()
  };

  try {
    setSupabaseStatus("Connecting...");
    await connectSupabase(config);
    setSupabaseStatus("Connected.");
    updateStorageUI();
    toast("Supabase storage connected.");
  } catch (error) {
    console.error(error);
    setSupabaseStatus(error.message || "Connection failed.", true);
  }
}

async function persistUpsert(task) {
  if (storageMode === "local") {
    saveLocal();
    return;
  }

  if (!supabaseClient) {
    saveLocal();
    toast("Supabase is not connected; changes were kept locally.");
    return;
  }

  const { error } = await supabaseClient.rpc("kanban_upsert_task", {
    p_board_id: supabaseConfig.boardId,
    p_access_key: supabaseConfig.accessKey,
    p_task: localRow(task)
  });

  if (error) {
    console.error(error);
    toast("Supabase save failed; change kept locally.");
  }
}

async function persistDelete(id) {
  if (storageMode === "local") {
    saveLocal();
    return;
  }

  if (!supabaseClient) {
    saveLocal();
    return;
  }

  const { error } = await supabaseClient.rpc("kanban_delete_task", {
    p_board_id: supabaseConfig.boardId,
    p_access_key: supabaseConfig.accessKey,
    p_task_id: id
  });

  if (error) {
    console.error(error);
    toast("Supabase delete failed.");
  }
}

function setSupabaseStatus(message, error = false) {
  const el = $("supabaseStatus");
  el.textContent = message;
  el.style.color = error ? "var(--danger)" : "var(--muted)";
}

function populateSupabaseForm() {
  $("supabaseUrl").value = supabaseConfig.url || "";
  $("supabaseKey").value = supabaseConfig.key || "";
  $("boardId").value = supabaseConfig.boardId || "";
  $("boardAccessKey").value = supabaseConfig.accessKey || "";
}

function updateStorageUI() {
  $("storageBadge").textContent = storageMode === "supabase"
    ? "Supabase"
    : "Local";

  $("localModeBtn").classList.toggle("active", storageMode === "local");
  $("supabaseModeBtn").classList.toggle("active", storageMode === "supabase");

  $("supabaseSettings").classList.toggle(
    "hidden",
    storageMode !== "supabase" && !supabaseClient
  );

  if (storageMode === "supabase") {
    $("supabaseSettings").classList.remove("hidden");
  }
}

function switchToLocal() {
  if (storageMode === "supabase") {
    const keep = confirm(
      "Switch to local storage? The current Supabase board will remain there, but this browser will start using its local task list."
    );
    if (!keep) return;
  }

  storageMode = "local";
  localStorage.setItem(STORAGE.mode, "local");
  loadLocal();
  render();
  setSupabaseStatus("");
  toast("Using local storage.");
}

async function switchToSupabase() {
  $("supabaseSettings").classList.remove("hidden");
  populateSupabaseForm();

  if (!supabaseConfig.url || !supabaseConfig.key ||
      !supabaseConfig.boardId || !supabaseConfig.accessKey) {
    setSupabaseStatus("Enter your connection details or create a board.");
    return;
  }

  try {
    setSupabaseStatus("Loading Supabase board...");
    await connectSupabase(supabaseConfig);
    setSupabaseStatus("Connected.");
    toast("Using Supabase storage.");
  } catch (error) {
    console.error(error);
    setSupabaseStatus(error.message || "Could not connect.", true);
  }
}

function toggleTheme() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem(STORAGE.theme, dark ? "dark" : "light");
}

function loadTheme() {
  if (localStorage.getItem(STORAGE.theme) === "dark") {
    document.body.classList.add("dark");
  }
}

function openSettings() {
  populateSupabaseForm();
  updateStorageUI();
  showModal("settingsModal");
}

function setupEvents() {
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $("dashboardAddBtn").onclick = openAddModal;
  $("boardAddBtn").onclick = openAddModal;
  $("saveTaskBtn").onclick = saveTask;

  $("themeBtn").onclick = toggleTheme;
  $("settingsThemeBtn").onclick = toggleTheme;
  $("settingsBtn").onclick = openSettings;

  $("localModeBtn").onclick = switchToLocal;
  $("supabaseModeBtn").onclick = switchToSupabase;
  $("createBoardBtn").onclick = createSupabaseBoard;
  $("connectSupabaseBtn").onclick = connectFromSettings;

  document.querySelectorAll("[data-close]").forEach(button => {
    button.onclick = () => hideModal(button.dataset.close);
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) hideModal(modal.id);
    });
  });

  ["searchInput", "priorityFilter", "categoryFilter", "dueFilter"]
    .forEach(id => $(id).addEventListener("input", render));

  $("clearFilters").onclick = () => {
    $("searchInput").value = "";
    $("priorityFilter").value = "all";
    $("categoryFilter").value = "all";
    $("dueFilter").value = "all";
    render();
  };

  document.querySelectorAll(".column").forEach(column => {
    column.addEventListener("dragover", event => {
      event.preventDefault();
      column.classList.add("drag-over");
    });

    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });

    column.addEventListener("drop", async event => {
      event.preventDefault();
      column.classList.remove("drag-over");

      const id = event.dataTransfer.getData("text/plain");
      await moveTask(id, column.dataset.status);
    });
  });
}

async function boot() {
  loadTheme();
  setupEvents();

  if (storageMode === "supabase") {
    try {
      if (supabaseConfig.url && supabaseConfig.key &&
          supabaseConfig.boardId && supabaseConfig.accessKey) {
        await connectSupabase(supabaseConfig);
      } else {
        storageMode = "local";
        loadLocal();
      }
    } catch (error) {
      console.error(error);
      storageMode = "local";
      localStorage.setItem(STORAGE.mode, "local");
      loadLocal();
      toast("Supabase unavailable; using local storage.");
    }
  } else {
    loadLocal();
  }

  render();
  setView("dashboard");
}

boot();
