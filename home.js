/**
 * Home snapshot. Reads the same ledger and goals as the other pages
 * and draws a short picture of spending and progress.
 */
const incomeEl = document.querySelector("#home-income");
const expensesEl = document.querySelector("#home-expenses");
const balanceEl = document.querySelector("#home-balance");
const balanceCard = document.querySelector("#home-balance-card");
const goalsEl = document.querySelector("#home-goals");
const snapshotNote = document.querySelector("#snapshot-note");

const transactions = Ledger.loadTransactions();
const goals = Ledger.loadGoals();
const totals = Ledger.calculateTotals(transactions);

function showMoney(element, amount) {
  const full = Ledger.money.format(amount);
  element.textContent = Ledger.formatMoney(amount);
  element.title = full;
  element.setAttribute("aria-label", full);
}

showMoney(incomeEl, totals.income);
showMoney(expensesEl, totals.expenses);
showMoney(balanceEl, totals.balance);

balanceCard.classList.remove("is-positive", "is-negative");
if (totals.balance > 0) balanceCard.classList.add("is-positive");
if (totals.balance < 0) balanceCard.classList.add("is-negative");

if (transactions.length === 0) {
  snapshotNote.textContent =
    "Your tracker is empty. Record income and expenses so this balance can guide your goals.";
} else {
  const gap = Ledger.goalGap(goals);
  snapshotNote.textContent =
    goals.length === 0
      ? "Expenses are recorded. Set a financial goal when you know what the remaining balance is for."
      : `Open goals still need ${Ledger.formatMoney(gap)}. Your tracker balance is ${Ledger.formatMoney(totals.balance)}.`;
}

if (goals.length === 0) {
  goalsEl.innerHTML =
    '<p class="empty-copy">No goals yet. <a href="goals.html">Create one</a> with a target amount you want to reach.</p>';
} else {
  const preview = goals.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  goalsEl.innerHTML = preview
    .map((goal) => {
      const percent = Math.min(100, (goal.saved / goal.target) * 100);
      const label = `${goal.name}, ${Ledger.money.format(goal.saved)} of ${Ledger.money.format(goal.target)}`;
      return `
        <article class="goal-card">
          <h3>${Ledger.escapeHtml(goal.name)}</h3>
          <p class="goal-card__meta" title="${Ledger.escapeHtml(Ledger.money.format(goal.saved))} saved of ${Ledger.escapeHtml(Ledger.money.format(goal.target))}">${Ledger.escapeHtml(Ledger.formatMoney(goal.saved))} saved of ${Ledger.escapeHtml(Ledger.formatMoney(goal.target))}</p>
          <div class="bar-track" role="img" aria-label="${Ledger.escapeHtml(label)}">
            <div class="bar-fill bar-fill--goal" data-width="${percent}%"></div>
          </div>
        </article>
      `;
    })
    .join("");

  requestAnimationFrame(() => {
    goalsEl.querySelectorAll(".bar-fill").forEach((fill) => {
      fill.style.width = fill.dataset.width;
    });
  });
}
