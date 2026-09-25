/* Kanban Task Management - upgraded static app with optional Supabase Auth */
const CONFIG = window.KANBAN_CONFIG || { url: "", key: "" };
const STORAGE = { tasks: "kanban-tasks-v2", profile: "kanban-profile-v2", theme: "kanban-theme-v2", mode: "kanban-mode-v2" };
const STATUSES = ["todo", "progress", "done"];
let tasks = [];
let editingId = null;
let authMode = "login";
let supabaseClient = null;
let currentUser = null;
let localMode = false;

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function localTasksKey() { return `${STORAGE.tasks}-${currentUser?.id || "demo"}`; }
function saveLocal() { localStorage.setItem(localTasksKey(), JSON.stringify(tasks)); }
function loadLocal() {
  const saved = localStorage.getItem(localTasksKey());
  tasks = saved ? JSON.parse(saved) : [
    { id: uid(), title: "Create project", description: "Set up the upgraded task manager.", status: "todo", priority: "medium", due_date: "", category: "Project", color: "blue", created_at: new Date().toISOString() },
    { id: uid(), title: "Build interface", description: "Create the dashboard and Kanban board.", status: "progress", priority: "high", due_date: "", category: "Project", color: "purple", created_at: new Date().toISOString() }
  ];
  saveLocal();
}

function setAuthMessage(message, error = false) { $("authMessage").textContent = message || ""; $("authMessage").className = `form-message ${error ? "error" : ""}`; }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(`${view}View`).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  closeProfile();
}
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning!" : h < 18 ? "Good afternoon!" : "Good evening!"; }
function profile() {
  const metadata = currentUser?.user_metadata || {};
  const saved = JSON.parse(localStorage.getItem(`${STORAGE.profile}-${currentUser?.id || "demo"}`) || "{}") || {};
  return { name: saved.name || metadata.full_name || metadata.name || currentUser?.email?.split("@")[0] || "Local User", email: currentUser?.email || "Local demo mode" };
}
function updateProfileUI() {
  const p = profile(); const initial = p.name.trim().charAt(0).toUpperCase() || "U";
  $("profileInitial").textContent = initial; $("profileName").textContent = p.name; $("menuProfileName").textContent = p.name; $("menuProfileEmail").textContent = p.email;
  $("settingsName").value = p.name; $("storageInfo").textContent = localMode ? "Local browser storage (demo mode)" : "Supabase account storage";
}
function closeProfile() { hide("profileMenu"); }

