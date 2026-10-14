/**
 * Expense tracker page.
 * One in-memory array is the source of truth. render() redraws the summary,
 * category chart, and table whenever that array or the filters change.
 */

let transactions = [];

/** Filters never write back into `transactions`. They only narrow the table. */
const filters = {
  type: "all",
  category: "all",
  search: "",
};

const form = document.querySelector("#transaction-form");
const formError = document.querySelector("#form-error");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const dateInput = document.querySelector("#date");
const categoryInput = document.querySelector("#category");
const totalIncomeEl = document.querySelector("#total-income");
const totalExpensesEl = document.querySelector("#total-expenses");
const balanceEl = document.querySelector("#balance");
const balanceCard = document.querySelector("#balance-card");
const balanceStatus = document.querySelector("#balance-status");
const chartEl = document.querySelector("#category-chart");
const categoryFilter = document.querySelector("#category-filter");
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const noMatches = document.querySelector("#no-matches");
const tableWrap = document.querySelector("#table-wrap");
const transactionRows = document.querySelector("#transaction-rows");
const resultCount = document.querySelector("#result-count");

/** null means the chart has not been drawn yet. */
let chartSignature = null;
let categoryOptionsSignature = "";

function getVisibleTransactions() {
  const query = filters.search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const matchesType = filters.type === "all" || transaction.type === filters.type;
    const matchesCategory = filters.category === "all" || transaction.category === filters.category;
    const matchesSearch = query === "" || transaction.description.toLowerCase().includes(query);
    return matchesType && matchesCategory && matchesSearch;
  });
}

