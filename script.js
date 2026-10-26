"use strict";

const STORAGE_KEY = "MY_TODO_APP_DATA_V1";
const PRIORITIES = {
  HIGH: { label: "높음", className: "priority-high" },
  MEDIUM: { label: "보통", className: "priority-medium" },
  LOW: { label: "낮음", className: "priority-low" },
};
const FILTER_EMPTY_MESSAGES = {
  ALL: "등록된 할 일이 없습니다. 새로운 할 일을 추가해보세요!",
  ACTIVE: "모든 할 일을 완료했습니다! 🎉",
  COMPLETED: "아직 완료된 할 일이 없습니다.",
};
const elements = {
  alert: document.querySelector("#storage-alert"),
  form: document.querySelector("#todo-form"),
  textInput: document.querySelector("#todo-text"),
  dueInput: document.querySelector("#todo-due-date"),
  priorityInput: document.querySelector("#todo-priority"),
  inputError: document.querySelector("#todo-error"),
  today: document.querySelector("#today-date"),
  progressLabel: document.querySelector("#progress-label"),
  progress: document.querySelector("#progress-bar"),
  progressBar: document.querySelector(".progress-fill"),
  tabs: document.querySelector(".todo-tabs"),
  list: document.querySelector("#todo-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyMessage: document.querySelector("#empty-message"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteTodoText: document.querySelector("#delete-todo-text"),
  cancelDelete: document.querySelector("#cancel-delete"),
  confirmDelete: document.querySelector("#confirm-delete"),
};

const state = {
  todos: [],
  filter: "ALL",
  editingId: null,
  pendingDeleteId: null,
  deleteTrigger: null,
  storageAvailable: true,
  idSequence: 0,
};

function showStorageAlert(message) {
  elements.alert.textContent = message;
  elements.alert.hidden = false;
}

function reportStorageError(error, message) {
  console.error("To-Do localStorage error:", error);
  state.storageAvailable = false;
  showStorageAlert(message);
}

function isTodo(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    (typeof value.dueDateTime === "string" || value.dueDateTime === null) &&
    Object.hasOwn(PRIORITIES, value.priority)
  );
}

function loadTodos() {
  let storedValue;
  try {
    storedValue = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    reportStorageError(error, "브라우저 저장소를 사용할 수 없어 현재 세션에서만 할 일을 보관합니다.");
    return [];
  }

  if (storedValue === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError("Saved todo data must be an array.");
    }
    return parsed.filter(isTodo);
  } catch (error) {
    console.error("To-Do data could not be parsed:", error);
    showStorageAlert("저장된 할 일 데이터를 읽을 수 없어 빈 목록으로 시작합니다.");
    return [];
  }
}

function saveTodos() {
  if (!state.storageAvailable) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  } catch (error) {
    reportStorageError(error, "브라우저 저장소에 접근할 수 없어 현재 세션에서만 할 일을 보관합니다.");
  }
}

