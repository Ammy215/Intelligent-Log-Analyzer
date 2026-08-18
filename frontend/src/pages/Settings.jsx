import { Settings as SettingsIcon, Database, Zap, Bell } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'

export default function Settings() {
  return (
    <PageWrapper
      title="Settings"
      subtitle="Configure dashboard preferences and integrations"
    >
      <div className="space-y-6">
        {/* Dashboard Preferences */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-accent-cyan" />
            <h3 className="label-eyebrow">Dashboard Preferences</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Auto-refresh Interval
              </label>
              <select className="input w-full max-w-xs">
                <option value="15">15 seconds</option>
                <option value="30" selected>
                  30 seconds
                </option>
                <option value="60">60 seconds</option>
                <option value="300">5 minutes</option>
                <option value="0">Disabled</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Default Time Range
              </label>
              <select className="input w-full max-w-xs">
                <option value="1">Last 1 hour</option>
                <option value="6">Last 6 hours</option>
                <option value="24" selected>
                  Last 24 hours
                </option>
                <option value="168">Last 7 days</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Events per Page
              </label>
              <select className="input w-full max-w-xs">
                <option value="25">25</option>
                <option value="50" selected>
                  50
                </option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <SettingsIcon className="w-5 h-5 text-accent-purple" />
            <h3 className="label-eyebrow">API Configuration</h3>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">AbuseIPDB</label>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-green" />
                  <span className="text-xs text-text-secondary">Connected</span>
                </div>
              </div>
              <input
                type="password"
                className="input w-full font-mono"
                placeholder="API Key"
                defaultValue="••••••••••••••••"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">AlienVault OTX</label>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-green" />
                  <span className="text-xs text-text-secondary">Connected</span>
                </div>
              </div>
              <input
                type="password"
                className="input w-full font-mono"
                placeholder="API Key"
                defaultValue="••••••••••••••••"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">OpenAI (AI Analyst)</label>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent-green" />
                  <span className="text-xs text-text-secondary">Connected</span>
                </div>
              </div>
              <input
                type="password"
                className="input w-full font-mono"
                placeholder="API Key"
                defaultValue="••••••••••••••••"
              />
            </div>
          </div>

          <button className="btn btn-primary mt-6">Save Configuration</button>
        </div>

        {/* Alert Thresholds */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="w-5 h-5 text-accent-amber" />
            <h3 className="label-eyebrow">Alert Thresholds</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                CRITICAL Threshold (events from single IP in 5 min)
              </label>
              <input
                type="range"
                min="10"
                max="100"
                defaultValue="50"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>10</span>
                <span className="font-semibold text-text-primary">50</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Brute Force Threshold (failed logins in 5 min)
              </label>
              <input
                type="range"
                min="5"
                max="50"
                defaultValue="10"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>5</span>
                <span className="font-semibold text-text-primary">10</span>
                <span>50</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Port Scan Threshold (unique ports in 60 sec)
              </label>
              <input
                type="range"
                min="5"
                max="50"
                defaultValue="20"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>5</span>
                <span className="font-semibold text-text-primary">20</span>
                <span>50</span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary mt-6">Save Thresholds</button>
        </div>

        {/* Database Stats */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="w-5 h-5 text-accent-cyan" />
            <h3 className="label-eyebrow">Database Management</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-bg-tertiary p-4 rounded-lg">
              <p className="text-text-secondary text-sm mb-1">Total Documents</p>
              <p className="text-2xl font-bold">24,573</p>
            </div>
            <div className="bg-bg-tertiary p-4 rounded-lg">
              <p className="text-text-secondary text-sm mb-1">Database Size</p>
              <p className="text-2xl font-bold">245 MB</p>
            </div>
            <div className="bg-bg-tertiary p-4 rounded-lg">
              <p className="text-text-secondary text-sm mb-1">Oldest Entry</p>
              <p className="text-sm font-semibold">30 days ago</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-secondary">Export Database</button>
            <button className="btn btn-danger">Purge Old Logs</button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
