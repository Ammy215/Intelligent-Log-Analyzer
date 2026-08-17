import { getCountryFlag, countryDisplayName } from '@/lib/utils'

// The backend fills `country` and `country_code` with the same 2-letter code,
// and the flag glyph itself falls back to those same two letters on fonts
// without flag support — which rendered as "DE DE". Resolve the code to a
// real country name instead (see countryDisplayName in lib/utils).
export default function CountryFlag({ countryCode, countryName, className = '' }) {
  if (!countryCode && !countryName) return null

  const code = countryCode || (countryName?.length === 2 ? countryName : null)
  const flag = code ? getCountryFlag(code) : '🏳️'
  const label = countryDisplayName(code, countryName)

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-lg leading-none" aria-hidden="true">{flag}</span>
      {label && <span className="text-sm">{label}</span>}
    </span>
  )
}