function sortNewestFirst(list) {
  return list.slice().sort((a, b) => {
    if (a.date !== b.date) return b.date < a.date ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function render() {
  renderSummary(Ledger.calculateTotals(transactions));
  renderChart();
  renderCategoryFilter();
  renderTypeFilters();
  renderTable();
}

function showMoney(element, amount) {
  const full = Ledger.money.format(amount);
  element.textContent = Ledger.formatMoney(amount);
  element.title = full;
  element.setAttribute("aria-label", full);
}

function renderSummary(totals) {
  showMoney(totalIncomeEl, totals.income);
  showMoney(totalExpensesEl, totals.expenses);
  showMoney(balanceEl, totals.balance);

  balanceCard.classList.remove("is-positive", "is-negative");
  if (totals.balance > 0) balanceCard.classList.add("is-positive");
  if (totals.balance < 0) balanceCard.classList.add("is-negative");
}

/** Spoken after add/delete. Cleared first so a repeated balance is announced again. */
function announceBalance(totals) {
  const message = `Remaining balance ${Ledger.money.format(totals.balance)}.`;
  balanceStatus.textContent = "";
  window.setTimeout(() => {
    balanceStatus.textContent = message;
  }, 30);
}

function renderChart() {
  const groups = Ledger.groupExpensesByCategory(transactions);
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const signature = entries.map(([category, amount]) => `${category}:${amount}`).join("|");

  if (signature === chartSignature) return;
  chartSignature = signature;

  if (entries.length === 0) {
    chartEl.innerHTML =
      '<p class="empty-copy">Expenses you add will show up here, grouped by category. That split is how you see which costs stand between you and a goal.</p>';
    return;
  }

  chartEl.innerHTML = entries
    .map(([category, amount]) => {
      const percent = total === 0 ? 0 : (amount / total) * 100;
      const label = `${category}, ${Ledger.money.format(amount)}, ${Math.round(percent)} percent of expenses`;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <span>${Ledger.escapeHtml(category)}</span>
            <span title="${Ledger.escapeHtml(Ledger.money.format(amount))}">${Ledger.escapeHtml(Ledger.formatMoney(amount))} · ${Math.round(percent)}%</span>
          </div>
          <div class="bar-track" role="img" aria-label="${Ledger.escapeHtml(label)}">
            <div class="bar-fill" data-width="${percent}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const fills = chartEl.querySelectorAll(".bar-fill");
  requestAnimationFrame(() => {
    fills.forEach((fill) => {
      fill.style.width = fill.dataset.width;
    });
  });
}

function renderCategoryFilter() {
  const used = Array.from(new Set(transactions.map((transaction) => transaction.category))).sort();
  if (filters.category !== "all" && !used.includes(filters.category)) filters.category = "all";

  const signature = used.join("|");
  if (signature !== categoryOptionsSignature) {
    categoryOptionsSignature = signature;
    const options = ['<option value="all">All categories</option>'].concat(
      used.map(
        (category) =>
          `<option value="${Ledger.escapeHtml(category)}">${Ledger.escapeHtml(category)}</option>`
      )
    );
    categoryFilter.innerHTML = options.join("");
  }

  if (categoryFilter.value !== filters.category) categoryFilter.value = filters.category;
}

function renderTypeFilters() {
  document.querySelectorAll("[data-filter-type]").forEach((button) => {
    const active = button.dataset.filterType === filters.type;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderTable() {
  const visible = sortNewestFirst(getVisibleTransactions());
  const hasAny = transactions.length > 0;

  emptyState.hidden = hasAny;
  noMatches.hidden = !hasAny || visible.length > 0;
  tableWrap.hidden = visible.length === 0;
  resultCount.textContent = hasAny ? `Showing ${visible.length} of ${transactions.length}` : "";

  transactionRows.innerHTML = visible.map(renderRow).join("");
}

function renderRow(transaction) {
  const sign = transaction.type === "income" ? "+" : "−";
  const typeLabel = transaction.type === "income" ? "Income" : "Expense";

  return `
    <tr>
      <td>
        <span class="cell-label">Date</span>
        <span>${Ledger.escapeHtml(Ledger.formatDate(transaction.date))}</span>
      </td>
      <td>
        <span class="cell-label">Description</span>
        <span>${Ledger.escapeHtml(transaction.description)}</span>
      </td>
      <td>
        <span class="cell-label">Category</span>
        <span>${Ledger.escapeHtml(transaction.category)}</span>
      </td>
      <td>
        <span class="cell-label">Type</span>
        <span class="badge badge--${transaction.type}">${typeLabel}</span>
      </td>
      <td class="amount amount--${transaction.type}">
        <span class="cell-label">Amount</span>
        <span title="${Ledger.escapeHtml(Ledger.money.format(transaction.amount))}">${sign}${Ledger.escapeHtml(Ledger.formatMoney(transaction.amount))}</span>
      </td>
      <td>
        <button type="button" class="delete-btn" data-delete="${Ledger.escapeHtml(transaction.id)}">
          Delete
        </button>
      </td>
    </tr>
  `;
}

function handleSubmit(event) {
  event.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = Ledger.roundMoney(amountInput.value);
  const type = new FormData(form).get("type");
  const category = categoryInput.value;
  const date = dateInput.value;
  const errors = [];

  if (!description) errors.push("Description is required.");
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Amount must be a positive number.");
  if (type !== "income" && type !== "expense") errors.push("Choose income or expense.");
  if (!Ledger.CATEGORIES.includes(category)) errors.push("Choose a category.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Choose a date.");

  setInvalid(descriptionInput, !description);
  setInvalid(amountInput, !Number.isFinite(amount) || amount <= 0);
  setInvalid(categoryInput, !Ledger.CATEGORIES.includes(category));
  setInvalid(dateInput, !/^\d{4}-\d{2}-\d{2}$/.test(date));

  if (errors.length > 0) {
    formError.innerHTML = `<ul>${errors.map((message) => `<li>${Ledger.escapeHtml(message)}</li>`).join("")}</ul>`;
    formError.hidden = false;
    return;
  }

  formError.hidden = true;
  formError.innerHTML = "";

  transactions.push({
    id: Ledger.createId(),
    description,
    amount,
    type,
    category,
    date,
    createdAt: Date.now(),
  });

  Ledger.saveTransactions(transactions);
  form.reset();
  dateInput.value = Ledger.todayISO();
  descriptionInput.focus();
  render();
  announceBalance(Ledger.calculateTotals(transactions));
}

function setInvalid(field, invalid) {
  field.setAttribute("aria-invalid", invalid ? "true" : "false");
}

function deleteTransaction(id) {
  transactions = transactions.filter((transaction) => transaction.id !== id);
  Ledger.saveTransactions(transactions);
  render();
  announceBalance(Ledger.calculateTotals(transactions));
}

form.addEventListener("submit", handleSubmit);

document.querySelector(".filter-types").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-type]");
  if (!button) return;
  filters.type = button.dataset.filterType;
  render();
});

categoryFilter.addEventListener("change", () => {
  filters.category = categoryFilter.value;
  render();
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  render();
});

transactionRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  deleteTransaction(button.dataset.delete);
});

window.addEventListener("storage", (event) => {
  if (event.key !== Ledger.TRANSACTIONS_KEY) return;
  transactions = Ledger.loadTransactions();
  render();
});

dateInput.value = Ledger.todayISO();
transactions = Ledger.loadTransactions();
render();
