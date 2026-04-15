import { useEffect, useRef, useState } from 'react'
import { ArrowKapha, ArrowPitta, ArrowVata, KaphaIcon, PittaIcon, VataIcon } from '../../assets/index'
import { getCoordinates } from '../../utils/utility'

export const CircularChart = ({ data }) => {
  const radius = 74
  const strokeWidth = 10
  const circumference = 2 * Math.PI * radius
  const gapPercent = 4

  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [animatedData, setAnimatedData] = useState([])

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedData(data), 100)
    return () => clearTimeout(timer)
  }, [data])

  useEffect(() => {
    if (!containerRef.current) return

    const updateSize = () => {
      const rect = containerRef.current.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])


  let cumulativePercent = 0

  const arrowPositions = data.map((item) => {
    const start = cumulativePercent
    const mid = start + item.normalizedPercent / 2
    cumulativePercent += item.normalizedPercent

    const dynamicRadius =
      item.normalizedPercent < 5 ? radius + 35 : radius + 20

    const base = getCoordinates(mid, dynamicRadius, size)

    let offsetX = 0
    let offsetY = 0

    const label = item.label.toLowerCase()

    if (label === 'kapha') {
      offsetY += 40
      offsetX -= 100
    }

    if (label === 'pitta') {
      offsetY -= 2
      offsetX += 126
    }

    if (label === 'vata') {
      offsetY += 20
      offsetX += 92
    }

    return {
      x: base.x + offsetX,
      y: base.y + offsetY,
      label: item.label,
      percent: item.normalizedPercent,
    }
  })

  cumulativePercent = 0

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[420px] mx-auto aspect-[2/1] relative"
    >
      <svg viewBox="0 0 260 160" className="w-full h-full">
        {/* Chart */}
        <g transform="translate(130,80) rotate(-90)">
          {data.map((item, index) => {
            const adjustedPercent = Math.max(
              item.normalizedPercent - gapPercent,
              0
            )

            const finalDash = (adjustedPercent / 100) * circumference
            const dash = animatedData.length ? finalDash : 0

            const offset = circumference * (cumulativePercent / 100)
            cumulativePercent += item.normalizedPercent

            return (
              <circle
                key={index}
                cx="0"
                cy="0"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dasharray 1s ease',
                }}
              />
            )
          })}
        </g>

        {/* Center Text */}
        <g transform="translate(130,80)" textAnchor="middle">
          <text y="-6" fill="#38BDF8" className="text-2xl font-medium">
            Energy
          </text>
          <text y="20" fill="#38BDF8" className="text-2xl font-medium">
            Mix
          </text>
        </g>
      </svg>

      {arrowPositions.map((pos, i) => {
        const isKapha = pos.label.toLowerCase() === 'kapha'
        const isVata = pos.label.toLowerCase() === 'vata'
        const isPitta = pos.label.toLowerCase() === 'pitta'


        return (
          <div
            key={i}
            className={`absolute text-white text-sm flex gap-2 ${isKapha || isVata ? 'items-start' : 'items-end'}`}
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* ✅ Kapha → Label First */}
            {isKapha && (
              <div className="flex items-baseline mt-auto gap-2 whitespace-nowrap">
                <span className="">
                  <KaphaIcon />
                </span>

                <span className="font-[var(--font-tech-mono)] text-4xl leading-none pb-4">
                  {pos.label}
                </span>

                <span className=" leading-none translate-y-[2px] text-3xl pb-4">
                  {pos.percent}%
                </span>
              </div>
            )}
            <div className={`flex  py-4  ${isKapha ? 'flex-col-reverse' : ''}`}>
              {/* Arrow */}
              {pos.label.toLowerCase() === 'vata' && <ArrowVata />}
              {pos.label.toLowerCase() === 'pitta' && <ArrowPitta />}
              {pos.label.toLowerCase() === 'kapha' && <ArrowKapha />}
            </div>

            {!isKapha && (
              <div className="mt-1 flex items-baseline gap-2 whitespace-nowrap">
                <span className="flex-shrink-0">
                  {isVata ? <VataIcon /> : <PittaIcon />}
                </span>

                <span className="font-[var(--font-tech-mono)] text-4xl leading-none">
                  {pos.label}
                </span>

                <span className=" leading-none translate-y-[2px] text-3xl">
                  {pos.percent}%
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}