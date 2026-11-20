(() => {
  "use strict";

  const STORAGE_KEY = "luma-demo-v1";
  const root = document.getElementById("view-root");
  const frame = document.querySelector(".app-frame");
  const dialog = document.getElementById("dialog");
  const statusNames = { confirmed: "Подтверждена", pending: "Ожидает", completed: "Завершена", cancelled: "Отменена" };
  const statusClasses = { confirmed: "confirmed", pending: "pending", completed: "completed", cancelled: "cancelled" };
  const colorClasses = ["", "mini-avatar--green", "mini-avatar--blue", "mini-avatar--rose"];
  let view = "overview";
  let mode = "dashboard";
  let calendarMonth = monthStart(new Date());
  let calendarFocusDate = startOfDay(new Date());
  let calendarLayout = "month";
  let calendarTeamFilter = "all";
  let appointmentSort = "date-asc";
  let booking = { step: 0, serviceId: "", teamId: "", date: "", time: "", name: "", phone: "", email: "" };
  let lastBookingId = "";

  function localKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function parseDate(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function monthStart(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function addDays(date, n) { const result = new Date(date); result.setDate(result.getDate() + n); return result; }
  function dateOffset(n) { return localKey(addDays(startOfDay(new Date()), n)); }
  function weekStart(date) { const result = startOfDay(date); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
  function formatDate(dateOrKey, options = { day: "numeric", month: "long" }) {
    const date = typeof dateOrKey === "string" ? parseDate(dateOrKey) : dateOrKey;
    return new Intl.DateTimeFormat("ru-RU", options).format(date);
  }
  function formatTime(time) { return time || "—"; }
  function money(value) { return `${new Intl.NumberFormat("ru-RU").format(Number(value) || 0)} ₽`; }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function makeSeed() {
    const services = [
      { id: "cut", name: "Стрижка", description: "Форма и укладка", duration: 60, price: 3500, color: "#91ad83" },
      { id: "beard", name: "Оформление бороды", description: "Контур и уход", duration: 30, price: 2000, color: "#d9ad67" },
      { id: "combo", name: "Стрижка + борода", description: "Комплексный уход", duration: 90, price: 5000, color: "#7791b2" },
      { id: "style", name: "Укладка", description: "Финальный образ", duration: 45, price: 2500, color: "#c98e88" }
    ];
    const team = [
      { id: "nina", name: "Нина Волкова", role: "Стилист · стрижки", days: "Пн–Пт", initials: "НВ", tone: "green", portrait: "nina.svg" },
      { id: "mark", name: "Марк Соколов", role: "Барбер · борода", days: "Вт–Сб", initials: "МС", tone: "blue", portrait: "mark.svg" },
      { id: "alisa", name: "Алиса Миронова", role: "Стилист · укладки", days: "Ср–Вс", initials: "АМ", tone: "rose", portrait: "alisa.svg" }
    ];
    const examples = [
      [-5, "Артём Лебедев", "cut", "nina", "10:00", "completed"],
      [-3, "Илья Назаров", "combo", "mark", "12:00", "completed"],
      [-1, "Денис Орлов", "beard", "mark", "15:00", "completed"],
      [0, "Кирилл Смирнов", "cut", "nina", "10:30", "confirmed"],
      [0, "Павел Волков", "style", "alisa", "13:00", "pending"],
      [0, "Максим Беляев", "combo", "mark", "16:00", "confirmed"],
      [1, "Егор Кузнецов", "cut", "nina", "11:00", "confirmed"],
      [2, "Фёдор Павлов", "beard", "mark", "14:00", "pending"],
      [3, "Антон Морозов", "style", "alisa", "12:30", "confirmed"]
    ];
    const bookings = examples.map(([offset, client, serviceId, teamId, time, status]) => {
      const service = services.find((item) => item.id === serviceId);
      return {
        id: uid("booking"), client, phone: "+7 900 000-00-00", email: "", serviceId, serviceName: service.name,
        servicePrice: service.price, serviceDuration: service.duration, teamId, date: dateOffset(offset), time, status, source: "Демо"
      };
    });
    return { studio: { name: "Forma Studio", address: "Воронеж · ул. Мира, 12" }, services, team, bookings };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.services) && Array.isArray(saved.team) && Array.isArray(saved.bookings)) {
        const defaults = makeSeed();
        const team = saved.team.map((member) => ({ ...(defaults.team.find((base) => base.id === member.id) || {}), ...member }));
        const bookings = saved.bookings.map((item) => {
          const service = saved.services.find((entry) => entry.id === item.serviceId) || defaults.services.find((entry) => entry.id === item.serviceId);
          return {
            ...item,
            serviceName: item.serviceName || service?.name || "Услуга удалена",
            servicePrice: Number(item.servicePrice ?? service?.price ?? 0),
            serviceDuration: Number(item.serviceDuration ?? service?.duration ?? 0)
          };
        });
        return { ...defaults, ...saved, bookings, team, studio: { ...defaults.studio, ...(saved.studio || {}) } };
      }
    } catch (error) { /* повреждённые локальные данные заменятся демо-набором */ }
    return makeSeed();
  }
  let data = loadState();
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { toast("Браузер не разрешил сохранить изменения. Включите локальное хранилище для этой страницы."); }
    updateChrome();
  }
  function updateChrome() {
    document.querySelectorAll("[data-studio-name]").forEach((el) => { el.textContent = data.studio.name; });
    const count = data.bookings.filter((item) => item.status !== "cancelled").length;
    document.querySelectorAll("[data-appointment-count]").forEach((el) => { el.textContent = count; });
  }
  function serviceById(id) { return data.services.find((item) => item.id === id) || { name: "Услуга удалена", duration: 0, price: 0, color: "#9aaa8d" }; }
  function bookingService(item) {
    const current = serviceById(item.serviceId);
    return {
      ...current,
      name: item.serviceName || current.name,
      price: Number(item.servicePrice ?? current.price ?? 0),
      duration: Number(item.serviceDuration ?? current.duration ?? 0)
    };
  }
  function teamById(id) { return data.team.find((item) => item.id === id) || { name: "Специалист не выбран", role: "", initials: "?", tone: "" }; }
  function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase(); }
  function avatar(name, tone = "") { return `<span class="mini-avatar ${tone ? `mini-avatar--${escapeHTML(tone)}` : ""}">${escapeHTML(initials(name))}</span>`; }
  function staffPortrait(member, size = "") { return `<span class="staff-portrait ${size}"><img src="assets/${escapeHTML(member.portrait || "nina.svg")}" alt=""></span>`; }
  function statusBadge(status) { return `<span class="status status--${statusClasses[status] || "pending"}">${escapeHTML(statusNames[status] || "Ожидает")}</span>`; }
  function eventTone(status) { return status === "pending" ? "calendar-event--amber" : status === "completed" ? "calendar-event--blue" : ""; }
  function bookingSummary(item) {
    const service = bookingService(item);
    const specialist = teamById(item.teamId);
    return `<div class="detail-list">
      <div class="confirmation-row"><span>Клиент</span><strong>${escapeHTML(item.client)}</strong></div>
      <div class="confirmation-row"><span>Услуга</span><strong>${escapeHTML(service.name)}</strong></div>
      <div class="confirmation-row"><span>Специалист</span><strong>${escapeHTML(specialist.name)}</strong></div>
      <div class="confirmation-row"><span>Дата и время</span><strong>${escapeHTML(formatDate(item.date, { day: "numeric", month: "long", year: "numeric" }))}, ${escapeHTML(formatTime(item.time))}</strong></div>
      <div class="confirmation-row"><span>Стоимость</span><strong>${money(service.price)}</strong></div>
      <div class="confirmation-row"><span>Статус</span><strong>${statusBadge(item.status)}</strong></div>
      <div class="confirmation-row"><span>Телефон</span><strong>${escapeHTML(item.phone || "—")}</strong></div>
    </div>`;
  }

  function chartMarkup() {
    const days = Array.from({ length: 7 }, (_, index) => addDays(startOfDay(new Date()), index - 5));
    const values = days.map((day) => data.bookings.filter((item) => item.date === localKey(day) && item.status !== "cancelled").length);
    const max = Math.max(3, ...values);
    const bars = values.map((value, index) => {
      const x = 37 + index * 47;
      const height = Math.max(8, (value / max) * 84);
      const y = 105 - height;
      const today = localKey(days[index]) === dateOffset(0);
      return `<g><rect class="chart-bar ${today ? "is-today" : ""}" x="${x}" y="${y}" width="20" height="${height}" rx="5"><title>${value} записей · ${formatDate(days[index], { day: "numeric", month: "short" })}</title></rect><text class="chart-label" x="${x + 10}" y="127" text-anchor="middle">${new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(days[index]).replace(".", "")}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 370 140" role="img" aria-label="График записей за последние семь дней">
      <line class="chart-gridline" x1="25" y1="21" x2="360" y2="21"/><line class="chart-gridline" x1="25" y1="63" x2="360" y2="63"/><line class="chart-gridline" x1="25" y1="105" x2="360" y2="105"/>
      <text class="chart-label" x="2" y="24">${max}</text><text class="chart-label" x="2" y="66">${Math.ceil(max / 2)}</text><text class="chart-label" x="2" y="108">0</text>${bars}</svg>`;
  }
  function renderOverview() {
    const today = dateOffset(0);
    const todayBookings = data.bookings.filter((item) => item.date === today && item.status !== "cancelled");
    const weekEnd = dateOffset(7);
    const weekBookings = data.bookings.filter((item) => item.date >= today && item.date <= weekEnd && item.status !== "cancelled");
    const uniqueClients = new Set(data.bookings.filter((item) => item.status !== "cancelled").map((item) => item.client.trim().toLowerCase())).size;
    const estimated = weekBookings.reduce((sum, item) => sum + bookingService(item).price, 0);
    const upcoming = data.bookings.filter((item) => item.date >= today && item.status !== "cancelled").sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 5);
    const popular = data.services.map((service) => ({ ...service, count: data.bookings.filter((item) => item.serviceId === service.id && item.status !== "cancelled").length })).sort((a, b) => b.count - a.count).slice(0, 4);
    const maxPopular = Math.max(1, ...popular.map((item) => item.count));
    root.innerHTML = `<div class="view-heading"><div><h2>Доброе утро, Юлия</h2><p>${escapeHTML(formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" }))} · Вот как проходит неделя</p></div><span class="date-label">Данные демо-версии</span></div>
      <div class="stats-grid">
        <article class="stat-card"><div class="stat-top"><span>Записи сегодня</span><span class="stat-icon">◷</span></div><div class="stat-value">${todayBookings.length}<span class="stat-change">${todayBookings.filter((item) => item.status === "confirmed").length} подтверждено</span></div><div class="stat-caption">${todayBookings.length ? "Следующая запись по расписанию" : "На сегодня пока свободно"}</div></article>
        <article class="stat-card"><div class="stat-top"><span>Записи на неделю</span><span class="stat-icon">▦</span></div><div class="stat-value">${weekBookings.length}<span class="stat-change">ближайшие 7 дней</span></div><div class="stat-caption">Учитываются все специалисты</div></article>
        <article class="stat-card"><div class="stat-top"><span>Клиенты</span><span class="stat-icon">♧</span></div><div class="stat-value">${uniqueClients}<span class="stat-change">в демо-базе</span></div><div class="stat-caption">Уникальные имена в записях</div></article>
        <article class="stat-card"><div class="stat-top"><span>План на неделю</span><span class="stat-icon">↗</span></div><div class="stat-value">${money(estimated)}</div><div class="stat-caption">Сумма услуг в демо-записях</div></article>
      </div>
      <div class="overview-grid">
        <section class="panel"><div class="panel-head"><div><h3>Ритм недели</h3><p>Распределение записей · демо-данные</p></div><span class="chart-legend"><i></i> записей</span></div><div class="chart">${chartMarkup()}</div></section>
        <section class="panel"><div class="panel-head"><div><h3>Популярные услуги</h3><p>По заполненным демо-записям</p></div><button class="panel-link" type="button" data-view="services">Все услуги →</button></div><div class="popular-list">${popular.map((item) => `<div class="popular-item"><strong>${escapeHTML(item.name)}</strong><span>${item.count} записей</span><div class="popular-track"><i style="width:${Math.round(item.count / maxPopular * 100)}%"></i></div></div>`).join("") || `<div class="empty-state">Добавьте услуги, чтобы увидеть список.</div>`}</div></section>
      </div>
      <section class="panel table-panel"><div class="panel-head"><div><h3>Ближайшие записи</h3><p>Предстоящие визиты студии</p></div><button class="panel-link" type="button" data-view="appointments">Все записи →</button></div>${renderBookingTable(upcoming, false)}</section>`;
  }
  function renderBookingTable(items, actions = true) {
    if (!items.length) return `<div class="empty-state"><strong>Записей пока нет</strong>Когда появится новая запись, она отобразится здесь.</div>`;
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>КЛИЕНТ</th><th>УСЛУГА</th><th>СПЕЦИАЛИСТ</th><th>ДАТА И ВРЕМЯ</th><th>СТОИМОСТЬ</th><th>СТАТУС</th>${actions ? "<th></th>" : ""}</tr></thead><tbody>${items.map((item) => {
      const service = bookingService(item); const staff = teamById(item.teamId);
      return `<tr><td data-label="Клиент"><div class="client-cell">${avatar(item.client, staff.tone)}<span>${escapeHTML(item.client)}</span></div></td><td data-label="Услуга">${escapeHTML(service.name)}</td><td data-label="Специалист">${escapeHTML(staff.name)}</td><td data-label="Дата и время">${escapeHTML(formatDate(item.date, { day: "numeric", month: "short" }))} · ${escapeHTML(formatTime(item.time))}</td><td data-label="Стоимость">${money(service.price)}</td><td data-label="Статус">${statusBadge(item.status)}</td>${actions ? `<td data-label="Действие"><button class="row-button" type="button" data-booking-details="${escapeHTML(item.id)}">Открыть запись</button></td>` : ""}</tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function renderAppointments() {
    const query = document.querySelector("[data-appointment-search]")?.value || "";
    const status = document.querySelector("[data-appointment-filter]")?.value || "all";
    const normalized = query.toLocaleLowerCase("ru-RU").trim();
    const items = data.bookings.filter((item) => {
      const match = !normalized || [item.client, item.phone, bookingService(item).name, teamById(item.teamId).name].some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
      return match && (status === "all" || item.status === status);
    }).sort((a, b) => {
      if (appointmentSort === "date-desc") return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
      if (appointmentSort === "price-asc") return bookingService(a).price - bookingService(b).price;
      if (appointmentSort === "price-desc") return bookingService(b).price - bookingService(a).price;
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
    root.innerHTML = `<div class="view-heading"><div><h2>Записи</h2><p>Все визиты и их текущий статус</p></div><button class="button button--quiet button--small" type="button" data-action="new-booking">＋ Новая запись</button></div>
      <div class="filter-row"><input class="search-control" type="search" placeholder="Клиент, услуга или специалист" aria-label="Поиск записей" data-appointment-search value="${escapeHTML(query)}"><select class="select-control" aria-label="Фильтр по статусу" data-appointment-filter><option value="all" ${status === "all" ? "selected" : ""}>Все статусы</option><option value="confirmed" ${status === "confirmed" ? "selected" : ""}>Подтверждена</option><option value="pending" ${status === "pending" ? "selected" : ""}>Ожидает</option><option value="completed" ${status === "completed" ? "selected" : ""}>Завершена</option><option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Отменена</option></select><select class="select-control" aria-label="Сортировка записей" data-appointment-sort><option value="date-asc" ${appointmentSort === "date-asc" ? "selected" : ""}>Сначала ближайшие</option><option value="date-desc" ${appointmentSort === "date-desc" ? "selected" : ""}>Сначала поздние</option><option value="price-asc" ${appointmentSort === "price-asc" ? "selected" : ""}>Сначала дешевле</option><option value="price-desc" ${appointmentSort === "price-desc" ? "selected" : ""}>Сначала дороже</option></select><span class="filter-count">${items.length} ${plural(items.length, "запись", "записи", "записей")}</span></div>
      <section class="panel table-panel">${renderBookingTable(items)}</section>`;
  }
  function plural(number, one, few, many) {
    const n = Math.abs(number) % 100; const last = n % 10;
    if (n > 10 && n < 20) return many; if (last > 1 && last < 5) return few; if (last === 1) return one; return many;
  }

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  function calendarMonthMarkup() {
    const first = monthStart(calendarMonth);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const count = Math.ceil((offset + daysInMonth) / 7) * 7;
    const keys = Array.from({ length: count }, (_, i) => localKey(addDays(first, i - offset)));
    return `<div class="calendar-grid">${weekDays.map((day) => `<div class="calendar-day-head">${day}</div>`).join("")}${keys.map((key) => {
      const date = parseDate(key); const muted = date.getMonth() !== calendarMonth.getMonth(); const isToday = key === dateOffset(0);
      const items = data.bookings.filter((item) => item.date === key && item.status !== "cancelled" && (calendarTeamFilter === "all" || item.teamId === calendarTeamFilter)).sort((a, b) => a.time.localeCompare(b.time));
      const visibleItems = items.slice(0, 3);
      const remaining = items.length - visibleItems.length;
      return `<div class="calendar-day ${muted ? "is-muted" : ""} ${isToday ? "is-today" : ""}"><span class="calendar-date">${date.getDate()}</span>${visibleItems.map((item) => `<button class="calendar-event ${eventTone(item.status)}" type="button" data-booking-details="${escapeHTML(item.id)}" title="${escapeHTML(item.client)} · ${escapeHTML(bookingService(item).name)} · ${escapeHTML(statusNames[item.status] || "")}">${escapeHTML(item.time)} ${escapeHTML(item.client.split(" ")[0])}</button>`).join("")}${remaining ? `<button class="calendar-day-more" type="button" data-calendar-more="${key}" aria-label="Показать ещё ${remaining} ${plural(remaining, "запись", "записи", "записей")} за ${escapeHTML(formatDate(key, { day: "numeric", month: "long" }))}">+ ещё ${remaining}</button>` : ""}</div>`;
    }).join("")}</div>`;
  }
  function calendarWeekMarkup() {
    const first = weekStart(calendarFocusDate);
    return `<div class="week-list">${Array.from({ length: 7 }, (_, index) => {
      const date = addDays(first, index); const key = localKey(date);
      const items = data.bookings.filter((item) => item.date === key && item.status !== "cancelled" && (calendarTeamFilter === "all" || item.teamId === calendarTeamFilter)).sort((a, b) => a.time.localeCompare(b.time));
      return `<div class="week-row"><strong>${escapeHTML(formatDate(date, { weekday: "short", day: "numeric", month: "short" }))}</strong><div class="week-row__events">${items.length ? items.map((item) => `<button class="calendar-event ${eventTone(item.status)}" type="button" data-booking-details="${escapeHTML(item.id)}">${escapeHTML(item.time)} · ${escapeHTML(item.client)} · ${escapeHTML(bookingService(item).name)}</button>`).join("") : `<span class="date-label">Свободно</span>`}</div></div>`;
    }).join("")}</div>`;
  }
  function calendarDayMarkup() {
    const key = localKey(calendarFocusDate);
    const staff = data.team.filter((member) => calendarTeamFilter === "all" || member.id === calendarTeamFilter);
    const times = Array.from(new Set(["09:30", "10:30", "11:00", "11:30", "12:30", "13:00", "14:00", "15:00", "16:00", "17:00", ...data.bookings.filter((item) => item.date === key).map((item) => item.time)])).sort();
    const head = `<div class="day-schedule__row day-schedule__row--head" style="--staff-count:${Math.max(staff.length, 1)}"><span>ВРЕМЯ</span>${staff.map((member) => `<span>${escapeHTML(member.name)}</span>`).join("")}</div>`;
    const rows = times.map((time) => `<div class="day-schedule__row" style="--staff-count:${Math.max(staff.length, 1)}"><span class="day-schedule__time">${escapeHTML(time)}</span>${staff.map((member) => {
      const item = data.bookings.find((entry) => entry.date === key && entry.time === time && entry.teamId === member.id && entry.status !== "cancelled");
      return item ? `<button class="day-schedule__event ${eventTone(item.status)}" type="button" data-booking-details="${escapeHTML(item.id)}"><strong>${escapeHTML(item.client)}</strong><small>${escapeHTML(bookingService(item).name)}</small></button>` : `<span class="day-schedule__empty" aria-hidden="true"></span>`;
    }).join("")}</div>`).join("");
    return `<div class="day-schedule-wrap"><div class="day-schedule">${head}${rows}</div></div>`;
  }
  function renderCalendar() {
    const label = calendarLayout === "month" ? formatDate(calendarMonth, { month: "long", year: "numeric" }) : calendarLayout === "day" ? formatDate(calendarFocusDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : `${formatDate(weekStart(calendarFocusDate), { day: "numeric", month: "short" })} — ${formatDate(addDays(weekStart(calendarFocusDate), 6), { day: "numeric", month: "short", year: "numeric" })}`;
    root.innerHTML = `<div class="view-heading"><div><h2>Календарь</h2><p>Расписание специалистов и ближайшие визиты</p></div><div class="heading-actions"><div class="calendar-toolbar"><button class="square-button" type="button" data-calendar-nav="prev" aria-label="Предыдущий период">‹</button><strong>${escapeHTML(label)}</strong><button class="square-button" type="button" data-calendar-nav="next" aria-label="Следующий период">›</button></div><button class="button button--quiet button--small" type="button" data-calendar-nav="today">Сегодня</button></div></div>
      <div class="filter-row"><div class="toggle-group" role="group" aria-label="Вид календаря"><button type="button" data-calendar-layout="month" class="${calendarLayout === "month" ? "is-active" : ""}">Месяц</button><button type="button" data-calendar-layout="week" class="${calendarLayout === "week" ? "is-active" : ""}">Неделя</button><button type="button" data-calendar-layout="day" class="${calendarLayout === "day" ? "is-active" : ""}">День</button></div><select class="select-control" aria-label="Специалист" data-team-filter>${`<option value="all" ${calendarTeamFilter === "all" ? "selected" : ""}>Все специалисты</option>`}${data.team.map((member) => `<option value="${escapeHTML(member.id)}" ${calendarTeamFilter === member.id ? "selected" : ""}>${escapeHTML(member.name)}</option>`).join("")}</select><span class="filter-count">Цвет — статус записи</span></div>
      ${calendarLayout === "month" ? calendarMonthMarkup() : calendarLayout === "day" ? calendarDayMarkup() : calendarWeekMarkup()}`;
  }
  function renderClients() {
    const query = document.querySelector("[data-client-search]")?.value || "";
    const normalized = query.toLocaleLowerCase("ru-RU").trim();
    const clients = new Map();
    data.bookings.filter((item) => item.status !== "cancelled").forEach((item) => {
      const key = item.client.toLocaleLowerCase("ru-RU");
      const record = clients.get(key) || { name: item.client, phone: item.phone, visits: 0, last: item.date, bookings: [] };
      record.visits += item.status === "completed" ? 1 : 0; record.last = item.date > record.last ? item.date : record.last; record.bookings.push(item); clients.set(key, record);
    });
    const rows = Array.from(clients.values()).filter((client) => !normalized || `${client.name} ${client.phone}`.toLocaleLowerCase("ru-RU").includes(normalized)).sort((a, b) => b.last.localeCompare(a.last));
    root.innerHTML = `<div class="view-heading"><div><h2>Клиенты</h2><p>История визитов из демо-записей</p></div><span class="date-label">${rows.length} карточек</span></div><div class="filter-row"><input class="search-control" type="search" placeholder="Имя или телефон" aria-label="Поиск клиентов" data-client-search value="${escapeHTML(query)}"><span class="filter-count">Карточка открывает историю посещений</span></div><div class="client-grid">${rows.length ? rows.map((client, index) => `<button class="client-card" type="button" data-client-name="${escapeHTML(client.name)}"><span class="client-card__top">${`<span class="large-avatar ${colorClasses[index % colorClasses.length]}">${escapeHTML(initials(client.name))}</span>`}<span><strong>${escapeHTML(client.name)}</strong><small>${escapeHTML(client.phone || "Телефон не указан")}</small></span></span><span class="client-card__stats"><span>Визитов <b>${client.visits}</b></span><span>Последний <b>${escapeHTML(formatDate(client.last, { day: "numeric", month: "short" }))}</b></span></span></button>`).join("") : `<div class="empty-state"><strong>Клиенты не найдены</strong>Проверьте имя или очистите поиск.</div>`}</div>`;
  }
  function renderServices() {
    root.innerHTML = `<div class="view-heading"><div><h2>Услуги</h2><p>Стоимость и длительность сеанса</p></div><button class="button button--primary button--small" type="button" data-service-new>＋ Добавить услугу</button></div><div class="service-list">${data.services.length ? data.services.map((service) => `<article class="service-card"><div class="service-title"><span class="service-swatch" style="background:${escapeHTML(service.color || "#bfd2b5")}"></span><span><strong>${escapeHTML(service.name)}</strong><small>${escapeHTML(service.description || "Услуга студии")} · ${Number(service.duration)} минут</small></span></div><strong class="service-card__price">${money(service.price)}</strong><div class="service-card__actions"><button class="row-button" type="button" data-service-edit="${escapeHTML(service.id)}">Изменить</button><button class="row-button" type="button" data-service-delete="${escapeHTML(service.id)}">Удалить</button></div></article>`).join("") : `<div class="empty-state"><strong>Услуг пока нет</strong>Добавьте первую услугу студии.</div>`}</div>`;
  }
  function renderTeam() {
    root.innerHTML = `<div class="view-heading"><div><h2>Команда</h2><p>Специалисты и рабочие дни</p></div></div><div class="team-grid">${data.team.map((member) => `<button class="team-card" type="button" data-team-edit="${escapeHTML(member.id)}"><span class="team-card__top">${staffPortrait(member)}<span><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.role)}</small></span></span><div class="team-role">Рабочие дни: ${escapeHTML(member.days || "по расписанию")}</div><div class="team-card__meta"><span>${data.bookings.filter((item) => item.teamId === member.id && item.status !== "cancelled").length} записей в демо</span><span>Изменить →</span></div></button>`).join("") || `<div class="empty-state"><strong>Команда не добавлена</strong></div>`}</div>`;
  }
  function renderSettings() {
    root.innerHTML = `<div class="view-heading"><div><h2>Настройки</h2><p>Профиль демонстрационной студии</p></div></div><div class="settings-grid"><section class="panel"><div class="panel-head"><div><h3>Основная информация</h3><p>Показывается клиенту в форме записи</p></div></div><form class="settings-form" id="settings-form"><div class="field"><label for="studio-name">Название студии</label><input class="input-control" id="studio-name" name="studioName" value="${escapeHTML(data.studio.name)}" maxlength="48" required></div><div class="field"><label for="studio-address">Город и адрес</label><input class="input-control" id="studio-address" name="studioAddress" value="${escapeHTML(data.studio.address)}" maxlength="72" required></div><button class="button button--primary" type="submit">Сохранить изменения</button></form><div class="settings-danger"><h3>Данные демонстрации</h3><p>Вернуть начальные записи, услуги и команду на этом устройстве.</p><button class="button button--quiet button--small" type="button" data-reset-demo>Сбросить демо-данные</button></div></section><div><div class="settings-notice"><strong>Режим демонстрации</strong>Это концепт продукта. Реальные клиенты не получат уведомления, а данные останутся только в локальном хранилище этого браузера.</div><section class="panel" style="margin-top:12px"><div class="panel-head"><div><h3>Как это устроено</h3><p>Без сервера и внешних интеграций</p></div></div><p style="margin:0;color:#777d72;font-size:10px;line-height:1.7">Форма записи и изменения панели работают в браузере. Перезагрузка страницы не стирает сохранённые демо-записи.</p></section></div></div>`;
  }
  function renderView() {
    if (mode === "booking") { renderBooking(); return; }
    const renderers = { overview: renderOverview, calendar: renderCalendar, appointments: renderAppointments, clients: renderClients, services: renderServices, team: renderTeam, settings: renderSettings };
    (renderers[view] || renderOverview)();
    updateChrome();
  }

  function setMode(nextMode, resetBooking = false) {
    mode = nextMode;
    if (nextMode === "booking" && resetBooking) booking = { step: 0, serviceId: "", teamId: "", date: "", time: "", name: "", phone: "", email: "" };
    document.querySelectorAll("[data-mode]").forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active));
    });
    frame.classList.toggle("is-booking", mode === "booking");
    renderView();
    if (mode === "booking") document.getElementById("booking-title")?.focus({ preventScroll: true });
  }
  function setView(nextView) {
    view = nextView;
    mode = "dashboard";
    frame.classList.remove("is-booking");
    document.querySelectorAll("[data-mode]").forEach((button) => { const active = button.dataset.mode === "dashboard"; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.view === view));
    const labels = { overview: "Обзор", calendar: "Календарь", appointments: "Записи", clients: "Клиенты", services: "Услуги", team: "Команда", settings: "Настройки" };
    document.querySelectorAll("[data-breadcrumb]").forEach((el) => { el.textContent = labels[view] || "Обзор"; });
    renderView();
  }

  function bookingCalendar() {
    const today = startOfDay(new Date()); const first = monthStart(calendarMonth); const offset = (first.getDay() + 6) % 7;
    const cells = Array.from({ length: 42 }, (_, index) => addDays(first, index - offset));
    return `<div class="calendar-picker"><div class="picker-head"><button class="square-button" type="button" data-booking-month="prev" aria-label="Предыдущий месяц">‹</button><strong>${escapeHTML(formatDate(calendarMonth, { month: "long", year: "numeric" }))}</strong><button class="square-button" type="button" data-booking-month="next" aria-label="Следующий месяц">›</button></div><div class="picker-days">${weekDays.map((day) => `<span>${day}</span>`).join("")}</div><div class="picker-dates">${cells.map((date) => {
      const key = localKey(date); const out = date.getMonth() !== calendarMonth.getMonth(); const disabled = date < today || (booking.teamId && !data.team.some((member) => member.id === booking.teamId));
      return `<button class="picker-date ${out ? "is-out" : ""} ${key === dateOffset(0) ? "is-today" : ""} ${key === booking.date ? "is-selected" : ""}" type="button" data-booking-date="${key}" ${disabled ? "disabled" : ""}>${date.getDate()}</button>`;
    }).join("")}</div></div>`;
  }
  function availableSlots() {
    if (!booking.date) return [];
    const options = ["09:30", "10:30", "11:30", "13:00", "14:00", "15:00", "16:00", "17:00"];
    const used = data.bookings.filter((item) => item.date === booking.date && item.status !== "cancelled" && (!booking.teamId || item.teamId === booking.teamId)).map((item) => item.time);
    return options.filter((time) => !used.includes(time));
  }
  function bookingStepContent() {
    if (booking.step === 0) return `<div class="booking-home"><div class="booking-home-hero"><div class="booking-home-copy"><p class="eyebrow">FORMA STUDIO · ВОРОНЕЖ</p><h2 id="booking-title" tabindex="-1">Ваше время.<br>Ваши правила.</h2><p>Стрижки и уход в спокойном ритме. Выберите специалиста и время онлайн — без ожидания ответа.</p><button class="button button--primary" type="button" data-booking-start>Выбрать услугу <span aria-hidden="true">→</span></button></div><div class="booking-home-note"><span class="booking-home-note__number">01</span><span class="booking-home-note__line"></span><strong>Свободный слот<br>на этой неделе</strong><small>Пн–Вс · 10:00–20:00</small></div></div><div class="booking-home-lower"><section><div class="booking-home-heading"><h3>Популярные услуги</h3><span>длительность · цена</span></div><div class="home-service-grid">${data.services.slice(0, 4).map((service) => `<div class="home-service"><span>${escapeHTML(service.name)}</span><small>${Number(service.duration)} мин · ${money(service.price)}</small></div>`).join("")}</div></section><section><div class="booking-home-heading"><h3>Команда</h3><span>специалисты студии</span></div><div class="home-team">${data.team.map((member) => `<div class="home-person">${staffPortrait(member)}<span><strong>${escapeHTML(member.name.split(" ")[0])}</strong><small>${escapeHTML(member.role.split(" · ")[0])}</small></span></div>`).join("")}</div></section></div><div class="booking-home-footer"><span>⌖ ${escapeHTML(data.studio.address)}</span><span>✉ hello@forma-demo.example · демо-контакт</span><span>Демо-запись · безопасно и бесплатно</span></div></div>`;
    if (booking.step === 1) return `<h2 id="booking-title" tabindex="-1">Что будем делать?</h2><p class="booking-subtitle">Выберите услугу — длительность и стоимость указаны сразу.</p><div class="booking-services">${data.services.map((service) => `<button class="booking-service ${booking.serviceId === service.id ? "is-selected" : ""}" type="button" data-booking-service="${escapeHTML(service.id)}"><span class="service-check" aria-hidden="true">✓</span><span class="booking-service__info"><strong>${escapeHTML(service.name)}</strong><small>${escapeHTML(service.description || "Услуга студии")} · ${Number(service.duration)} минут</small></span><span class="booking-service__price">${money(service.price)}</span></button>`).join("") || `<div class="empty-state">Студия пока не добавила услуги.</div>`}</div>`;
    if (booking.step === 2) return `<h2 id="booking-title" tabindex="-1">Выберите специалиста</h2><p class="booking-subtitle">Кто будет заниматься вашим визитом?</p><div class="booking-people">${data.team.map((member) => `<button class="booking-person ${booking.teamId === member.id ? "is-selected" : ""}" type="button" data-booking-team="${escapeHTML(member.id)}">${staffPortrait(member)}<span><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.role)}</small></span><span class="service-check" aria-hidden="true">✓</span></button>`).join("") || `<div class="empty-state">Сейчас нет доступных специалистов.</div>`}</div>`;
    if (booking.step === 3) return `<h2 id="booking-title" tabindex="-1">Когда вам удобно?</h2><p class="booking-subtitle">Свободные даты отмечены календарём. Выберите подходящий день.</p>${bookingCalendar()}`;
    if (booking.step === 4) return `<h2 id="booking-title" tabindex="-1">Выберите время</h2><p class="booking-subtitle">${booking.date ? `${escapeHTML(formatDate(booking.date, { weekday: "long", day: "numeric", month: "long" }))} · ${escapeHTML(teamById(booking.teamId).name)}` : "Сначала выберите дату."}</p><div class="slot-grid">${availableSlots().map((time) => `<button class="time-slot ${booking.time === time ? "is-selected" : ""}" type="button" data-booking-time="${time}">${time}</button>`).join("") || `<div class="empty-state" style="grid-column:1/-1">На эту дату всё занято. Выберите другой день.</div>`}</div>`;
    if (booking.step === 5) return `<h2 id="booking-title" tabindex="-1">Как с вами связаться?</h2><p class="booking-subtitle">Оставьте контактные данные, чтобы завершить демонстрационную запись.</p><form class="booking-form" id="booking-form" novalidate><div class="field"><label for="booking-name">Имя</label><input class="input-control" id="booking-name" name="name" autocomplete="name" maxlength="60" value="${escapeHTML(booking.name)}" required></div><div class="field"><label for="booking-phone">Телефон</label><input class="input-control" id="booking-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 900 000-00-00" maxlength="24" value="${escapeHTML(booking.phone)}" required></div><div class="field"><label for="booking-email">Email <span style="color:#9da298;font-weight:400">необязательно</span></label><input class="input-control" id="booking-email" name="email" type="email" autocomplete="email" maxlength="100" placeholder="name@example.ru" value="${escapeHTML(booking.email)}"></div><p class="booking-error" data-booking-error role="alert"></p></form>`;
    const service = serviceById(booking.serviceId);
    return `<div class="booking-success"><span class="success-mark" aria-hidden="true">✓</span><h2 id="booking-title" tabindex="-1">Вы записаны</h2><p>Демо-запись сохранена в браузере и появилась в панели студии.</p><div class="confirmation-card"><div class="confirmation-row"><span>Услуга</span><strong>${escapeHTML(service.name)}</strong></div><div class="confirmation-row"><span>Специалист</span><strong>${escapeHTML(teamById(booking.teamId).name)}</strong></div><div class="confirmation-row"><span>Дата и время</span><strong>${escapeHTML(formatDate(booking.date, { day: "numeric", month: "long" }))}, ${escapeHTML(booking.time)}</strong></div><div class="confirmation-row"><span>Стоимость</span><strong>${money(service.price)}</strong></div></div><button class="button button--primary" type="button" data-action="back-to-dashboard">Посмотреть панель</button></div>`;
  }
  function renderBooking() {
    const labels = ["Услуга", "Специалист", "Дата", "Время", "Контакты"];
    const progress = labels.map((label, index) => `<span class="progress-step ${booking.step > index + 1 ? "is-done" : booking.step === index + 1 ? "is-active" : ""}"></span>`).join("");
    const actions = booking.step > 0 && booking.step < 5 ? `<div class="booking-actions">${booking.step > 1 ? `<button class="button button--quiet" type="button" data-booking-back>Назад</button>` : `<button class="button button--quiet" type="button" data-booking-home>К студии</button>`}<button class="button button--primary" type="button" data-booking-next ${!bookingCanContinue() ? "disabled" : ""}>${booking.step === 4 ? "Продолжить" : "Далее"} <span aria-hidden="true">→</span></button></div>` : booking.step === 5 ? `<div class="booking-actions"><button class="button button--quiet" type="button" data-booking-back>Назад</button><button class="button button--primary" type="submit" form="booking-form">Подтвердить запись <span aria-hidden="true">→</span></button></div>` : "";
    root.innerHTML = `<div class="booking-shell"><div class="booking-brand"><span class="studio-avatar" aria-hidden="true">F</span><span><strong>${escapeHTML(data.studio.name)}</strong><small>Барбершоп и студия ухода</small></span><span class="booking-address">${escapeHTML(data.studio.address)}<br>Ежедневно · 10:00–20:00</span></div>${booking.step > 0 && booking.step < 6 ? `<div class="booking-progress" aria-label="Шаг ${booking.step} из 5">${progress}</div><div class="booking-step-label"><span>${escapeHTML(labels[Math.max(0, booking.step - 1)])}</span><span>Шаг ${booking.step} из 5</span></div>` : ""}${bookingStepContent()}${actions}</div>`;
  }
  function bookingCanContinue() {
    if (booking.step === 1) return Boolean(booking.serviceId);
    if (booking.step === 2) return Boolean(booking.teamId);
    if (booking.step === 3) return Boolean(booking.date);
    if (booking.step === 4) return Boolean(booking.time);
    return false;
  }
  function submitBooking() {
    const form = document.getElementById("booking-form"); if (!form) return;
    const fields = new FormData(form); booking.name = String(fields.get("name") || "").trim(); booking.phone = String(fields.get("phone") || "").trim(); booking.email = String(fields.get("email") || "").trim();
    const error = document.querySelector("[data-booking-error]");
    const phoneDigits = booking.phone.replace(/\D/g, "");
    if (booking.name.length < 2) { error.textContent = "Введите имя не короче двух символов."; document.getElementById("booking-name").focus(); return; }
    if (phoneDigits.length < 10) { error.textContent = "Проверьте номер телефона — нужно не менее 10 цифр."; document.getElementById("booking-phone").focus(); return; }
    if (booking.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) { error.textContent = "Проверьте адрес электронной почты."; document.getElementById("booking-email").focus(); return; }
    const service = serviceById(booking.serviceId);
    const record = { id: uid("booking"), client: booking.name, phone: booking.phone, email: booking.email, serviceId: booking.serviceId, serviceName: service.name, servicePrice: service.price, serviceDuration: service.duration, teamId: booking.teamId, date: booking.date, time: booking.time, status: "confirmed", source: "Онлайн-запись" };
    data.bookings.push(record); lastBookingId = record.id; saveState(); booking.step = 6; renderBooking(); document.getElementById("booking-title")?.focus({ preventScroll: true }); toast("Демо-запись добавлена в расписание.");
  }

  function openDialog(title, subtitle, body, footer = "") {
    dialog.innerHTML = `<div class="dialog__head"><div><h2 id="dialog-title">${escapeHTML(title)}</h2>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div><button class="dialog__close" type="button" data-dialog-close aria-label="Закрыть">×</button></div><div class="dialog__body">${body}</div>${footer ? `<div class="dialog__foot">${footer}</div>` : ""}`;
    if (typeof dialog.showModal === "function") { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute("open", "");
    dialog.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
  }
  function closeDialog() { if (dialog.open && dialog.close) dialog.close(); else dialog.removeAttribute("open"); }
  function showBookingDetails(id) {
    const item = data.bookings.find((entry) => entry.id === id); if (!item) return;
    openDialog(item.client, `${formatDate(item.date, { day: "numeric", month: "long", year: "numeric" })} · ${item.time}`, bookingSummary(item), `<div class="left-actions"><button class="button button--danger button--small" type="button" data-booking-cancel="${escapeHTML(id)}">${item.status === "cancelled" ? "Уже отменена" : "Отменить"}</button><button class="button button--quiet button--small" type="button" data-booking-delete="${escapeHTML(id)}">Удалить</button></div><div class="right-actions"><button class="button button--quiet button--small" type="button" data-status-cycle="${escapeHTML(id)}">Изменить статус</button><button class="button button--primary button--small" type="button" data-dialog-close>Готово</button></div>`);
  }
  function serviceFormMarkup(service = {}) {
    return `<form class="settings-form" id="service-form"><input type="hidden" name="id" value="${escapeHTML(service.id || "")}"><div class="field"><label for="service-name">Название</label><input class="input-control" id="service-name" name="name" value="${escapeHTML(service.name || "")}" maxlength="48" required></div><div class="field"><label for="service-description">Короткое описание</label><input class="input-control" id="service-description" name="description" value="${escapeHTML(service.description || "")}" maxlength="72"></div><div class="booking-form"><div class="field"><label for="service-duration">Длительность, минут</label><input class="input-control" id="service-duration" name="duration" type="number" min="10" max="360" step="5" value="${Number(service.duration || 60)}" required></div><div class="field"><label for="service-price">Стоимость, ₽</label><input class="input-control" id="service-price" name="price" type="number" min="0" max="999999" step="100" value="${Number(service.price || 0)}" required></div></div><p class="dialog-error" data-dialog-error role="alert"></p></form>`;
  }
  function openServiceForm(id = "") {
    const service = data.services.find((item) => item.id === id) || {};
    openDialog(id ? "Изменить услугу" : "Новая услуга", "Изменения сразу появятся в форме клиентской записи.", serviceFormMarkup(service), `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Отмена</button><button class="button button--primary button--small" type="button" data-service-save>Сохранить</button></div>`);
    document.getElementById("service-name")?.focus({ preventScroll: true });
  }
  function saveServiceForm() {
    const form = document.getElementById("service-form"); if (!form) return;
    const fields = new FormData(form); const name = String(fields.get("name") || "").trim(); const duration = Number(fields.get("duration")); const price = Number(fields.get("price")); const error = document.querySelector("[data-dialog-error]");
    if (name.length < 2 || duration < 10 || duration > 360 || price < 0) { if (error) error.textContent = "Проверьте название, длительность и стоимость услуги."; return; }
    const id = String(fields.get("id") || "") || uid("service"); const existing = data.services.find((item) => item.id === id);
    const next = { id, name, description: String(fields.get("description") || "").trim(), duration, price, color: existing?.color || ["#91ad83", "#d9ad67", "#7791b2", "#c98e88"][data.services.length % 4] };
    if (existing) Object.assign(existing, next); else data.services.push(next); saveState(); closeDialog(); renderView(); toast(existing ? "Услуга обновлена." : "Услуга добавлена.");
  }
  function openTeamForm(id) {
    const member = data.team.find((item) => item.id === id); if (!member) return;
    const body = `<form class="settings-form" id="team-form"><input type="hidden" name="id" value="${escapeHTML(member.id)}"><div class="field"><label for="team-name">Имя</label><input class="input-control" id="team-name" name="name" value="${escapeHTML(member.name)}" maxlength="48" required></div><div class="field"><label for="team-role">Специализация</label><input class="input-control" id="team-role" name="role" value="${escapeHTML(member.role)}" maxlength="60" required></div><div class="field"><label for="team-days">Рабочие дни</label><input class="input-control" id="team-days" name="days" value="${escapeHTML(member.days || "")}" maxlength="48" required></div></form>`;
    openDialog("Профиль специалиста", "Демо-профиль команды студии.", body, `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Отмена</button><button class="button button--primary button--small" type="button" data-team-save>Сохранить</button></div>`);
  }
  function saveTeamForm() {
    const form = document.getElementById("team-form"); if (!form) return;
    const fields = new FormData(form); const member = data.team.find((item) => item.id === fields.get("id")); if (!member) return;
    member.name = String(fields.get("name") || "").trim(); member.role = String(fields.get("role") || "").trim(); member.days = String(fields.get("days") || "").trim(); member.initials = initials(member.name); saveState(); closeDialog(); renderView(); toast("Профиль специалиста обновлён.");
  }
  function showClientDetails(name) {
    const items = data.bookings.filter((item) => item.client.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU")).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    const recent = items[0];
    const rows = items.length ? items.map((item) => `<div class="history-item"><span>${escapeHTML(formatDate(item.date, { day: "numeric", month: "short", year: "numeric" }))} · ${escapeHTML(item.time)}<br>${escapeHTML(bookingService(item).name)} · ${money(bookingService(item).price)}</span>${statusBadge(item.status)}</div>`).join("") : `<div class="empty-state">История пуста.</div>`;
    openDialog(name, recent?.phone || "Демо-карточка клиента", `<div class="detail-list"><div class="confirmation-row"><span>Посещений</span><strong>${items.filter((item) => item.status === "completed").length}</strong></div><div class="confirmation-row"><span>Последний визит</span><strong>${recent ? escapeHTML(formatDate(recent.date, { day: "numeric", month: "long" })) : "—"}</strong></div></div><div class="history-list">${rows}</div>`, `<span></span><div class="right-actions"><button class="button button--primary button--small" type="button" data-dialog-close>Закрыть</button></div>`);
  }
  function toast(message) {
    const region = document.querySelector(".toast-region"); const item = document.createElement("div"); item.className = "toast"; item.textContent = message; region.appendChild(item); setTimeout(() => item.remove(), 3300);
  }

  document.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) { setMode(modeButton.dataset.mode, modeButton.dataset.mode === "booking"); return; }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { setView(viewButton.dataset.view); return; }
    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "new-booking") setMode("booking", true);
      if (action.dataset.action === "back-to-dashboard") setView("overview");
      if (action.dataset.action === "notifications") toast("Новых уведомлений нет.");
      return;
    }
    if (event.target.closest("[data-dialog-close]")) { closeDialog(); return; }
    const serviceChoice = event.target.closest("[data-booking-service]");
    if (serviceChoice) { booking.serviceId = serviceChoice.dataset.bookingService; renderBooking(); return; }
    const staffChoice = event.target.closest("[data-booking-team]");
    if (staffChoice) { booking.teamId = staffChoice.dataset.bookingTeam; renderBooking(); return; }
    const dateChoice = event.target.closest("[data-booking-date]");
    if (dateChoice && !dateChoice.disabled) { booking.date = dateChoice.dataset.bookingDate; booking.time = ""; renderBooking(); return; }
    const timeChoice = event.target.closest("[data-booking-time]");
    if (timeChoice) { booking.time = timeChoice.dataset.bookingTime; renderBooking(); return; }
    if (event.target.closest("[data-booking-start]")) { booking.step = 1; renderBooking(); document.getElementById("booking-title")?.focus({ preventScroll: true }); return; }
    if (event.target.closest("[data-booking-home]")) { booking.step = 0; renderBooking(); document.getElementById("booking-title")?.focus({ preventScroll: true }); return; }
    if (event.target.closest("[data-booking-next]")) { if (bookingCanContinue()) { booking.step += 1; if (booking.step === 3) calendarMonth = monthStart(new Date()); renderBooking(); document.getElementById("booking-title")?.focus({ preventScroll: true }); } return; }
    if (event.target.closest("[data-booking-back]")) { booking.step = Math.max(1, booking.step - 1); renderBooking(); document.getElementById("booking-title")?.focus({ preventScroll: true }); return; }
    const monthButton = event.target.closest("[data-booking-month]");
    if (monthButton) { calendarMonth.setMonth(calendarMonth.getMonth() + (monthButton.dataset.bookingMonth === "next" ? 1 : -1)); renderBooking(); return; }
    const bookingDetails = event.target.closest("[data-booking-details]");
    if (bookingDetails) { showBookingDetails(bookingDetails.dataset.bookingDetails); return; }
    const clientCard = event.target.closest("[data-client-name]");
    if (clientCard) { showClientDetails(clientCard.dataset.clientName); return; }
    if (event.target.closest("[data-service-new]")) { openServiceForm(); return; }
    if (event.target.closest("[data-service-save]")) { saveServiceForm(); return; }
    const serviceEdit = event.target.closest("[data-service-edit]");
    if (serviceEdit) { openServiceForm(serviceEdit.dataset.serviceEdit); return; }
    const serviceDelete = event.target.closest("[data-service-delete]");
    if (serviceDelete) {
      const service = serviceById(serviceDelete.dataset.serviceDelete);
      openDialog("Удалить услугу?", service.name, `<p style="margin:0;color:#777d72;font-size:11px;line-height:1.7">Старые записи останутся в истории. Услуга исчезнет из формы новой записи.</p>`, `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Оставить</button><button class="button button--danger button--small" type="button" data-service-confirm-delete="${escapeHTML(serviceDelete.dataset.serviceDelete)}">Удалить услугу</button></div>`); return;
    }
    const serviceDeleteConfirm = event.target.closest("[data-service-confirm-delete]");
    if (serviceDeleteConfirm) { data.services = data.services.filter((item) => item.id !== serviceDeleteConfirm.dataset.serviceConfirmDelete); saveState(); closeDialog(); renderView(); toast("Услуга удалена."); return; }
    const teamEdit = event.target.closest("[data-team-edit]");
    if (teamEdit) { openTeamForm(teamEdit.dataset.teamEdit); return; }
    if (event.target.closest("[data-team-save]")) { saveTeamForm(); return; }
    const calendarNav = event.target.closest("[data-calendar-nav]");
    if (calendarNav) {
      if (calendarNav.dataset.calendarNav === "today") { calendarFocusDate = startOfDay(new Date()); calendarMonth = monthStart(new Date()); }
      else if (calendarLayout === "month") calendarMonth.setMonth(calendarMonth.getMonth() + (calendarNav.dataset.calendarNav === "next" ? 1 : -1));
      else calendarFocusDate = addDays(calendarFocusDate, calendarNav.dataset.calendarNav === "next" ? (calendarLayout === "day" ? 1 : 7) : (calendarLayout === "day" ? -1 : -7));
      renderCalendar(); return;
    }
    const layoutButton = event.target.closest("[data-calendar-layout]");
    if (layoutButton) { calendarLayout = layoutButton.dataset.calendarLayout; renderCalendar(); return; }
    const calendarMore = event.target.closest("[data-calendar-more]");
    if (calendarMore) { calendarFocusDate = parseDate(calendarMore.dataset.calendarMore); calendarLayout = "day"; renderCalendar(); return; }
    const cancelButton = event.target.closest("[data-booking-cancel]");
    if (cancelButton) {
      const item = data.bookings.find((entry) => entry.id === cancelButton.dataset.bookingCancel);
      if (item && cancelButton.dataset.confirm === "1") { item.status = "cancelled"; saveState(); closeDialog(); renderView(); toast("Запись отменена."); }
      else if (item) openDialog("Отменить запись?", `${item.client} · ${formatDate(item.date, { day: "numeric", month: "long" })}, ${item.time}`, `<p style="margin:0;color:#777d72;font-size:11px;line-height:1.7">Запись останется в истории со статусом «Отменена».</p>`, `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Назад</button><button class="button button--danger button--small" type="button" data-booking-cancel="${escapeHTML(item.id)}" data-confirm="1">Отменить запись</button></div>`);
      return;
    }
    const deleteButton = event.target.closest("[data-booking-delete]");
    if (deleteButton) {
      const id = deleteButton.dataset.bookingDelete; const item = data.bookings.find((entry) => entry.id === id);
      if (item && deleteButton.dataset.confirm === "1") { data.bookings = data.bookings.filter((entry) => entry.id !== id); saveState(); closeDialog(); renderView(); toast("Запись удалена из демо-расписания."); }
      else if (item) openDialog("Удалить запись?", `${item.client} · ${formatDate(item.date, { day: "numeric", month: "long" })}`, `<p style="margin:0;color:#777d72;font-size:11px;line-height:1.7">Запись будет удалена из демо-расписания и истории.</p>`, `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Назад</button><button class="button button--danger button--small" type="button" data-booking-delete="${escapeHTML(item.id)}" data-confirm="1">Удалить запись</button></div>`);
      return;
    }
    const statusButton = event.target.closest("[data-status-cycle]");
    if (statusButton) {
      const item = data.bookings.find((entry) => entry.id === statusButton.dataset.statusCycle);
      if (item) { const order = ["confirmed", "pending", "completed", "cancelled"]; item.status = order[(order.indexOf(item.status) + 1) % order.length]; saveState(); showBookingDetails(item.id); renderView(); toast(`Статус изменён: ${statusNames[item.status].toLowerCase()}.`); }
      return;
    }
    const reset = event.target.closest("[data-reset-demo]");
    if (reset) { openDialog("Сбросить демо-данные?", "Начальные данные восстановятся на этом устройстве.", `<p style="margin:0;color:#777d72;font-size:11px;line-height:1.7">Созданные записи, услуги и изменения команды будут заменены исходным демонстрационным набором.</p>`, `<span></span><div class="right-actions"><button class="button button--quiet button--small" type="button" data-dialog-close>Отмена</button><button class="button button--danger button--small" type="button" data-reset-confirm>Сбросить</button></div>`); return; }
    if (event.target.closest("[data-reset-confirm]")) { localStorage.removeItem(STORAGE_KEY); data = makeSeed(); saveState(); closeDialog(); renderView(); toast("Исходные демо-данные восстановлены."); return; }
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-appointment-search], [data-client-search]")) return;
    const selector = event.target.matches("[data-appointment-search]") ? "[data-appointment-search]" : "[data-client-search]";
    const value = event.target.value; const position = event.target.selectionStart;
    renderView(); const field = document.querySelector(selector); if (field) { field.focus({ preventScroll: true }); field.setSelectionRange(position, position); }
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-appointment-filter]")) renderAppointments();
    if (event.target.matches("[data-appointment-sort]")) { appointmentSort = event.target.value; renderAppointments(); }
    if (event.target.matches("[data-team-filter]")) {
      calendarTeamFilter = event.target.value; renderCalendar();
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "booking-form") { event.preventDefault(); submitBooking(); return; }
    if (event.target.id === "service-form") {
      event.preventDefault(); saveServiceForm(); return;
    }
    if (event.target.id === "team-form") {
      event.preventDefault(); saveTeamForm(); return;
    }
    if (event.target.id === "settings-form") {
      event.preventDefault(); const fields = new FormData(event.target); data.studio.name = String(fields.get("studioName") || "").trim(); data.studio.address = String(fields.get("studioAddress") || "").trim(); saveState(); renderView(); toast("Информация о студии сохранена.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog.open) closeDialog();
  });
  updateChrome();
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (params.get("capture") === "1") document.body.classList.add("capture-mode");
  if (params.get("mode") === "booking") setMode("booking");
  else setView(["overview", "calendar", "appointments", "clients", "services", "team", "settings"].includes(requestedView) ? requestedView : "overview");
})();
