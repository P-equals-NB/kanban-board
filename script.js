const STORAGE_KEY = "simple-kanban-tasks";

let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
  { id: crypto.randomUUID(), title: "Create project", description: "Set up the basic project files.", status: "todo" },
  { id: crypto.randomUUID(), title: "Build interface", description: "Create the main board.", status: "progress" }
];

let editingId = null;
let supabaseClient = null;

const taskModal = document.getElementById("taskModal");
const supabaseModal = document.getElementById("supabaseModal");

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function render() {
  ["todo", "progress", "done"].forEach(status => {
    const list = document.getElementById(status);
    list.innerHTML = "";

    tasks.filter(task => task.status === status).forEach(task => {
      const card = document.createElement("article");
      card.className = "task";
      card.draggable = true;
      card.dataset.id = task.id;

      card.innerHTML = `
        <h3>${escapeHTML(task.title)}</h3>
        ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
        <div class="task-actions">
          <button class="edit" onclick="editTask('${task.id}')">Edit</button>
          <button class="delete" onclick="deleteTask('${task.id}')">Delete</button>
        </div>
      `;

      card.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", task.id);
      });

      list.appendChild(card);
    });

    document.querySelector(`[data-status="${status}"] .count`).textContent =
      tasks.filter(t => t.status === status).length;
  });
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Add Task";
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDescription").value = "";
  document.getElementById("taskStatus").value = "todo";
  taskModal.classList.remove("hidden");
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit Task";
  document.getElementById("taskTitle").value = task.title;
  document.getElementById("taskDescription").value = task.description || "";
  document.getElementById("taskStatus").value = task.status;
  taskModal.classList.remove("hidden");
}

function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter(task => task.id !== id);
  saveLocal();
  render();
  syncToSupabase();
}

document.getElementById("addTaskBtn").onclick = openAddModal;

document.getElementById("cancelBtn").onclick = () => {
  taskModal.classList.add("hidden");
};

document.getElementById("saveTaskBtn").onclick = () => {
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const status = document.getElementById("taskStatus").value;

  if (!title) {
    alert("Please enter a task title.");
    return;
  }

  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    task.title = title;
    task.description = description;
    task.status = status;
  } else {
    tasks.push({
      id: crypto.randomUUID(),
      title,
      description,
      status
    });
  }

  saveLocal();
  render();
  syncToSupabase();
  taskModal.classList.add("hidden");
};

document.querySelectorAll(".column").forEach(column => {
  column.addEventListener("dragover", e => {
    e.preventDefault();
    column.classList.add("drag-over");
  });

  column.addEventListener("dragleave", () => {
    column.classList.remove("drag-over");
  });

  column.addEventListener("drop", e => {
    e.preventDefault();
    column.classList.remove("drag-over");

    const id = e.dataTransfer.getData("text/plain");
    const task = tasks.find(t => t.id === id);

    if (task) {
      task.status = column.dataset.status;
      saveLocal();
      render();
      syncToSupabase();
    }
  });
});

document.getElementById("supabaseBtn").onclick = () => {
  supabaseModal.classList.remove("hidden");
};

document.getElementById("closeSupabaseBtn").onclick = () => {
  supabaseModal.classList.add("hidden");
};

document.getElementById("connectBtn").onclick = async () => {
  const url = document.getElementById("supabaseUrl").value.trim();
  const key = document.getElementById("supabaseKey").value.trim();
  const status = document.getElementById("connectionStatus");

  if (!url || !key) {
    status.textContent = "Enter both the project URL and anon key.";
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(url, key);
    const { error } = await supabaseClient.from("tasks").select("id").limit(1);

    if (error) throw error;

    status.textContent = "Connected to Supabase.";
    await loadFromSupabase();
  } catch (error) {
    supabaseClient = null;
    status.textContent = "Connection failed: " + error.message;
  }
};

async function loadFromSupabase() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  tasks = data.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status
  }));

  saveLocal();
  render();
}

async function syncToSupabase() {
  if (!supabaseClient) return;

  const { error: deleteError } = await supabaseClient
    .from("tasks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error(deleteError);
    return;
  }

  if (tasks.length) {
    const { error } = await supabaseClient.from("tasks").insert(
      tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status
      }))
    );

    if (error) console.error(error);
  }
}

render();
