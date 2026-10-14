/**
 * Shared ledger helpers for Smart expense plus+.
 * Transactions and goals live in localStorage so every page reads the same data.
 */
const Ledger = (() => {
  const TRANSACTIONS_KEY = "smart-expense.transactions";
  const GOALS_KEY = "smart-expense-plus.goals";

  const CATEGORIES = [
    "Salary",
    "Freelance",
    "Food",
    "Transport",
    "Bills",
    "Shopping",
    "Entertainment",
    "Health",
    "Other",
  ];

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function loadTransactions() {
    try {
      const raw = localStorage.getItem(TRANSACTIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isTransaction);
    } catch {
      return [];
    }
  }

  function saveTransactions(transactions) {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }

  function isTransaction(item) {
    return (
      item &&
      typeof item.id === "string" &&
      typeof item.description === "string" &&
      typeof item.amount === "number" &&
      item.amount > 0 &&
      (item.type === "income" || item.type === "expense") &&
      CATEGORIES.includes(item.category) &&
      typeof item.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    );
  }

  function loadGoals() {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isGoal);
    } catch {
      return [];
    }
  }

  function saveGoals(goals) {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }

  function isGoal(item) {
    return (
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      item.name.trim() !== "" &&
      typeof item.target === "number" &&
      item.target > 0 &&
      typeof item.saved === "number" &&
      item.saved >= 0 &&
      (item.deadline === "" || (typeof item.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline))) &&
      typeof item.note === "string"
    );
  }

  /** Filter by type first, then sum with reduce(). */
  function calculateTotals(list) {
    const income = list
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expenses = list
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }

  /** Group expense amounts into { category: total } with reduce(). */
  function groupExpensesByCategory(list) {
    return list
      .filter((transaction) => transaction.type === "expense")
      .reduce((groups, transaction) => {
        groups[transaction.category] = (groups[transaction.category] || 0) + transaction.amount;
        return groups;
      }, {});
  }

  /** What open goals still need, after money already saved. */
  function goalGap(goals) {
    return goals.reduce((sum, goal) => sum + Math.max(0, goal.target - goal.saved), 0);
  }

  function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [year, month, day] = iso.split("-").map(Number);
    return dateLabel.format(new Date(year, month - 1, day));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createId() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  /**
   * Full currency for everyday amounts. From one million up, use K/M/B/T/Q
   * so the figure stays inside a card or category row.
   */
  function formatMoney(amount) {
    if (!Number.isFinite(amount)) return "$0.00";
    const negative = amount < 0;
    const abs = Math.abs(amount);
    const body = abs < 1000000 ? money.format(abs) : abbreviateMoney(abs);
    return negative ? `-${body}` : body;
  }

  function abbreviateMoney(abs) {
    const suffixes = ["", "K", "M", "B", "T", "Q"];
    let scaled = abs;
    let tier = 0;

    while (scaled >= 1000 && tier < suffixes.length - 1) {
      scaled /= 1000;
      tier += 1;
    }

    if (scaled >= 1000) {
      const exponent = Math.floor(Math.log10(abs));
      const mantissa = abs / 10 ** exponent;
      return `$${mantissa.toFixed(2)}e${exponent}`;
    }

    const digits = scaled >= 100 ? 1 : 2;
    return `$${scaled.toFixed(digits)}${suffixes[tier]}`;
  }

  return {
    TRANSACTIONS_KEY,
    GOALS_KEY,
    CATEGORIES,
    money,
    loadTransactions,
    saveTransactions,
    loadGoals,
    saveGoals,
    calculateTotals,
    groupExpensesByCategory,
    goalGap,
    todayISO,
    formatDate,
    escapeHtml,
    createId,
    roundMoney,
    formatMoney,
  };
})();
