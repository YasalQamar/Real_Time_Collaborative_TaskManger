// ===== Theme Toggle =====
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark-mode';
  document.body.className = savedTheme;
  const isDark = savedTheme === 'dark-mode';
  document.getElementById('themeToggle').innerHTML = isDark ? '<i class="bi bi-moon-stars-fill"></i>' : '<i class="bi bi-sun-fill"></i>';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  const newTheme = isDark ? 'light-mode' : 'dark-mode';
  document.body.className = newTheme;
  localStorage.setItem('theme', newTheme);
  document.getElementById('themeToggle').innerHTML = newTheme === 'dark-mode' ? '<i class="bi bi-moon-stars-fill"></i>' : '<i class="bi bi-sun-fill"></i>';
  showToast(`Switched to ${newTheme.replace('-mode', ' mode')}!`);
  if (currentUser) loadTasks(); // Refresh UI if needed
});

// Initialize theme on load
initTheme();

// ===== Toast Message =====
function showToast(message, type = "success") {
  const toastEl = document.getElementById("liveToast");
  const toastMsg = document.getElementById("toastMsg");

  toastMsg.textContent = message;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;

  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

// ===== Authentication System =====
let currentUser = localStorage.getItem('currentUser') || null;
const users = JSON.parse(localStorage.getItem('users')) || {};
let currentView = 'kanban'; // 'kanban' or 'list'

function showSection(id) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('registerSection').style.display = 'none';
  document.getElementById('taskSection').style.display = 'none';
  document.getElementById(id).style.display = 'block';
}

// On load
if (currentUser) {
  showSection('taskSection');
  document.getElementById('welcomeUser').textContent = `${currentUser}'s Task Dashboard`;
  loadTasks();
  updateAssigneeFilter();
} else {
  showSection('authSection');
}

// Switch forms
document.getElementById('showRegister').onclick = () => showSection('registerSection');
document.getElementById('showLogin').onclick = () => showSection('authSection');

// ===== Register =====
document.getElementById('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;

  if (users[username]) {
    alert('Username already exists!');
    return;
  }

  users[username] = { 
    password, 
    tasks: [],
    activity: []
  };
  localStorage.setItem('users', JSON.stringify(users));
  showToast('Registration successful! Please login.', 'info');
  showSection('authSection');
});

// ===== Login =====
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!users[username] || users[username].password !== password) {
    alert('Invalid credentials!');
    return;
  }

  localStorage.setItem('currentUser', username);
  currentUser = username;
  showSection('taskSection');
  document.getElementById('welcomeUser').textContent = `${currentUser}'s Task Dashboard`;
  loadTasks();
  updateAssigneeFilter();
  logActivity(`${username} logged in`);
});

// ===== Logout =====
document.getElementById('logoutBtn').addEventListener('click', () => {
  logActivity(`${currentUser} logged out`);
  localStorage.removeItem('currentUser');
  currentUser = null;
  showSection('authSection');
});

// ===== View Toggle =====
document.getElementById('viewToggle').addEventListener('click', () => {
  if (currentView === 'kanban') {
    document.getElementById('kanbanView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';
    document.getElementById('viewToggle').textContent = 'Switch to Kanban View';
    currentView = 'list';
  } else {
    document.getElementById('kanbanView').style.display = 'block';
    document.getElementById('listView').style.display = 'none';
    document.getElementById('viewToggle').textContent = 'Switch to List View';
    currentView = 'kanban';
  }
  loadTasks();
});

// ===== Task System =====
function loadTasks() {
  const userData = JSON.parse(localStorage.getItem('users')) || {};
  const allTasks = Object.values(userData).flatMap(u => u.tasks || []);
  
  // Apply filters (collaborative: show own + assigned tasks)
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const priorityFilter = document.getElementById('priorityFilter').value;
  const assigneeFilter = document.getElementById('assigneeFilter').value;
  const dueDateFilter = document.getElementById('dueDateFilter').value;
  
  let filteredTasks = allTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm) || 
                         task.desc.toLowerCase().includes(searchTerm);
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;
    const matchesAssignee = !assigneeFilter || task.assignee === assigneeFilter;
    const matchesDueDate = !dueDateFilter || task.date === dueDateFilter;
    const isRelevant = task.createdBy === currentUser || task.assignee === currentUser;
    
    return matchesSearch && matchesPriority && matchesAssignee && matchesDueDate && isRelevant;
  });
  
  if (currentView === 'kanban') {
    displayKanbanTasks(filteredTasks);
  } else {
    displayListTasks(filteredTasks);
  }
  
  loadActivityFeed();
  updateStatistics(); // Add this to update stats
}

