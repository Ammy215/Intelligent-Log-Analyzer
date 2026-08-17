import { Shield, Activity, Globe2, Brain } from 'lucide-react'

// Split panel: product context on the left, form on the right. The brand
// panel is hidden below lg — on a phone there's no room for it and the
// form is the only thing that matters.
const POINTS = [
  {
    icon: Activity,
    title: 'Parse and score in one pass',
    body: 'SSH and Windows event logs land already scored against your own detection weights.',
  },
  {
    icon: Globe2,
    title: 'Enrichment on the attackers that matter',
    body: 'High-severity source IPs get reputation, pulse and geolocation data pulled automatically.',
  },
  {
    icon: Brain,
    title: 'Incidents, written up for you',
    body: 'Related events group into incidents, and an analyst report is one click from there.',
  },
]

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg-primary lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / context panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-bg-border relative overflow-hidden">
        <div
          className="absolute -top-40 -left-32 w-[34rem] h-[34rem] rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-cyan/10 border border-accent-cyan/25 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-accent-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary leading-tight">Log Analyzer</p>
            <p className="text-[11px] text-text-muted leading-tight">Security Operations</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl xl:text-4xl font-semibold text-text-primary tracking-tight leading-[1.15] mb-4">
            Turn raw logs into
            <span className="text-accent-cyan"> incidents worth reading.</span>
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-10">
            Point it at your auth logs and get scored events, enriched attacker profiles and
            written-up incidents — instead of a wall of text to grep through.
          </p>

          <ul className="space-y-5">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-bg-tertiary border border-bg-border flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary mb-0.5">{title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-text-muted">
          Multi-tenant by default — every organization's logs stay its own.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          {/* Compact brand mark, only where the left panel isn't shown */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-accent-cyan" />
            </div>
            <h1 className="text-lg font-semibold">Log Analyzer</h1>
            <p className="label-eyebrow mt-1">Security Operations</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
