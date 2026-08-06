import { getCountryFlag } from '@/lib/utils'

export default function CountryFlag({ countryCode, countryName, className = '' }) {
  if (!countryCode && !countryName) return null

  const flag = countryCode ? getCountryFlag(countryCode) : '🏳️'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-lg">{flag}</span>
      {countryName && <span className="text-sm">{countryName}</span>}
    </span>
  )
}
