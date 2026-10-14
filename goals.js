/**
 * Financial goals page.
 * Each goal stores a target and the amount already saved.
 * render() redraws the comparison with the expense tracker and the goal cards.
 */

let goals = [];

const form = document.querySelector("#goal-form");
const formError = document.querySelector("#goal-error");
const nameInput = document.querySelector("#goal-name");
const targetInput = document.querySelector("#goal-target");
const savedInput = document.querySelector("#goal-saved");
const deadlineInput = document.querySelector("#goal-deadline");
const noteInput = document.querySelector("#goal-note");
const goalList = document.querySelector("#goal-list");
const emptyState = document.querySelector("#goals-empty");
const comparison = document.querySelector("#goal-comparison");
const statusEl = document.querySelector("#goals-status");

function render() {
  const transactions = Ledger.loadTransactions();
  const totals = Ledger.calculateTotals(transactions);
  const gap = Ledger.goalGap(goals);

  if (goals.length === 0) {
    comparison.innerHTML =
      "<p>No goals yet. Create one below, then compare what it still needs with the balance from your expense tracker.</p>";
  } else if (gap === 0) {
    comparison.innerHTML = `<p>Every open goal is funded. Your tracker balance is ${Ledger.escapeHtml(Ledger.formatMoney(totals.balance))}.</p>`;
  } else if (totals.balance >= gap) {
    comparison.innerHTML = `<p>Open goals still need ${Ledger.escapeHtml(Ledger.formatMoney(gap))}. Your tracker balance of ${Ledger.escapeHtml(Ledger.formatMoney(totals.balance))} can cover that if you set the money aside.</p>`;
  } else {
    comparison.innerHTML = `<p>Open goals still need ${Ledger.escapeHtml(Ledger.formatMoney(gap))}. Your tracker balance is ${Ledger.escapeHtml(Ledger.formatMoney(totals.balance))}. Lower expenses or higher income in the tracker is what closes that gap.</p>`;
  }

  emptyState.hidden = goals.length > 0;
  goalList.hidden = goals.length === 0;

  const ordered = goals.slice().sort((a, b) => {
    const gapA = Math.max(0, a.target - a.saved);
    const gapB = Math.max(0, b.target - b.saved);
    if (gapA !== gapB) return gapB - gapA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  goalList.innerHTML = ordered.map(renderGoal).join("");

  requestAnimationFrame(() => {
    goalList.querySelectorAll(".bar-fill").forEach((fill) => {
      fill.style.width = fill.dataset.width;
    });
  });
}

function renderGoal(goal) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const percent = Math.min(100, (goal.saved / goal.target) * 100);
  const reached = goal.saved >= goal.target;
  const deadline = goal.deadline ? `Target date ${Ledger.formatDate(goal.deadline)}.` : "No target date.";
  const note = goal.note ? `<p>${Ledger.escapeHtml(goal.note)}</p>` : "";
  const progressLabel = reached
    ? `${goal.name} reached, ${Ledger.money.format(goal.saved)} saved`
    : `${goal.name}, ${Ledger.money.format(goal.saved)} of ${Ledger.money.format(goal.target)}`;

  return `
    <article class="goal-card">
      <div class="goal-card__head">
        <h3>${Ledger.escapeHtml(goal.name)}</h3>
        <button type="button" class="delete-btn" data-delete-goal="${Ledger.escapeHtml(goal.id)}">Delete</button>
      </div>
      ${note}
      <p class="goal-card__meta">${deadline} ${reached ? "This goal is reached." : `${Ledger.escapeHtml(Ledger.formatMoney(remaining))} still to save.`}</p>
      <div class="bar-label">
        <span title="${Ledger.escapeHtml(Ledger.money.format(goal.saved))} saved">${Ledger.escapeHtml(Ledger.formatMoney(goal.saved))} saved</span>
        <span title="${Ledger.escapeHtml(Ledger.money.format(goal.target))} target">${Ledger.escapeHtml(Ledger.formatMoney(goal.target))} target · ${Math.round(percent)}%</span>
      </div>
      <div class="bar-track" role="img" aria-label="${Ledger.escapeHtml(progressLabel)}">
        <div class="bar-fill bar-fill--goal ${reached ? "is-complete" : ""}" data-width="${percent}%"></div>
      </div>
      <form class="goal-save-form" data-goal="${Ledger.escapeHtml(goal.id)}">
        <div class="field">
          <label for="add-${Ledger.escapeHtml(goal.id)}">Add savings</label>
          <input id="add-${Ledger.escapeHtml(goal.id)}" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" />
        </div>
        <button type="submit" class="button button--small">Add</button>
        <p class="form-error" hidden></p>
      </form>
    </article>
  `;
}

function announce(message) {
  statusEl.textContent = "";
  window.setTimeout(() => {
    statusEl.textContent = message;
  }, 30);
}

function handleCreate(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const target = Ledger.roundMoney(targetInput.value);
  const savedRaw = savedInput.value.trim();
  const saved = savedRaw === "" ? 0 : Ledger.roundMoney(savedRaw);
  const deadline = deadlineInput.value;
  const note = noteInput.value.trim();
  const errors = [];

  if (!name) errors.push("Goal name is required.");
  if (!Number.isFinite(target) || target <= 0) errors.push("Target amount must be a positive number.");
  if (!Number.isFinite(saved) || saved < 0) errors.push("Amount already saved cannot be negative.");
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.push("Choose a valid target date, or leave it blank.");

  nameInput.setAttribute("aria-invalid", name ? "false" : "true");
  targetInput.setAttribute("aria-invalid", Number.isFinite(target) && target > 0 ? "false" : "true");

  if (errors.length > 0) {
    formError.innerHTML = `<ul>${errors.map((message) => `<li>${Ledger.escapeHtml(message)}</li>`).join("")}</ul>`;
    formError.hidden = false;
    return;
  }

  formError.hidden = true;
  formError.innerHTML = "";

  goals.push({
    id: Ledger.createId(),
    name,
    target,
    saved,
    deadline,
    note,
    createdAt: Date.now(),
  });

  Ledger.saveGoals(goals);
  form.reset();
  nameInput.focus();
  render();
  announce(`${name} added. ${Ledger.formatMoney(Math.max(0, target - saved))} left to reach it.`);
}

function addSavings(goalId, formEl) {
  const input = formEl.querySelector("input[name='amount']");
  const error = formEl.querySelector(".form-error");
  const amount = Ledger.roundMoney(input.value);
  const goal = goals.find((item) => item.id === goalId);

  if (!goal || !Number.isFinite(amount) || amount <= 0) {
    error.textContent = "Enter a positive amount to add.";
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
    return;
  }

  error.hidden = true;
  input.setAttribute("aria-invalid", "false");
  goal.saved = Ledger.roundMoney(goal.saved + amount);
  Ledger.saveGoals(goals);
  render();
  announce(`${Ledger.formatMoney(amount)} added to ${goal.name}.`);
}

form.addEventListener("submit", handleCreate);

goalList.addEventListener("submit", (event) => {
  const saveForm = event.target.closest(".goal-save-form");
  if (!saveForm) return;
  event.preventDefault();
  addSavings(saveForm.dataset.goal, saveForm);
});

goalList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-goal]");
  if (!button) return;
  const goal = goals.find((item) => item.id === button.dataset.deleteGoal);
  goals = goals.filter((item) => item.id !== button.dataset.deleteGoal);
  Ledger.saveGoals(goals);
  render();
  announce(goal ? `${goal.name} removed.` : "Goal removed.");
});

window.addEventListener("storage", (event) => {
  if (event.key !== Ledger.GOALS_KEY && event.key !== Ledger.TRANSACTIONS_KEY) return;
  goals = Ledger.loadGoals();
  render();
});

goals = Ledger.loadGoals();
render();
