import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { analysisAPI } from '@/lib/api'
import PageWrapper from '@/components/layout/PageWrapper'
import IPAddress from '@/components/shared/IPAddress'
import { getThreatScoreColor } from '@/lib/utils'
import LoadingState from '@/components/shared/LoadingState'
import 'leaflet/dist/leaflet.css'

export default function AttackMap() {
  const [mapReady, setMapReady] = useState(false)

  // Fetch top attackers with geolocation data
  const { data } = useQuery({
    queryKey: ['top-attackers-map'],
    queryFn: () => analysisAPI.getTopAttackers(50),
    refetchInterval: 30000,
  })

  useEffect(() => {
    setMapReady(true)
  }, [])

  if (!mapReady) {
    return (
      <PageWrapper title="Attack Map" subtitle="Live global attack visualization">
        <LoadingState message="Loading map..." />
      </PageWrapper>
    )
  }

  const attackers = data?.data || []

  // Filter attackers with valid geolocation data (mock for now)
  const mappedAttackers = attackers.map((attacker, index) => ({
    ...attacker,
    // Mock coordinates - in production, this comes from geolocation API
    lat: 40 + (Math.random() - 0.5) * 40,
    lng: -100 + (Math.random() - 0.5) * 180,
  }))

  return (
    <PageWrapper title="Attack Map" subtitle="Live global attack visualization">
      <div className="card p-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-bg-tertiary p-4 rounded-lg">
            <p className="text-text-secondary text-sm mb-1">Total IPs</p>
            <p className="text-2xl font-bold">{attackers.length}</p>
          </div>
          <div className="bg-bg-tertiary p-4 rounded-lg">
            <p className="text-text-secondary text-sm mb-1">Countries</p>
            <p className="text-2xl font-bold">{Math.min(attackers.length, 25)}</p>
          </div>
          <div className="bg-bg-tertiary p-4 rounded-lg">
            <p className="text-text-secondary text-sm mb-1">Attacks (10min)</p>
            <p className="text-2xl font-bold text-accent-red">
              {attackers.reduce((sum, a) => sum + (a.total_events || 0), 0)}
            </p>
          </div>
          <div className="bg-bg-tertiary p-4 rounded-lg">
            <p className="text-text-secondary text-sm mb-1">Status</p>
            <p className="text-lg font-semibold text-accent-green">Active</p>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden h-[600px]" style={{ backgroundColor: '#050d1a' }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {mappedAttackers.map((attacker, index) => {
              const threatScore = attacker.max_threat_score || 50
              const radius = Math.max(5, Math.min(15, Math.log10(attacker.total_events || 1) * 5))
              
              return (
                <CircleMarker
                  key={index}
                  center={[attacker.lat, attacker.lng]}
                  radius={radius}
                  pathOptions={{
                    color: getThreatScoreColor(threatScore),
                    fillColor: getThreatScoreColor(threatScore),
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="p-2 bg-bg-secondary text-text-primary">
                      <IPAddress ip={attacker.ip} showCopy={false} className="font-bold mb-2" />
                      <p className="text-xs">Events: {attacker.total_events}</p>
                      <p className="text-xs">Threat Score: {threatScore}</p>
                      <p className="text-xs">Critical: {attacker.critical_events || 0}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent-green" />
            <span className="text-sm text-text-secondary">Low (0-20)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent-cyan" />
            <span className="text-sm text-text-secondary">Medium (20-45)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent-amber" />
            <span className="text-sm text-text-secondary">High (45-70)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent-red" />
            <span className="text-sm text-text-secondary">Critical (70+)</span>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