function saveUserData() {
  localStorage.setItem('users', JSON.stringify(users));
}

document.getElementById('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const taskId = document.getElementById('taskId').value;
  const newTask = {
    id: taskId || Date.now().toString(),
    title: document.getElementById('taskTitle').value,
    desc: document.getElementById('taskDesc').value,
    priority: document.getElementById('taskPriority').value,
    date: document.getElementById('taskDate').value,
    assignee: document.getElementById('taskAssignee').value,
    category: document.getElementById('taskCategory').value,
    status: taskId ? getTaskById(taskId).status : 'todo',
    comments: taskId ? getTaskById(taskId).comments : [],
    createdBy: currentUser,
    createdAt: taskId ? getTaskById(taskId).createdAt : new Date().toISOString()
  };

  let updated = false;
  
  // Find and update/create task across all users
  Object.keys(users).forEach(username => {
    if (users[username].tasks) {
      const index = users[username].tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        users[username].tasks[index] = newTask;
        updated = true;
      } else if (!taskId) {
        users[username].tasks.push(newTask);
        updated = true;
      }
    }
  });
  
  if (!updated && !taskId) {
    if (!users[currentUser].tasks) users[currentUser].tasks = [];
    users[currentUser].tasks.push(newTask);
  }
  
  saveUserData();
  loadTasks();
  logActivity(`${currentUser} ${taskId ? 'updated' : 'created'} task: "${newTask.title}"`);

  e.target.reset();
  document.getElementById('taskId').value = '';
  bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
  showToast(taskId ? 'Task updated successfully!' : 'Task added successfully!');
});

function getTaskById(taskId) {
  for (let username in users) {
    if (users[username].tasks) {
      const task = users[username].tasks.find(t => t.id === taskId);
      if (task) return task;
    }
  }
  return null;
}

// ===== Display Tasks in Kanban View =====
function displayKanbanTasks(taskArray) {
  const todoColumn = document.getElementById('todo-tasks');
  const progressColumn = document.getElementById('progress-tasks');
  const doneColumn = document.getElementById('done-tasks');
  
  todoColumn.innerHTML = '';
  progressColumn.innerHTML = '';
  doneColumn.innerHTML = '';
  
  taskArray.forEach(task => {
    const card = createTaskCard(task);
    
    if (task.status === 'todo') {
      todoColumn.appendChild(card);
    } else if (task.status === 'progress') {
      progressColumn.appendChild(card);
    } else if (task.status === 'done') {
      doneColumn.appendChild(card);
    }
  });
}

