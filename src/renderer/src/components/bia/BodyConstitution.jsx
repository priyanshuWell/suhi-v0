import React from 'react'
import { useTranslation } from 'react-i18next'
import { CircularChart } from './CircularChart'

/**
 * Body Constitution Component
 * 
 * Displays Vata, Pitta, and Kapha percentages with dynamic progress bars
 * 
 * @param {number} vata - Vata percentage (0-100)
 * @param {number} pitta - Pitta percentage (0-100)
 * @param {number} kapha - Kapha percentage (0-100)

 */
const BodyConstitution = ({ vata = 20, pitta = 20, kapha = 60 }) => {
  const { t } = useTranslation()

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
      <h2 className="text-[#FFFFFF] text-2xl xl:text-3xl text-center mb-4 tracking-wider">
        {t('bia_result.head_desc')}
      </h2>

      <div className="flex justify-center relative">
        <CircularChart data={doshaConfig} />
      </div>
    </div>
  )
}

export default BodyConstitution