function isOverdue(task) { return !!task.due_date && task.due_date < todayISO() && task.status !== "done"; }
function isSoon(task) {
  if (!task.due_date || task.status === "done") return false;
  const d = new Date(`${task.due_date}T23:59:59`); const diff = (d - new Date()) / 86400000;
  return diff >= 0 && diff <= 3;
}
function dueLabel(task) {
  if (!task.due_date) return "No due date";
  if (isOverdue(task)) return `Overdue · ${task.due_date}`;
  if (isSoon(task)) return `Due soon · ${task.due_date}`;
  return `Due · ${task.due_date}`;
}
function filteredTasks() {
  const q = $("searchInput").value.trim().toLowerCase(); const priority = $("priorityFilter").value; const category = $("categoryFilter").value; const due = $("dueFilter").value;
  return tasks.filter(t => {
    const hay = `${t.title} ${t.description || ""} ${t.category || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (priority !== "all" && t.priority !== priority) return false;
    if (category !== "all" && (t.category || "Uncategorized") !== category) return false;
    if (due === "overdue" && !isOverdue(t)) return false;
    if (due === "soon" && !isSoon(t)) return false;
    if (due === "none" && t.due_date) return false;
    return true;
  });
}

function render() {
  const visible = filteredTasks();
  STATUSES.forEach(status => {
    const list = $(status); list.innerHTML = "";
    visible.filter(t => t.status === status).forEach(task => list.appendChild(taskCard(task)));
    $(`${status}Count`).textContent = tasks.filter(t => t.status === status).length;
  });
  renderStats(); renderCategories(); renderUpcoming();
}
function taskCard(task) {
  const card = document.createElement("article"); card.className = `task color-${task.color || "blue"}`; card.draggable = true; card.dataset.id = task.id;
  const overdueClass = isOverdue(task) ? "overdue" : isSoon(task) ? "soon" : "";
  card.innerHTML = `<div class="task-top"><span class="priority priority-${escapeHTML(task.priority || "medium")}">${escapeHTML((task.priority || "medium").toUpperCase())}</span><span class="task-menu-dot">●</span></div>
    <h3>${escapeHTML(task.title)}</h3>${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
    <div class="task-meta"><span class="due ${overdueClass}">${escapeHTML(dueLabel(task))}</span>${task.category ? `<span class="tag">${escapeHTML(task.category)}</span>` : ""}</div>
    <div class="task-actions"><button class="edit">Edit</button><button class="delete">Delete</button></div>`;
  card.querySelector(".edit").onclick = () => editTask(task.id); card.querySelector(".delete").onclick = () => deleteTask(task.id);
  card.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", task.id));
  return card;
}
function renderStats() {
  $("statTotal").textContent = tasks.length; $("statProgress").textContent = tasks.filter(t => t.status === "progress").length; $("statDone").textContent = tasks.filter(t => t.status === "done").length; $("statOverdue").textContent = tasks.filter(isOverdue).length; $("greeting").textContent = greeting();
}
function renderCategories() {
  const counts = {}; tasks.forEach(t => { const c = t.category || "Uncategorized"; counts[c] = (counts[c] || 0) + 1; });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]); $("categoryList").innerHTML = entries.length ? entries.map(([name,count]) => `<div class="category-item"><span>${escapeHTML(name)}</span><strong>${count}</strong></div>`).join("") : `<div class="empty">No categories yet.</div>`;
  const current = $("categoryFilter").value; $("categoryFilter").innerHTML = `<option value="all">All categories</option>` + entries.map(([name]) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join(""); if ([...$("categoryFilter").options].some(o => o.value === current)) $("categoryFilter").value = current;
}
function renderUpcoming() {
  const upcoming = tasks.filter(t => t.status !== "done" && t.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
  $("upcomingList").innerHTML = upcoming.length ? upcoming.map(t => `<div class="upcoming-item"><div><strong>${escapeHTML(t.title)}</strong><span>${escapeHTML(t.category || "Uncategorized")}</span></div><time class="${isOverdue(t) ? "overdue" : ""}">${escapeHTML(dueLabel(t))}</time></div>`).join("") : `<div class="empty">No dated tasks coming up.</div>`;
}

function openAddModal() { editingId = null; $("modalTitle").textContent = "Add Task"; ["taskTitle","taskDescription","taskDueDate","taskCategory"].forEach(id => $(id).value = ""); $("taskStatus").value = "todo"; $("taskPriority").value = "medium"; $("taskColor").value = "blue"; show("taskModal"); $("taskTitle").focus(); }
function editTask(id) { const t = tasks.find(x => x.id === id); if (!t) return; editingId = id; $("modalTitle").textContent = "Edit Task"; $("taskTitle").value = t.title; $("taskDescription").value = t.description || ""; $("taskStatus").value = t.status; $("taskPriority").value = t.priority || "medium"; $("taskDueDate").value = t.due_date || ""; $("taskCategory").value = t.category || ""; $("taskColor").value = t.color || "blue"; show("taskModal"); }
async function deleteTask(id) { if (!confirm("Delete this task?")) return; tasks = tasks.filter(t => t.id !== id); saveLocal(); render(); await syncTaskDelete(id); }
async function saveTask() {
  const title = $("taskTitle").value.trim(); if (!title) { alert("Please enter a task title."); return; }
  const payload = { title, description: $("taskDescription").value.trim(), status: $("taskStatus").value, priority: $("taskPriority").value, due_date: $("taskDueDate").value || null, category: $("taskCategory").value.trim() || null, color: $("taskColor").value, created_at: new Date().toISOString() };
  if (editingId) { const t = tasks.find(x => x.id === editingId); Object.assign(t, payload, { created_at: t.created_at || payload.created_at }); } else tasks.push({ id: uid(), ...payload });
  saveLocal(); render(); hide("taskModal"); await syncTaskUpsert(tasks.find(t => t.id === (editingId || tasks.at(-1).id))); editingId = null;
}

async function syncTaskUpsert(task) {
  if (!supabaseClient || localMode || !currentUser) return;
  const row = { id: task.id, user_id: currentUser.id, title: task.title, description: task.description || null, status: task.status, color: task.color || "blue", priority: task.priority || "medium", category: task.category || null, due_date: task.due_date || null, created_at: task.created_at || new Date().toISOString() };
  const { error } = await supabaseClient.from("tasks").upsert(row); if (error) console.error(error);
}
async function syncTaskDelete(id) { if (!supabaseClient || localMode || !currentUser) return; const { error } = await supabaseClient.from("tasks").delete().eq("id", id).eq("user_id", currentUser.id); if (error) console.error(error); }
async function loadFromSupabase() {
  if (!supabaseClient || localMode || !currentUser) return;
  const { data, error } = await supabaseClient.from("tasks").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: true });
  if (error) { console.error(error); setAuthMessage(error.message, true); return; }
  tasks = (data || []).map(row => ({ id: row.id, title: row.title, description: row.description || "", status: row.status, color: row.color || "blue", priority: row.priority || "medium", category: row.category || "", due_date: row.due_date || "", created_at: row.created_at })); saveLocal(); render();
}
async function initSupabase() {
  if (!CONFIG.url || !CONFIG.key || !window.supabase) return false;
  try { supabaseClient = window.supabase.createClient(CONFIG.url, CONFIG.key); const { data } = await supabaseClient.auth.getSession(); if (data.session) await enterApp(data.session.user, false); supabaseClient.auth.onAuthStateChange((_event, session) => { if (session) enterApp(session.user, false); else showAuth(); }); return true; } catch (e) { console.error(e); return false; }
}

async function submitAuth(e) {
  e.preventDefault(); setAuthMessage("Working…"); const email = $("authEmail").value.trim(); const password = $("authPassword").value; const name = $("authName").value.trim();
  if (!supabaseClient) { setAuthMessage("Supabase is not configured. Use local demo mode below.", true); return; }
  if (authMode === "signup") {
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return setAuthMessage(error.message, true);
    if (data.session) await enterApp(data.user); else setAuthMessage("Account created. Check your email if confirmation is enabled.");
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) return setAuthMessage(error.message, true); await enterApp(data.user);
  }
}
async function enterApp(user, local = false) { currentUser = user; localMode = local; localStorage.setItem(STORAGE.mode, local ? "local" : "supabase"); hide("authScreen"); show("appScreen"); updateProfileUI(); if (local) loadLocal(); else await loadFromSupabase(); render(); setView("dashboard"); }
function showAuth() { currentUser = null; localMode = false; hide("appScreen"); show("authScreen"); }
async function logout() { if (supabaseClient && !localMode) await supabaseClient.auth.signOut(); currentUser = null; localMode = false; showAuth(); }

function toggleTheme() { const dark = document.body.classList.toggle("dark"); localStorage.setItem(STORAGE.theme, dark ? "dark" : "light"); }
function loadTheme() { if (localStorage.getItem(STORAGE.theme) === "dark") document.body.classList.add("dark"); }
function openSettings() { updateProfileUI(); show("settingsModal"); closeProfile(); }
async function saveSettings() { const name = $("settingsName").value.trim() || profile().name; localStorage.setItem(`${STORAGE.profile}-${currentUser?.id || "demo"}`, JSON.stringify({ name })); if (supabaseClient && !localMode && currentUser) await supabaseClient.auth.updateUser({ data: { full_name: name } }); updateProfileUI(); hide("settingsModal"); }

function setupEvents() {
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => setView(b.dataset.view));
  $("dashboardAddBtn").onclick = openAddModal; $("boardAddBtn").onclick = openAddModal; $("saveTaskBtn").onclick = saveTask; $("themeBtn").onclick = toggleTheme; $("settingsThemeBtn").onclick = toggleTheme; $("settingsBtn").onclick = openSettings; $("saveSettingsBtn").onclick = saveSettings; $("logoutBtn").onclick = logout;
  $("profileBtn").onclick = () => $("profileMenu").classList.toggle("hidden"); document.addEventListener("click", e => { if (!e.target.closest(".profile-wrap")) closeProfile(); });
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => hide(b.dataset.close));
  ["searchInput","priorityFilter","categoryFilter","dueFilter"].forEach(id => $(id).addEventListener("input", render)); $("clearFilters").onclick = () => { $("searchInput").value = ""; $("priorityFilter").value = "all"; $("categoryFilter").value = "all"; $("dueFilter").value = "all"; render(); };
  document.querySelectorAll(".column").forEach(column => { column.addEventListener("dragover", e => { e.preventDefault(); column.classList.add("drag-over"); }); column.addEventListener("dragleave", () => column.classList.remove("drag-over")); column.addEventListener("drop", async e => { e.preventDefault(); column.classList.remove("drag-over"); const id = e.dataTransfer.getData("text/plain"); const t = tasks.find(x => x.id === id); if (t) { t.status = column.dataset.status; saveLocal(); render(); await syncTaskUpsert(t); } }); });
  document.querySelectorAll(".auth-tab").forEach(tab => tab.onclick = () => { authMode = tab.dataset.authMode; document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t === tab)); $("nameField").classList.toggle("hidden", authMode !== "signup"); $("authSubmit").textContent = authMode === "signup" ? "Create account" : "Login"; setAuthMessage(""); });
  $("authForm").onsubmit = submitAuth; $("demoBtn").onclick = () => { currentUser = { id: "local-demo", email: "local@demo" }; enterApp(currentUser, true); };
}

(async function boot() { loadTheme(); setupEvents(); const configured = await initSupabase(); if (!configured) { $("authLocalNotice").textContent = "Supabase is not configured yet. You can still use the full app in local demo mode."; show("authLocalNotice"); } })();
