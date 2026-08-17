import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Globe, Database, Activity } from 'lucide-react'
import { analysisAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import IPAddress from '@/components/shared/IPAddress'
import SeverityBadge from '@/components/shared/SeverityBadge'
import ThreatScoreBar from '@/components/shared/ThreatScoreBar'
import CountryFlag from '@/components/shared/CountryFlag'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import { formatTimestamp } from '@/lib/utils'

export default function IPIntelligence() {
  const { ip: urlIP } = useParams()
  const navigate = useNavigate()
  const [searchIP, setSearchIP] = useState(urlIP || '')
  const [analyzedIP, setAnalyzedIP] = useState(urlIP || '')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ip-analysis', analyzedIP],
    queryFn: () => analysisAPI.analyzeIP(analyzedIP),
    enabled: !!analyzedIP,
  })

  const handleAnalyze = () => {
    if (searchIP) {
      setAnalyzedIP(searchIP)
      navigate(`/ip-intelligence/${searchIP}`)
    }
  }

  const profile = data

  return (
    <PageWrapper
      title="IP Intelligence"
      subtitle="Deep threat analysis for individual IP addresses"
    >
      {/* Search Bar */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Enter IP address (e.g., 192.168.1.1)"
            className="input flex-1 font-mono min-w-0"
            value={searchIP}
            onChange={(e) => setSearchIP(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <button onClick={handleAnalyze} className="btn btn-primary shrink-0">
            <Search className="w-4 h-4 mr-2" />
            Analyze
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading && <LoadingState message="Analyzing IP address..." />}

      {error && <ErrorState error={error} onRetry={refetch} />}

      {profile && profile.found && (
        <div className="space-y-6">
          {/* Identity Card */}
          <div className="card p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div className="flex-1 min-w-0">
                <IPAddress ip={profile.ip} className="text-2xl font-bold mb-3" />
                {profile.threat_intelligence?.geolocation && (
                  <div className="flex items-center gap-x-4 gap-y-1.5 text-sm flex-wrap">
                    <CountryFlag
                      countryCode={profile.threat_intelligence.geolocation.country_code}
                      countryName={profile.threat_intelligence.geolocation.country}
                    />
                    <span className="text-text-secondary">
                      {profile.threat_intelligence.geolocation.city || 'Unknown City'}
                    </span>
                    {profile.threat_intelligence.geolocation.isp && (
                      <span className="text-text-secondary">
                        • {profile.threat_intelligence.geolocation.isp}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="sm:text-right shrink-0">
                <SeverityBadge severity={profile.verdict} className="text-lg px-4 py-2" />
                <p className="text-sm text-text-secondary mt-2">Risk Level</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-text-secondary text-sm mb-1">First Seen</p>
                <p className="font-semibold">
                  {profile.first_seen ? formatTimestamp(profile.first_seen) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-text-secondary text-sm mb-1">Last Seen</p>
                <p className="font-semibold">
                  {profile.last_seen ? formatTimestamp(profile.last_seen) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-text-secondary text-sm mb-1">Total Events</p>
                <p className="font-semibold text-2xl">{profile.total_events}</p>
              </div>
              <div>
                <p className="text-text-secondary text-sm mb-1">Threat Score</p>
                <ThreatScoreBar
                  score={profile.threat_scores?.max || 0}
                  showLabel={true}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          {/* Intelligence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AbuseIPDB Card */}
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-accent-red" />
                <h3 className="font-semibold">AbuseIPDB</h3>
              </div>
              {profile.threat_intelligence?.abuseipdb ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-text-secondary text-sm mb-1">Abuse Score</p>
                    <ThreatScoreBar
                      score={profile.threat_intelligence.abuseipdb.abuse_score || 0}
                    />
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Total Reports</p>
                    <p className="text-xl font-bold">
                      {profile.threat_intelligence.abuseipdb.total_reports || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Is Public</p>
                    <p className="text-sm">
                      {profile.threat_intelligence.abuseipdb.is_public ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-sm">No data available</p>
              )}
            </div>

            {/* OTX Card */}
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-accent-amber" />
                <h3 className="font-semibold">AlienVault OTX</h3>
              </div>
              {profile.threat_intelligence?.otx ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-text-secondary text-sm">Pulse Count</p>
                    <p className="text-xl font-bold">
                      {profile.threat_intelligence.otx.pulse_count || 0}
                    </p>
                  </div>
                  {profile.threat_intelligence.otx.pulses?.length > 0 && (
                    <div>
                      <p className="text-text-secondary text-sm mb-2">Recent Pulses</p>
                      <div className="space-y-1">
                        {profile.threat_intelligence.otx.pulses.slice(0, 3).map((pulse, i) => (
                          <p key={i} className="text-xs text-text-primary truncate">
                            • {pulse.name || pulse}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-text-muted text-sm">No data available</p>
              )}
            </div>

            {/* Geolocation Card */}
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-accent-cyan" />
                <h3 className="font-semibold">Geolocation</h3>
              </div>
              {profile.threat_intelligence?.geolocation ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-text-secondary">Country:</span>{' '}
                    <span>{profile.threat_intelligence.geolocation.country || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">City:</span>{' '}
                    <span>{profile.threat_intelligence.geolocation.city || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">ISP:</span>{' '}
                    <span>{profile.threat_intelligence.geolocation.isp || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">ASN:</span>{' '}
                    <span className="font-mono">
                      {profile.threat_intelligence.geolocation.asn || 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-sm">No data available</p>
              )}
            </div>
          </div>

          {/* Event Type Breakdown */}
          {profile.event_types && Object.keys(profile.event_types).length > 0 && (
            <div className="card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-accent-purple" />
                <h3 className="font-semibold">Event Type Breakdown</h3>
              </div>
              {/* auto-fill rather than a fixed 4 columns: the tile count varies
                  per IP, and a hardcoded 4-wide grid stranded the remainder
                  (e.g. 6 events = 4 + 2 orphans against a half-empty row).
                  Tiles now size to the container and fill each row. */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                {Object.entries(profile.event_types).map(([type, count]) => (
                  <div key={type} className="bg-bg-tertiary p-4 rounded-lg min-w-0">
                    <p className="text-text-secondary text-sm mb-1 truncate" title={type}>{type}</p>
                    <p className="text-2xl font-bold tabular-nums">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {profile && !profile.found && (
        <div className="card p-12 text-center">
          <p className="text-text-secondary">No events found for this IP address</p>
        </div>
      )}

      {!analyzedIP && !isLoading && (
        <div className="card p-12 text-center">
          <Globe className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">
            Enter an IP address above to analyze its threat profile
          </p>
        </div>
      )}
    </PageWrapper>
  )
}
