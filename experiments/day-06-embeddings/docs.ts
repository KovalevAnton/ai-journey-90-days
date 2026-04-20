/**
 * Fake documentation for "Acme SaaS" — a project management tool.
 * Each chunk is a self-contained paragraph, like a section from a help center.
 * In a real system, these come from splitting actual docs into ~200-500 token chunks.
 */

export interface DocChunk {
  id: string;
  title: string;
  content: string;
}

export const chunks: DocChunk[] = [
  {
    id: "pricing-plans",
    title: "Pricing Plans",
    content:
      "Acme offers three pricing plans: Free (up to 5 users, 10 projects), Pro ($12/user/month, unlimited projects, priority support), and Enterprise (custom pricing, SSO, dedicated account manager, SLA). All plans include a 14-day free trial. Annual billing saves 20%.",
  },
  {
    id: "return-policy",
    title: "Refund Policy",
    content:
      "We offer a full refund within 30 days of purchase, no questions asked. After 30 days, refunds are prorated based on remaining subscription time. Enterprise contracts have custom cancellation terms outlined in the agreement. To request a refund, email billing@acme.dev.",
  },
  {
    id: "integrations",
    title: "Integrations",
    content:
      "Acme integrates with Slack (real-time notifications), GitHub (auto-link commits to tasks), Figma (embed designs in tasks), Google Calendar (sync deadlines), and Zapier (connect to 5000+ apps). All integrations are available on Pro and Enterprise plans.",
  },
  {
    id: "api-rate-limits",
    title: "API Rate Limits",
    content:
      "The Acme API allows 100 requests per minute on Free, 1000/min on Pro, and 10000/min on Enterprise. Rate-limited responses return HTTP 429 with a Retry-After header. Batch endpoints count as a single request regardless of payload size.",
  },
  {
    id: "data-export",
    title: "Data Export",
    content:
      "You can export all your data at any time from Settings → Data → Export. Exports are available in CSV and JSON formats. Attachments are exported as a ZIP archive. Full exports typically complete within 5 minutes for accounts under 10GB. Enterprise accounts can schedule automatic weekly exports.",
  },
  {
    id: "two-factor-auth",
    title: "Two-Factor Authentication",
    content:
      "Acme supports two-factor authentication (2FA) via authenticator apps (Google Authenticator, Authy) and SMS. To enable 2FA, go to Settings → Security → Two-Factor Authentication. Enterprise plans can enforce 2FA for all team members. Recovery codes are generated during setup — store them securely.",
  },
  {
    id: "task-templates",
    title: "Task Templates",
    content:
      "Task templates let you create reusable task structures with predefined fields, checklists, and assignees. Go to any project → Templates → Create Template. Templates can be shared across projects on Pro and Enterprise plans. Use template variables like {{assignee}} and {{due_date}} for dynamic fields.",
  },
  {
    id: "mobile-app",
    title: "Mobile App",
    content:
      "The Acme mobile app is available on iOS (14+) and Android (11+). It supports offline mode — changes sync automatically when you reconnect. Push notifications can be configured per project. The mobile app does not currently support Gantt charts or custom dashboards — use the web app for these features.",
  },
  {
    id: "uptime-sla",
    title: "Uptime SLA",
    content:
      "Acme guarantees 99.9% uptime for Pro plans and 99.99% for Enterprise. Downtime is measured monthly, excluding scheduled maintenance (announced 48 hours in advance). If we miss the SLA, affected customers receive service credits: 10% for each 0.1% below target, up to 30% of monthly bill.",
  },
  {
    id: "team-permissions",
    title: "Team Roles and Permissions",
    content:
      "Acme has four roles: Viewer (read-only), Member (create and edit tasks), Admin (manage team settings, billing, integrations), and Owner (full control, transfer ownership). Custom roles are available on Enterprise. Permissions can be set at the project level — an Admin in one project can be a Member in another.",
  },
];