// ===== Display Tasks in List View =====
function displayListTasks(taskArray) {
  const list = document.getElementById('taskList');
  list.innerHTML = '';

  taskArray.forEach(task => {
    const card = document.createElement('div');
    card.className = 'col-12';
    
    const statusClass = task.status === 'todo' ? 'border-start border-primary' : 
                       task.status === 'progress' ? 'border-start border-warning' : 
                       'border-start border-success';
    
    card.innerHTML = `
      <div class="card shadow-sm ${statusClass}" style="border-left-width: 5px !important;">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h5 class="fw-bold text-primary">${task.title}</h5>
              <p class="text-muted">${task.desc}</p>
              <div class="d-flex flex-wrap gap-2">
                <span class="badge bg-${task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'success'}">
                  ${task.priority}
                </span>
                ${task.category ? `<span class="badge bg-info">${task.category}</span>` : ''}
                <span class="badge bg-secondary">${task.status === 'todo' ? 'To Do' : task.status === 'progress' ? 'In Progress' : 'Done'}</span>
              </div>
              <p class="mt-2 mb-1"><i class="bi bi-calendar-event"></i> ${task.date}</p>
              ${task.assignee ? `<span class="assignee-badge"><i class="bi bi-person"></i> ${task.assignee}</span>` : ''}
            </div>
            <div class="d-flex flex-column gap-1">
              <button class="btn btn-sm btn-outline-primary" onclick="editTask('${task.id}')">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-sm btn-outline-info" onclick="showComments('${task.id}')">
                <i class="bi bi-chat"></i> Comments (${task.comments ? task.comments.length : 0})
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteTask('${task.id}')">
                <i class="bi bi-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    list.appendChild(card);
  });
}

// ===== Create Task Card =====
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'card mb-3';
  card.draggable = true;
  card.id = `task-${task.id}`;
  card.ondragstart = (event) => drag(event, task.id);
  
  card.innerHTML = `
    <div class="card-body">
      <h6 class="fw-bold text-primary">${task.title}</h6>
      <p class="small text-muted">${task.desc}</p>
      <div class="d-flex justify-content-between align-items-center">
        <span class="badge bg-${task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'success'}">
          ${task.priority}
        </span>
        ${task.category ? `<span class="badge bg-info">${task.category}</span>` : ''}
      </div>
      <p class="small mt-2 mb-1"><i class="bi bi-calendar-event"></i> ${task.date}</p>
      ${task.assignee ? `<span class="assignee-badge"><i class="bi bi-person"></i> ${task.assignee}</span>` : ''}
      <div class="d-flex justify-content-between mt-2">
        <button class="btn btn-sm btn-outline-primary" onclick="editTask('${task.id}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-info" onclick="showComments('${task.id}')">
          <i class="bi bi-chat"></i> (${task.comments ? task.comments.length : 0})
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTask('${task.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
  
  return card;
}

// ===== Edit Task =====
function editTask(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = task.id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.desc;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskDate').value = task.date;
  document.getElementById('taskAssignee').value = task.assignee || '';
  document.getElementById('taskCategory').value = task.category || '';
  
  const modal = new bootstrap.Modal(document.getElementById('taskModal'));
  modal.show();
}

// ===== Delete Task =====
function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  const task = getTaskById(taskId);
  Object.keys(users).forEach(username => {
    if (users[username].tasks) {
      users[username].tasks = users[username].tasks.filter(t => t.id !== taskId);
    }
  });
  
  saveUserData();
  loadTasks();
  logActivity(`${currentUser} deleted task: "${task.title}"`);
  showToast('Task deleted successfully!', 'warning');
}

// ===== Drag & Drop =====
function drag(event, taskId) {
  event.dataTransfer.setData('text/plain', taskId);
}

function allowDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function drop(event, status) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  
  const taskId = event.dataTransfer.getData('text/plain');
  const task = getTaskById(taskId);
  if (!task) return;
  
  const oldStatus = task.status;
  task.status = status;
  
  // Update across users
  Object.keys(users).forEach(username => {
    if (users[username].tasks) {
      const index = users[username].tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        users[username].tasks[index].status = status;
      }
    }
  });
  
  saveUserData();
  loadTasks();
  
  if (oldStatus !== status) {
    logActivity(`${currentUser} moved task "${task.title}" from ${oldStatus} to ${status}`);
    showToast('Task status updated!', 'info');
  }
}

// Remove drag-over class when leaving drop zone
document.querySelectorAll('.drop-zone').forEach(zone => {
  zone.addEventListener('dragleave', (e) => {
    e.currentTarget.classList.remove('drag-over');
  });
});

// ===== Comments System =====
function showComments(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  
  document.getElementById('commentTaskId').value = taskId;
  const commentList = document.getElementById('commentList');
  commentList.innerHTML = '';
  
  if (task.comments && task.comments.length > 0) {
    task.comments.forEach(comment => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.innerHTML = `
        <div class="comment-author">${comment.author} - ${new Date(comment.timestamp).toLocaleString()}</div>
        <div class="comment-text">${comment.text}</div>
      `;
      commentList.appendChild(commentEl);
    });
  } else {
    commentList.innerHTML = '<p class="text-muted text-center">No comments yet</p>';
  }
  
  const modal = new bootstrap.Modal(document.getElementById('commentModal'));
  modal.show();
}

document.getElementById('commentForm').addEventListener('submit', e => {
  e.preventDefault();
  const taskId = document.getElementById('commentTaskId').value;
  const commentText = document.getElementById('commentText').value;
  
  if (!commentText.trim()) return;
  
  const task = getTaskById(taskId);
  if (!task) return;
  
  if (!task.comments) task.comments = [];
  
  task.comments.push({
    author: currentUser,
    text: commentText,
    timestamp: new Date().toISOString()
  });
  
  // Update across users
  Object.keys(users).forEach(username => {
    if (users[username].tasks) {
      const index = users[username].tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        users[username].tasks[index].comments = task.comments;
      }
    }
  });
  
  saveUserData();
  showComments(taskId);
  document.getElementById('commentText').value = '';
  logActivity(`${currentUser} commented on task: "${task.title}"`);
  showToast('Comment added!', 'info');
});

