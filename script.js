/* ==========================================
   NEXORA AI — INTERACTIVE DASHBOARD
   ========================================== */

document.addEventListener("DOMContentLoaded", initializeDashboard);

async function initializeDashboard() {
  const $ = (selector) => document.querySelector(selector);

  const projectList = $("#projectList");
  const taskList = $("#taskList");
  const analyticsChart = $("#analyticsChart");
  const chatMessages = $("#chatMessages");
  const toastElement = $("#toast");
  const projectModal = $("#projectModal");

  let projects = [];
  let tasks = [];
  let analytics = [];
  let nextProjectId = 1;
  let timerSeconds = 25 * 60;
  let timerInterval = null;
  let toastTimeout = null;

  // Safely display user-provided text.
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  // Display temporary notifications.
  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toastElement.classList.remove("show");
    }, 2600);
  }

  // Record dashboard activity.
  function addActivity(title, description) {
    const feed = $("#activityFeed");
    const item = document.createElement("div");

    item.className = "activity-item";

    const dot = document.createElement("span");
    dot.className = "activity-dot";

    const content = document.createElement("div");
    const heading = document.createElement("strong");
    const detail = document.createElement("small");

    heading.textContent = title;
    detail.textContent = description;

    content.append(heading, detail);
    item.append(dot, content);
    feed.prepend(item);

    while (feed.children.length > 8) {
      feed.lastElementChild.remove();
    }
  }

  // Load dashboard information from data.json.
  try {
    const response = await fetch("data.json");

    if (!response.ok) {
      throw new Error("Could not load data.json");
    }

    const data = await response.json();

    projects = Array.isArray(data.projects) ? data.projects : [];
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    analytics = Array.isArray(data.analytics) ? data.analytics : [];

    timerSeconds = Math.max(
      1,
      Number(data.dashboard?.focusMinutes) || 25
    ) * 60;

    const savedProjects = localStorage.getItem("nexoraProjects");
    const savedTasks = localStorage.getItem("nexoraTasks");

    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed)) projects = parsed;
      } catch {
        localStorage.removeItem("nexoraProjects");
      }
    }

    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);

        if (Array.isArray(parsed)) {
          tasks = tasks.map((task) => {
            const saved = parsed.find((item) => item.id === task.id);
            return saved
              ? { ...task, completed: Boolean(saved.completed) }
              : task;
          });
        }
      } catch {
        localStorage.removeItem("nexoraTasks");
      }
    }

    nextProjectId = Math.max(
      0,
      ...projects.map((project) => Number(project.id) || 0)
    ) + 1;

    renderProjects();
    renderTasks();
    renderAnalytics();
    updateStatistics();
    updateTimerDisplay();

    showToast("NEXORA workspace is ready!");

  } catch (error) {
    console.error(error);
    showToast("Could not load data.json. Check your files and Live Server.");
  }

  // Render project cards.
  function renderProjects() {
    projectList.innerHTML = "";

    if (projects.length === 0) {
      projectList.textContent = "No projects yet. Create your first project!";
      return;
    }

    projects.forEach((project, index) => {
      const progress = Math.min(
        100,
        Math.max(0, Number(project.progress) || 0)
      );

      const card = document.createElement("article");
      card.className = "project-card";
      card.dataset.search = `${project.name} ${project.category} ${project.status}`.toLowerCase();

      const icons = ["✧", "◈", "▦", "✦", "⌘", "◎"];
      const status = progress === 100 ? "Completed" : project.status;

      card.innerHTML = `
        <div class="project-top">
          <span class="project-icon">${icons[index % icons.length]}</span>
          <span class="project-status">${escapeHTML(status)}</span>
        </div>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.category)}</p>
        <div class="project-meta">
          <span>Project progress</span>
          <strong>${progress}%</strong>
        </div>
        <div class="project-progress"
             role="progressbar"
             aria-valuenow="${progress}"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-label="${escapeHTML(project.name)} progress">
          <div style="width: ${progress}%"></div>
        </div>
      `;

      projectList.appendChild(card);
    });
  }

  // Render interactive task checkboxes.
  function renderTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
      taskList.textContent = "No tasks available.";
      return;
    }

    tasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = `task-row ${task.completed ? "completed" : ""}`;
      row.dataset.search = task.title.toLowerCase();

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = Boolean(task.completed);
      checkbox.setAttribute("aria-label", `Complete ${task.title}`);

      const copy = document.createElement("div");
      copy.className = "task-copy";

      const title = document.createElement("span");
      title.textContent = task.title;

      const status = document.createElement("small");
      status.textContent = task.completed ? "Completed" : "In progress";

      copy.append(title, status);
      row.append(checkbox, copy);
      taskList.appendChild(row);

      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        row.classList.toggle("completed", task.completed);
        status.textContent = task.completed ? "Completed" : "In progress";

        saveTasks();
        updateStatistics();

        addActivity(
          task.completed ? "Task completed" : "Task reopened",
          task.title
        );

        showToast(task.completed ? "Great work! Task completed." : "Task reopened.");
      });
    });
  }

  function saveTasks() {
    localStorage.setItem("nexoraTasks", JSON.stringify(tasks));
  }

  function saveProjects() {
    localStorage.setItem("nexoraProjects", JSON.stringify(projects));
  }

  // Update statistics and task progress.
  function updateStatistics() {
    const activeCount = projects.filter(
      (project) => project.status !== "Completed" &&
                   Number(project.progress) < 100
    ).length;

    const completedCount = tasks.filter((task) => task.completed).length;

    $("#activeProjects").textContent = activeCount;
    $("#totalTasks").textContent = tasks.length;
    $("#completedTasks").textContent = completedCount;

    const percentage = tasks.length
      ? Math.round((completedCount / tasks.length) * 100)
      : 0;

    $("#taskProgress").textContent =
      `${completedCount} of ${tasks.length} completed`;

    $("#productivity").textContent = `${percentage}%`;
  }

  // Render weekly productivity bars.
  function renderAnalytics() {
    analyticsChart.innerHTML = "";

    analytics.forEach((day) => {
      const value = Math.min(
        100,
        Math.max(0, Number(day.productivity) || 0)
      );

      const column = document.createElement("div");
      column.className = "chart-column";

      column.innerHTML = `
        <span class="chart-value">${value}%</span>
        <div class="chart-bar-track">
          <div class="chart-bar" style="height: ${value}%"></div>
        </div>
        <span class="chart-label">${escapeHTML(day.label)}</span>
      `;

      analyticsChart.appendChild(column);
    });
  }

  // Search projects and tasks.
  $(".global-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    document.querySelectorAll(".project-card").forEach((card) => {
      card.hidden = !card.dataset.search.includes(query);
    });

    document.querySelectorAll(".task-row").forEach((row) => {
      row.hidden = !row.dataset.search.includes(query);
    });
  });

  // Toggle dark and light themes.
  const themeToggle = $("#themeToggle");

  if (localStorage.getItem("nexoraTheme") === "light") {
    document.body.classList.add("light-mode");
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    const theme = document.body.classList.contains("light-mode")
      ? "light"
      : "dark";

    localStorage.setItem("nexoraTheme", theme);
    showToast(`${theme === "light" ? "Light" : "Dark"} theme enabled.`);
  });

  // Toggle fullscreen.
  $("#fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showToast("Fullscreen is unavailable in this browser.");
    }
  });

  // Focus timer.
  function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;

    $("#timerDisplay").textContent =
      `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  $("#startTimer").addEventListener("click", () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      $("#startTimer").textContent = "Resume";
      showToast("Focus timer paused.");
      return;
    }

    if (timerSeconds <= 0) {
      timerSeconds = 25 * 60;
    }

    $("#startTimer").textContent = "Pause";
    showToast("Focus session started. You've got this!");

    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        $("#startTimer").textContent = "Start";
        showToast("Focus session complete. Take a short break!");
        addActivity("Focus session completed", "You finished a focus session.");
      }
    }, 1000);
  });

  $("#resetTimer").addEventListener("click", () => {
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 25 * 60;
    updateTimerDisplay();
    $("#startTimer").textContent = "Start";
    showToast("Focus timer reset to 25 minutes.");
  });

  // Project creation modal.
  function closeProjectModal() {
    projectModal.hidden = true;
  }

  $("#newProjectBtn").addEventListener("click", () => {
    projectModal.hidden = false;
    $("#projectName").focus();
  });

  $("#closeModal").addEventListener("click", closeProjectModal);
  $("#cancelProject").addEventListener("click", closeProjectModal);

  projectModal.addEventListener("click", (event) => {
    if (event.target === projectModal) {
      closeProjectModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !projectModal.hidden) {
      closeProjectModal();
    }
  });

  $("#projectForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("#projectName").value.trim();
    const category = $("#projectCategory").value.trim();

    if (!name || !category) {
      showToast("Please fill in both project fields.");
      return;
    }

    projects.push({
      id: nextProjectId++,
      name,
      category,
      progress: 0,
      status: "Planning"
    });

    saveProjects();
    renderProjects();
    updateStatistics();

    addActivity("New project created", name);
    showToast("Your new project has been created!");

    $("#projectForm").reset();
    closeProjectModal();
  });

  // Local demo assistant — not connected to a live AI model.
  function addChatMessage(message, isUser = false) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${isUser ? "user-message" : ""}`;
    bubble.textContent = message;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function getAssistantReply(message) {
    const text = message.toLowerCase();

    if (text.includes("plan") || text.includes("day")) {
      const pending = tasks.filter((task) => !task.completed);

      return `Here's a simple plan for your day:\n\n1. Choose your most important task.\n2. Work in a 25-minute focus session.\n3. Take a 5-minute break.\n4. Review your progress.\n\nYou have ${pending.length} unfinished task(s) in your workspace.`;
    }

    if (text.includes("productivity") || text.includes("tips")) {
      return "Try these productivity habits:\n\n• Pick three priorities for today.\n• Silence unnecessary notifications.\n• Break large projects into small tasks.\n• Take regular short breaks.\n• Celebrate your progress.";
    }

    if (text.includes("focus") || text.includes("concentrat")) {
      return "To improve focus, choose one task, close distractions, and start the Focus Room timer. Work for 25 minutes, then take a short break. Small consistent sessions can help build concentration.";
    }

    if (text.includes("project")) {
      return `You currently have ${projects.length} project(s), including ${projects.filter((project) => Number(project.progress) < 100).length} project(s) still in progress. Use + New Project to add another project.`;
    }

    if (text.includes("task")) {
      return `You've completed ${tasks.filter((task) => task.completed).length} out of ${tasks.length} tasks. Check off each task as you finish it to update your dashboard.`;
    }

    if (text.includes("hello") || text.includes("hi")) {
      return "Hello, Innovator! ✨ What would you like to accomplish today?";
    }

    return "Let's turn that idea into action! Try breaking it into smaller tasks, choosing your next priority, and using the Focus Room to get started. You can also ask me for planning or productivity tips.";
  }

  function sendChatMessage(message) {
    const cleaned = message.trim();

    if (!cleaned) return;

    addChatMessage(cleaned, true);

    const reply = getAssistantReply(cleaned);
    addChatMessage(reply);
  }

  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#chatInput");
    const message = input.value;

    input.value = "";
    sendChatMessage(message);
    input.focus();
  });

  document.querySelectorAll(".suggestion-chip").forEach((button) => {
    button.addEventListener("click", () => {
      sendChatMessage(button.dataset.prompt || button.textContent);
    });
  });

  // Highlight the navigation section currently in view.
  const navItems = document.querySelectorAll(".nav-item");

  const sections = [...navItems]
    .map((item) => document.querySelector(item.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        navItems.forEach((item) => {
          item.classList.toggle(
            "active",
            item.getAttribute("href") === `#${entry.target.id}`
          );
        });
      });
    }, { rootMargin: "-20% 0px -65% 0px" });

    sections.forEach((section) => observer.observe(section));
  }
}