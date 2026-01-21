import React from 'react'

/**
 * Body Constitution Component
 * 
 * Displays Vata, Pitta, and Kapha percentages with dynamic progress bars
 * 
 * @param {number} vata - Vata percentage (0-100)
 * @param {number} pitta - Pitta percentage (0-100)
 * @param {number} kapha - Kapha percentage (0-100)
 * 
 * Usage:
 * <BodyConstitution vata={40} pitta={30} kapha={30} />
 */
const BodyConstitution = ({ vata = 33, pitta = 33, kapha = 34 }) => {
  // Ensure values are numbers and handle null/undefined
  const vataPercent = Number(vata) || 0
  const pittaPercent = Number(pitta) || 0
  const kaphaPercent = Number(kapha) || 0

  // Calculate total for normalization (in case they don't add up to 100)
  const total = vataPercent + pittaPercent + kaphaPercent

  // Normalize to 100% if needed
  const normalizedVata = total > 0 ? (vataPercent / total) * 100 : 0
  const normalizedPitta = total > 0 ? (pittaPercent / total) * 100 : 0
  const normalizedKapha = total > 0 ? (kaphaPercent / total) * 100 : 0

  const doshaConfig = [
    {
      key: 'vata',
      color: '#9EE2F8',
      emoji: '💨',
      label: 'Vata',
      percentage: vataPercent,
      normalizedPercent: normalizedVata
    },
    {
      key: 'pitta',
      color: '#FEE45A',
      emoji: '🔥',
      label: 'Pitta',
      percentage: pittaPercent,
      normalizedPercent: normalizedPitta
    },
    {
      key: 'kapha',
      color: '#74CD65',
      emoji: '🌍',
      label: 'Kapha',
      percentage: kaphaPercent,
      normalizedPercent: normalizedKapha
    }
  ]

  return (
    <div className="w-full bg-transparent p-2">
      {/* Title */}
      <h2 className="text-[#29ABE2] text-3xl xl:text-4xl  text-center mb-4 tracking-wider">
        Body Constitution
      </h2>

      {/* Three column layout for percentages */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {doshaConfig.map((dosha) => (
          <div key={dosha.key} className="text-center">
            <span className="text-gray-400 text-2xl xl:text-3xl font-medium">
              {dosha.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Progress Bars Container - Single row with proportional widths */}
      <div className="w-full flex gap-1 mb-6 h-3 rounded-full overflow-hidden">
        {doshaConfig.map((dosha) => (
          <div
            key={dosha.key}
            className="h-full transition-all duration-1000 ease-out"
            style={{
              width: `${dosha.normalizedPercent}%`,
              backgroundColor: dosha.color,
              minWidth: dosha.percentage > 0 ? '2%' : '0%' // Ensure visibility if > 0
            }}
          />
        ))}
      </div>

      {/* Labels with Emojis */}
      <div className="grid grid-cols-3 gap-4">
        {doshaConfig.map((dosha) => (
          <div key={dosha.key} className="flex items-center justify-center gap-2">
            <span className="text-2xl">{dosha.emoji}</span>
            <span
              className="text-xl xl:text-2xl font-semibold tracking-wide text-gray-400"
            >
              {dosha.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BodyConstitution