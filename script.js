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
  progressBar: document.querySelector("#progress-bar .progress-bar"),
  tabs: document.querySelector(".todo-tabs"),
  list: document.querySelector("#todo-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyMessage: document.querySelector("#empty-message"),
};

const state = {
  todos: [],
  filter: "ALL",
  editingId: null,
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

function createElement(tagName, className, text) {
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
  const checkbox = createElement("input", "form-check-input todo-check");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.dataset.action = "toggle";
  checkbox.setAttribute("aria-label", `${todo.text} 완료 상태 변경`);
  wrapper.append(checkbox);
  return wrapper;
}

function createActionButton(label, action, className) {
  const button = createElement("button", `btn ${className} todo-action`, label);
  button.type = "button";
  button.dataset.action = action;
  return button;
}

function createTodoItem(todo) {
  const item = createElement("li", `todo-item${todo.completed ? " is-completed" : ""}`);
  item.dataset.todoId = todo.id;
  item.setAttribute("role", "listitem");

  if (state.editingId === todo.id) {
    item.append(createEditForm(todo));
    return item;
  }

  item.append(createTodoCheckbox(todo));

  const main = createElement("div", "todo-main");
  const titleLine = createElement("div", "todo-title-line");
  const text = createElement("p", `todo-text${todo.text.length >= 100 ? " todo-text--clamped" : ""}`, todo.text);
  text.title = todo.text;
  titleLine.append(text, createPriorityBadge(todo.priority));

  const metadata = createElement(
    "p",
    "todo-meta mb-0",
    `등록 ${formatDateTime(todo.createdAt)} · 마감 ${formatDateTime(todo.dueDateTime)}`,
  );
  main.append(titleLine, metadata);

  const actions = createElement("div", "todo-actions");
  actions.append(
    createActionButton("수정", "edit", "btn-outline-secondary"),
    createActionButton("삭제", "delete", "btn-outline-danger"),
  );
  item.append(main, actions);
  return item;
}

function createEditForm(todo) {
  const form = createElement("form", "edit-form");
  form.dataset.action = "save-edit";
  form.noValidate = true;

  const textField = createElement("div");
  const textLabel = createElement("label", "form-label", "할 일 내용");
  const textInput = createElement("input", "form-control");
  textInput.type = "text";
  textInput.value = todo.text;
  textInput.maxLength = 500;
  textInput.dataset.editText = "";
  textLabel.htmlFor = `edit-text-${todo.id}`;
  textInput.id = textLabel.htmlFor;
  const error = createElement("div", "invalid-feedback");
  error.dataset.editError = "";
  error.setAttribute("aria-live", "polite");
  textField.append(textLabel, textInput, error);

  const dueField = createElement("div");
  const dueLabel = createElement("label", "form-label", "마감 일시");
  const dueInput = createElement("input", "form-control");
  dueInput.type = "datetime-local";
  dueInput.value = isoToLocalDateTime(todo.dueDateTime);
  dueInput.dataset.editDue = "";
  dueLabel.htmlFor = `edit-due-${todo.id}`;
  dueInput.id = dueLabel.htmlFor;
  dueField.append(dueLabel, dueInput);

  const priorityField = createElement("div");
  const priorityLabel = createElement("label", "form-label", "우선순위");
  const prioritySelect = createElement("select", "form-select");
  prioritySelect.dataset.editPriority = "";
  priorityLabel.htmlFor = `edit-priority-${todo.id}`;
  prioritySelect.id = priorityLabel.htmlFor;
  for (const [value, detail] of Object.entries(PRIORITIES)) {
    const option = createElement("option", "", detail.label);
    option.value = value;
    option.selected = value === todo.priority;
    prioritySelect.append(option);
  }
  prioritySelect.value = todo.priority;
  priorityField.append(priorityLabel, prioritySelect);

  const actions = createElement("div", "edit-actions");
  const cancel = createActionButton("취소", "cancel-edit", "btn-outline-secondary");
  const save = createElement("button", "btn btn-primary todo-action", "저장");
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
  const items = visibleTodos.map(createTodoItem);
  elements.list.replaceChildren(...items);

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
  elements.textInput.focus();
  render();
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
  const todo = state.todos.find((entry) => entry.id === item.dataset.todoId);

  if (action === "edit" && todo) {
    state.editingId = todo.id;
    render();
    elements.list.querySelector("[data-edit-text]")?.focus();
  } else if (action === "cancel-edit") {
    state.editingId = null;
    render();
  } else if (action === "delete" && todo && window.confirm("이 할 일을 삭제할까요?")) {
    state.todos = state.todos.filter((entry) => entry.id !== todo.id);
    state.editingId = null;
    saveTodos();
    render();
  }
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
  if (!tab) {
    return;
  }
  state.editingId = null;
  state.filter = tab.dataset.filter;
  render();
}

function handleTabKeydown(event) {
  const tabs = [...elements.tabs.querySelectorAll("button[data-filter]")];
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex === -1) {
    return;
  }

  let nextIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
}

elements.today.textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());

state.todos = loadTodos();
render();

elements.form.addEventListener("submit", addTodo);
elements.textInput.addEventListener("input", clearInputError);
elements.list.addEventListener("click", handleListClick);
elements.list.addEventListener("change", handleListChange);
elements.list.addEventListener("submit", handleListSubmit);
elements.tabs.addEventListener("click", handleTabClick);
elements.tabs.addEventListener("keydown", handleTabKeydown);
