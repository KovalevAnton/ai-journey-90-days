import type { Brief } from "./schema.js";

export interface TestCase {
  input: string;
  expected: Brief;
  tag: string; // короткое описание, зачем этот кейс
}

export const cases: TestCase[] = [
  // 1. Чистый, простой бриф
  {
    input:
      "Need a landing page for my SaaS product. Budget is $3,000. Must be done by June 15, 2026.",
    expected: {
      title: "SaaS landing page",
      budget_usd: 3000,
      deadline: "June 15, 2026",
    },
    tag: "clean-simple",
  },

  // 2. Грязный текст, опечатки
  {
    input:
      "hey i ned a loogo deisgn asap!! i can pay aroud 500 dolars, ned it by friday pls",
    expected: {
      title: "Logo design",
      budget_usd: 500,
      deadline: "Friday",
    },
    tag: "messy-typos",
  },

  // 3. Бюджет в EUR, не USD
  {
    input:
      "We're looking for a React developer to build a dashboard. Budget: €5,000. Deadline: end of Q3 2026.",
    expected: {
      title: "React dashboard",
      budget_usd: null, // бюджет в EUR, не USD — модель не должна конвертировать
      deadline: "end of Q3 2026",
    },
    tag: "eur-not-usd",
  },

  // 4. Нет бюджета вообще
  {
    input:
      "Looking for someone to redesign our company website. Modern, clean, mobile-first. Need it by March 2027.",
    expected: {
      title: "Company website redesign",
      budget_usd: null,
      deadline: "March 2027",
    },
    tag: "no-budget",
  },

  // 5. Нет дедлайна
  {
    input:
      "I need an illustrator for a children's book. 20 pages, full color. Budget: $8,000. No rush.",
    expected: {
      title: "Children's book illustration",
      budget_usd: 8000,
      deadline: null,
    },
    tag: "no-deadline",
  },

  // 6. Ни бюджета, ни дедлайна
  {
    input:
      "Thinking about building an AI chatbot for customer support. Want to explore options.",
    expected: {
      title: "AI chatbot for customer support",
      budget_usd: null,
      deadline: null,
    },
    tag: "no-budget-no-deadline",
  },

  // 7. Очень длинный, разговорный бриф
  {
    input:
      "So basically my friend told me about this thing where you can get someone to build you an app, and I've been thinking about it for a while now because my dog walking business is growing and I really need some kind of booking system where clients can pick a time slot and pay online. I guess I could spend up to maybe $2,000? And it would be great to have it ready before summer, like maybe end of May 2026.",
    expected: {
      title: "Dog walking booking",
      budget_usd: 2000,
      deadline: "end of May 2026",
    },
    tag: "long-rambling",
  },

  // 8. Бюджет — диапазон
  {
    input:
      "Need a WordPress plugin for inventory management. Budget range: $1,500 - $2,500. Deadline: July 1st, 2026.",
    expected: {
      title: "WordPress inventory management plugin",
      budget_usd: null, // range is not a fixed budget — model correctly returns null
      deadline: "July 1st, 2026", // prompt says "as stated", so match the input text
    },
    tag: "budget-range",
  },

  // 9. Бюджет указан как ставка, не фикс
  {
    input:
      "Looking for a senior backend engineer, $150/hour, for a 3-month API migration project starting August 2026.",
    expected: {
      title: "Backend API migration",
      budget_usd: null, // $150/hr — это ставка, не фиксированный бюджет
      deadline: "August 2026", // model may add context like "3 months starting August 2026" — revisit
    },
    tag: "hourly-rate-not-fixed",
  },

  // 10. Несколько проектов в одном тексте (edge case — должен взять первый/основной)
  {
    input:
      "Two things: (1) I need a mobile app for food delivery, budget $15,000, by December 2026. (2) Also need a simple admin panel, $3,000, by October 2026.",
    expected: {
      title: "Mobile app for food delivery",
      budget_usd: 15000,
      deadline: "December 2026",
    },
    tag: "multi-project",
  },
];
