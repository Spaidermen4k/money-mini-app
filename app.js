// ===== Подключение к Telegram =====
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();   // сообщаем Telegram, что приложение загрузилось
  tg.expand();  // разворачиваем на весь экран
}

// Лёгкая вибрация при действиях (работает только внутри Telegram)
const haptic = (kind) => {
  try { tg.HapticFeedback.notificationOccurred(kind); } catch (e) {}
};

// ===== Категории =====
const CATEGORIES = {
  expense: [
    { name: "Еда", icon: "🍔" },
    { name: "Транспорт", icon: "🚕" },
    { name: "Жильё", icon: "🏠" },
    { name: "Здоровье", icon: "💊" },
    { name: "Развлечения", icon: "🎬" },
    { name: "Покупки", icon: "🛍️" },
    { name: "Другое", icon: "📦" },
  ],
  income: [
    { name: "Зарплата", icon: "💼" },
    { name: "Подработка", icon: "🧑‍💻" },
    { name: "Подарок", icon: "🎁" },
    { name: "Другое", icon: "💰" },
  ],
};

// ===== Данные: хранятся в памяти телефона (localStorage) =====
const STORAGE_KEY = "money-mini-app:v1";

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
}

let items = load();
let type = "expense";
let category = CATEGORIES.expense[0].name;

// ===== Вспомогательное =====
// Целые суммы без копеек, дробные с двумя знаками: 1 250 ₽ и 1 250,50 ₽
const money = (n) => {
  const cents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n) + " ₽";
};

// Превращает "1 250,50" в число 1250.5
function parseAmount(text) {
  const n = Number(String(text).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

const $ = (id) => document.getElementById(id);

// ===== Отрисовка =====
function renderChips() {
  const box = $("chips");
  box.replaceChildren();
  CATEGORIES[type].forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (c.name === category ? " is-active" : "");
    btn.textContent = c.icon + " " + c.name;
    btn.addEventListener("click", () => { category = c.name; renderChips(); });
    box.append(btn);
  });
}

function renderTotals() {
  const now = new Date();
  let balance = 0, monthIn = 0, monthOut = 0;
  items.forEach((it) => {
    const sign = it.type === "income" ? 1 : -1;
    balance += sign * it.amount;
    const d = new Date(it.ts);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      if (it.type === "income") monthIn += it.amount; else monthOut += it.amount;
    }
  });
  $("balance").textContent = money(balance);
  $("monthIn").textContent = money(monthIn);
  $("monthOut").textContent = money(monthOut);
}

function renderList() {
  const list = $("list");
  list.replaceChildren();
  $("empty").hidden = items.length > 0;

  const sorted = [...items].sort((a, b) => b.ts - a.ts);
  let lastDay = "";
  sorted.forEach((it) => {
    const label = dayLabel(it.ts);
    if (label !== lastDay) {
      const li = document.createElement("li");
      li.className = "day";
      li.textContent = label;
      list.append(li);
      lastDay = label;
    }

    const cat = [...CATEGORIES.expense, ...CATEGORIES.income].find((c) => c.name === it.category);
    const li = document.createElement("li");
    li.className = "item";

    const icon = document.createElement("span");
    icon.className = "item__icon";
    icon.textContent = cat ? cat.icon : "•";

    const main = document.createElement("div");
    main.className = "item__main";
    const name = document.createElement("div");
    name.className = "item__cat";
    name.textContent = it.category;
    main.append(name);
    if (it.note) {
      const note = document.createElement("div");
      note.className = "item__note";
      note.textContent = it.note;   // textContent, чтобы чужой текст не превратился в код
      main.append(note);
    }

    const sum = document.createElement("span");
    sum.className = "item__sum item__sum--" + (it.type === "income" ? "in" : "out");
    sum.textContent = (it.type === "income" ? "+" : "−") + money(it.amount);

    const del = document.createElement("button");
    del.className = "item__del";
    del.type = "button";
    del.setAttribute("aria-label", "Удалить");
    del.textContent = "✕";
    del.addEventListener("click", () => removeItem(it.id));

    li.append(icon, main, sum, del);
    list.append(li);
  });
}

function render() {
  renderTotals();
  renderList();
}

// ===== Действия =====
function removeItem(id) {
  const ok = tg && tg.showConfirm
    ? null
    : window.confirm("Удалить операцию?");
  const doDelete = () => {
    items = items.filter((it) => it.id !== id);
    save();
    render();
  };
  if (ok === null) {
    tg.showConfirm("Удалить операцию?", (yes) => { if (yes) doDelete(); });
  } else if (ok) {
    doDelete();
  }
}

document.querySelectorAll(".switch__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    type = btn.dataset.type;
    category = CATEGORIES[type][0].name;
    document.querySelectorAll(".switch__btn").forEach((b) => b.classList.toggle("is-active", b === btn));
    renderChips();
  });
});

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseAmount($("amount").value);
  if (!(amount > 0)) {
    $("amount").focus();
    haptic("error");
    return;
  }
  items.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    category,
    amount,
    note: $("note").value.trim(),
    ts: Date.now(),
  });
  save();
  $("amount").value = "";
  $("note").value = "";
  haptic("success");
  render();
});

renderChips();
render();