// ===== Activity Feed =====
function logActivity(message) {
  if (!users[currentUser].activity) {
    users[currentUser].activity = [];
  }
  
  users[currentUser].activity.unshift({
    message,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 20 activities
  if (users[currentUser].activity.length > 20) {
    users[currentUser].activity = users[currentUser].activity.slice(0, 20);
  }
  
  saveUserData();
  loadActivityFeed();
}

function loadActivityFeed() {
  const activityList = document.getElementById('activityList');
  activityList.innerHTML = '';
  
  const activities = users[currentUser]?.activity || [];
  
  if (activities.length === 0) {
    activityList.innerHTML = '<p class="text-center text-muted">No activity yet</p>';
    return;
  }
  
  activities.forEach(activity => {
    const activityEl = document.createElement('div');
    activityEl.className = 'activity-item';
    activityEl.innerHTML = `
      <div class="small">${activity.message}</div>
      <div class="text-muted" style="font-size: 0.75rem;">${new Date(activity.timestamp).toLocaleString()}</div>
    `;
    activityList.appendChild(activityEl);
  });
}

// ===== Filter Functions =====
function updateAssigneeFilter() {
  const assigneeFilter = document.getElementById('assigneeFilter');
  const taskAssignee = document.getElementById('taskAssignee');
  
  // Clear existing options except the first one
  while (assigneeFilter.children.length > 1) {
    assigneeFilter.removeChild(assigneeFilter.lastChild);
  }
  while (taskAssignee.children.length > 1) {
    taskAssignee.removeChild(taskAssignee.lastChild);
  }
  
  // Get all unique users
  const allUsers = Object.keys(users);
  allUsers.forEach(user => {
    if (user !== currentUser) {
      const option1 = document.createElement('option');
      option1.value = user;
      option1.textContent = user;
      assigneeFilter.appendChild(option1);
      
      const option2 = document.createElement('option');
      option2.value = user;
      option2.textContent = user;
      taskAssignee.appendChild(option2);
    }
  });
}

// Add event listeners for filters
document.getElementById('searchInput').addEventListener('input', loadTasks);
document.getElementById('priorityFilter').addEventListener('change', loadTasks);
document.getElementById('assigneeFilter').addEventListener('change', loadTasks);
document.getElementById('dueDateFilter').addEventListener('change', loadTasks);

// ===== Statistics Function =====
function updateStatistics() {
  const tasks = users[currentUser]?.tasks || [];
  const total = tasks.length;
  const completed = tasks.filter(task => task.status === 'done').length;
  const pending = tasks.filter(task => task.status !== 'done').length;
  const overdue = tasks.filter(task => 
    task.status !== 'done' && new Date(task.date) < new Date()
  ).length;

  document.getElementById('totalTasks').textContent = total;
  document.getElementById('completedTasks').textContent = completed;
  document.getElementById('pendingTasks').textContent = pending;
  document.getElementById('overdueTasks').textContent = overdue;
}

// ===== Real-Time Simulation =====
setInterval(() => {
  if (currentUser) {
    loadTasks();
    // Simulate optimistic update or conflict check (e.g., check for timestamp conflicts)
    console.log("🔄 Simulated real-time update!");
  }
}, 15000);

// Export/Import (Advanced Feature)
function exportData() {
  const dataStr = JSON.stringify(users);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = `tasks_backup_${new Date().toISOString().slice(0,10)}.json`;
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  showToast('Data exported!');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedUsers = JSON.parse(e.target.result);
      Object.assign(users, importedUsers);
      saveUserData();
      loadTasks();
      updateAssigneeFilter();
      showToast('Data imported successfully!');
    } catch (err) {
      alert('Invalid file!');
    }
  };
  reader.readAsText(file);
}

// Add export button to navbar for demo
document.querySelector('.d-flex').insertAdjacentHTML('beforeend', '<input type="file" id="importFile" style="display:none;" accept=".json" onchange="importData(event)"><button class="btn btn-light btn-sm ms-2" onclick="exportData()">Export</button><button class="btn btn-light btn-sm ms-2" onclick="document.getElementById(\'importFile\').click()">Import</button>');