function createElement(tagName, className = "", text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function localDateTimeToIso(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToLocalDateTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) {
    return "없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "확인할 수 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createTodoId() {
  state.idSequence += 1;
  return `todo_${Date.now()}_${state.idSequence}`;
}

function burstConfetti(origin) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const bounds = origin.getBoundingClientRect();
  const layer = createElement("div", "confetti-layer");
  layer.setAttribute("aria-hidden", "true");
  const colors = ["#f472b6", "#facc15", "#34d399", "#60a5fa", "#a78bfa", "#fb923c"];

  for (let index = 0; index < 28; index += 1) {
    const piece = createElement("span", "confetti-piece");
    piece.style.setProperty("--confetti-left", `${bounds.left + bounds.width / 2}px`);
    piece.style.setProperty("--confetti-top", `${bounds.top + bounds.height / 2}px`);
    piece.style.setProperty("--confetti-x", `${Math.random() * 220 - 110}px`);
    piece.style.setProperty("--confetti-y", `${Math.random() * 150 + 45}px`);
    piece.style.setProperty("--confetti-rotation", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    layer.append(piece);
  }

  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 1400);
}

function getVisibleTodos() {
  if (state.filter === "ACTIVE") {
    return state.todos.filter((todo) => !todo.completed);
  }
  if (state.filter === "COMPLETED") {
    return state.todos.filter((todo) => todo.completed);
  }
  return state.todos;
}

function updateCountsAndProgress() {
  const counts = {
    ALL: state.todos.length,
    ACTIVE: state.todos.filter((todo) => !todo.completed).length,
    COMPLETED: state.todos.filter((todo) => todo.completed).length,
  };

  for (const filter of Object.keys(counts)) {
    const count = elements.tabs.querySelector(`[data-count="${filter}"]`);
    count.textContent = String(counts[filter]);
  }

  const completed = counts.COMPLETED;
  const percentage = counts.ALL === 0 ? 0 : Math.round((completed / counts.ALL) * 100);
  elements.progressLabel.textContent = `${completed}/${counts.ALL} 완료 (${percentage}%)`;
  elements.progress.setAttribute("aria-valuenow", String(percentage));
  elements.progressBar.style.width = `${percentage}%`;
}

function createPriorityBadge(priority) {
  const detail = PRIORITIES[priority];
  return createElement("span", `priority-badge ${detail.className}`, detail.label);
}

function createTodoCheckbox(todo) {
  const wrapper = createElement("label", "todo-check-wrap");
  const checkbox = createElement("input", "todo-check");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.dataset.action = "toggle";
  checkbox.setAttribute("aria-label", `${todo.text} 완료 상태 변경`);
  wrapper.append(checkbox);
  return wrapper;
}

function createActionButton(label, action, className = "") {
  const button = createElement("button", `todo-action ${className}`.trim(), label);
  button.type = "button";
  if (action) {
    button.dataset.action = action;
  }
  return button;
}

function createTodoItem(todo) {
  const item = createElement("li", `todo-item${todo.completed ? " is-completed" : ""}`);
  item.dataset.todoId = todo.id;

  if (state.editingId === todo.id) {
    item.append(createEditForm(todo));
    return item;
  }

  item.append(createTodoCheckbox(todo));

  const main = createElement("div", "todo-main");
  const titleLine = createElement("div", "todo-title-line");
  const text = createElement(
    "p",
    `todo-text${todo.text.length >= 100 ? " todo-text--clamped" : ""}`,
    todo.text,
  );
  text.title = todo.text;
  titleLine.append(text, createPriorityBadge(todo.priority));

  const metadata = createElement(
    "p",
    "todo-meta",
    `등록 ${formatDateTime(todo.createdAt)} · 마감 ${formatDateTime(todo.dueDateTime)}`,
  );
  main.append(titleLine, metadata);

  const actions = createElement("div", "todo-actions");
  actions.append(
    createActionButton("수정", "edit"),
    createActionButton("삭제", "delete", "todo-action--danger"),
  );
  item.append(main, actions);
  return item;
}

function createEditForm(todo) {
  const form = createElement("form", "edit-form");
  form.dataset.action = "save-edit";
  form.noValidate = true;

  const textField = createElement("div");
  const textLabel = createElement("label", "mb-1.5 block text-sm font-semibold text-slate-600", "할 일 내용");
  const textInput = createElement(
    "input",
    "field-control w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100",
  );
  textInput.type = "text";
  textInput.value = todo.text;
  textInput.maxLength = 500;
  textInput.dataset.editText = "";
  textLabel.htmlFor = `edit-text-${todo.id}`;
  textInput.id = textLabel.htmlFor;
  const error = createElement("div", "input-error mt-1 text-sm text-red-600");
  error.dataset.editError = "";
  error.setAttribute("aria-live", "polite");
  textField.append(textLabel, textInput, error);

  const dueField = createElement("div");
  const dueLabel = createElement("label", "mb-1.5 block text-sm font-semibold text-slate-600", "마감 일시");
  const dueInput = createElement(
    "input",
    "field-control w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100",
  );
  dueInput.type = "datetime-local";
  dueInput.value = isoToLocalDateTime(todo.dueDateTime);
  dueInput.dataset.editDue = "";
  dueLabel.htmlFor = `edit-due-${todo.id}`;
  dueInput.id = dueLabel.htmlFor;
  dueField.append(dueLabel, dueInput);

  const priorityField = createElement("div");
  const priorityLabel = createElement("label", "mb-1.5 block text-sm font-semibold text-slate-600", "우선순위");
  const prioritySelect = createElement(
    "select",
    "field-control w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100",
  );
  prioritySelect.dataset.editPriority = "";
  priorityLabel.htmlFor = `edit-priority-${todo.id}`;
  prioritySelect.id = priorityLabel.htmlFor;
  for (const [value, detail] of Object.entries(PRIORITIES)) {
    const option = createElement("option", "", detail.label);
    option.value = value;
    prioritySelect.append(option);
  }
  prioritySelect.value = todo.priority;
  priorityField.append(priorityLabel, prioritySelect);

  const actions = createElement("div", "edit-actions");
  const cancel = createActionButton("취소", "cancel-edit");
  const save = createActionButton("저장", "", "todo-action--primary");
  save.type = "submit";
  actions.append(cancel, save);

  form.append(textField, dueField, priorityField, actions);
  return form;
}

function render() {
  updateCountsAndProgress();

  for (const tab of elements.tabs.querySelectorAll("[data-filter]")) {
    const active = tab.dataset.filter === state.filter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    if (active) {
      tab.removeAttribute("tabindex");
    } else {
      tab.tabIndex = -1;
    }
  }

  const visibleTodos = getVisibleTodos();
  elements.list.replaceChildren(...visibleTodos.map(createTodoItem));

  const noItems = visibleTodos.length === 0;
  elements.list.hidden = noItems;
  elements.emptyState.hidden = !noItems;
  elements.emptyMessage.textContent = state.todos.length === 0
    ? FILTER_EMPTY_MESSAGES.ALL
    : FILTER_EMPTY_MESSAGES[state.filter];
}

function clearInputError() {
  elements.textInput.classList.remove("is-invalid");
  elements.textInput.removeAttribute("aria-invalid");
  elements.inputError.textContent = "";
}

function showInputError(message) {
  elements.textInput.classList.add("is-invalid");
  elements.textInput.setAttribute("aria-invalid", "true");
  elements.inputError.textContent = message;
  elements.textInput.focus();
}

function addTodo(event) {
  event.preventDefault();
  const text = elements.textInput.value.trim();
  if (!text) {
    showInputError("할 일 내용을 입력해주세요.");
    return;
  }

  state.todos.unshift({
    id: createTodoId(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    dueDateTime: localDateTimeToIso(elements.dueInput.value),
    priority: elements.priorityInput.value,
  });
  saveTodos();
  clearInputError();
  elements.textInput.value = "";
  render();
  elements.textInput.focus();
}

function saveEdit(form, item) {
  const todo = state.todos.find((entry) => entry.id === item.dataset.todoId);
  if (!todo) {
    return;
  }

  const textInput = form.querySelector("[data-edit-text]");
  const text = textInput.value.trim();
  if (!text) {
    const error = form.querySelector("[data-edit-error]");
    textInput.classList.add("is-invalid");
    textInput.setAttribute("aria-invalid", "true");
    error.textContent = "할 일 내용을 입력해주세요.";
    textInput.focus();
    return;
  }

  todo.text = text;
  todo.dueDateTime = localDateTimeToIso(form.querySelector("[data-edit-due]").value);
  todo.priority = form.querySelector("[data-edit-priority]").value;
  state.editingId = null;
  saveTodos();
  render();
}

function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const item = button.closest("[data-todo-id]");
  if (!item) {
    return;
  }

  const { action } = button.dataset;
  if (action === "edit") {
    state.editingId = item.dataset.todoId;
    render();
    elements.list.querySelector("[data-edit-text]")?.focus();
  } else if (action === "cancel-edit") {
    state.editingId = null;
    render();
  } else if (action === "delete") {
    const todo = state.todos.find((entry) => entry.id === item.dataset.todoId);
    if (todo) {
      state.pendingDeleteId = todo.id;
      state.deleteTrigger = button;
      elements.deleteTodoText.textContent = todo.text;
      elements.deleteDialog.showModal();
      elements.confirmDelete.focus();
    }
  }
}

function closeDeleteDialog() {
  if (elements.deleteDialog.open) {
    elements.deleteDialog.close();
  }
}

function confirmDelete() {
  const todo = state.todos.find((entry) => entry.id === state.pendingDeleteId);
  closeDeleteDialog();
  if (!todo) {
    return;
  }

  state.todos = state.todos.filter((entry) => entry.id !== todo.id);
  if (state.editingId === todo.id) {
    state.editingId = null;
  }
  saveTodos();
  render();
  elements.textInput.focus();
}

function handleListChange(event) {
  const checkbox = event.target.closest('input[data-action="toggle"]');
  if (!checkbox) {
    return;
  }
  const item = checkbox.closest("[data-todo-id]");
  const todo = state.todos.find((entry) => entry.id === item?.dataset.todoId);
  if (!todo) {
    return;
  }
  todo.completed = checkbox.checked;
  if (todo.completed) {
    burstConfetti(checkbox);
  }
  saveTodos();
  render();
}

function handleListSubmit(event) {
  const form = event.target.closest('form[data-action="save-edit"]');
  if (!form) {
    return;
  }
  event.preventDefault();
  const item = form.closest("[data-todo-id]");
  if (item) {
    saveEdit(form, item);
  }
}

function handleTabClick(event) {
  const tab = event.target.closest("button[data-filter]");
  if (!tab || !elements.tabs.contains(tab)) {
    return;
  }
  state.filter = tab.dataset.filter;
  state.editingId = null;
  render();
}

function handleEditInput(event) {
  if (event.target.matches("[data-edit-text]")) {
    event.target.classList.remove("is-invalid");
    event.target.removeAttribute("aria-invalid");
    event.target.closest("form").querySelector("[data-edit-error]").textContent = "";
  }
}

elements.form.addEventListener("submit", addTodo);
elements.textInput.addEventListener("input", clearInputError);
elements.tabs.addEventListener("click", handleTabClick);
elements.list.addEventListener("click", handleListClick);
elements.list.addEventListener("change", handleListChange);
elements.list.addEventListener("submit", handleListSubmit);
elements.list.addEventListener("input", handleEditInput);
elements.cancelDelete.addEventListener("click", closeDeleteDialog);
elements.confirmDelete.addEventListener("click", confirmDelete);
elements.deleteDialog.addEventListener("click", (event) => {
  if (event.target === elements.deleteDialog) {
    closeDeleteDialog();
  }
});
elements.deleteDialog.addEventListener("close", () => {
  state.pendingDeleteId = null;
  elements.deleteTodoText.textContent = "";
  if (state.deleteTrigger?.isConnected) {
    state.deleteTrigger.focus();
  } else {
    elements.textInput.focus();
  }
  state.deleteTrigger = null;
});

elements.today.textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());
state.todos = loadTodos();
render();
