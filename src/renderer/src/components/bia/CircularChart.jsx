import { useEffect, useState } from 'react'
import { KaphaIcon, PittaIcon, VataIcon } from '../../assets/index'

export const CircularChart = ({ data }) => {
  const radius = 90
  const strokeWidth = 10
  const circumference = 2 * Math.PI * radius
  const gapPercent = 4

  const svgWidth = 320
  const svgHeight = 240
  const cx = svgWidth / 2
  const cy = svgHeight / 2

  const [animatedData, setAnimatedData] = useState([])

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedData(data), 100)
    return () => clearTimeout(timer)
  }, [data])

  // Convert cumulative percent position to angle in radians
  // 0% = top of circle (−90°), going clockwise
  const percentToAngle = (percent) => {
    const angleDeg = (percent / 100) * 360 - 90
    return (angleDeg * Math.PI) / 180
  }

  // Get x,y at given angle and distance from center
  const getPoint = (angleRad, r) => ({
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  })

  // Build geometry for each segment's arrow + label
  let cumPercent = 0
  const segments = data
    .filter((item) => item.normalizedPercent > 0)
    .map((item) => {
      const startPercent = cumPercent
      cumPercent += item.normalizedPercent

      // Midpoint of the arc = where the arrow originates
      const midPercent = startPercent + item.normalizedPercent / 2
      const midAngle = percentToAngle(midPercent)

      // Arrow starts just outside the stroke edge
      const edgeR = radius + strokeWidth / 2 + 2
      const edgePt = getPoint(midAngle, edgeR)

      // Radial extension length
      const radialLen = item.normalizedPercent < 15 ? 26 : 18
      const radialPt = getPoint(midAngle, edgeR + radialLen)

      // Which half of the circle determines horizontal direction
      const isRightSide = radialPt.x >= cx

      // Horizontal tail at the end of the radial extension
      const tailLen = 16
      const tailPt = {
        x: isRightSide ? radialPt.x + tailLen : radialPt.x - tailLen,
        y: radialPt.y,
      }

      const arrowPoints = `${edgePt.x},${edgePt.y} ${radialPt.x},${radialPt.y} ${tailPt.x},${tailPt.y}`

      return {
        ...item,
        startPercent,
        midAngle,
        edgePt,
        radialPt,
        tailPt,
        isRightSide,
        arrowPoints,
      }
    })

  // Render arc cumulative offset
  let arcCumPercent = 0

  return (
    <div className="w-full max-w-[420px] mx-auto aspect-[16/10] relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full"
        overflow="visible"
      >
        {/* Donut arcs */}
        <g transform={`translate(${cx},${cy}) rotate(-90)`}>
          {data.map((item, index) => {
            const adjustedPercent = Math.max(
              item.normalizedPercent - gapPercent,
              0
            )
            const finalDash = (adjustedPercent / 100) * circumference
            const dash = animatedData.length ? finalDash : 0
            const offset = circumference * (arcCumPercent / 100)
            arcCumPercent += item.normalizedPercent

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
        <g transform={`translate(${cx},${cy})`} textAnchor="middle">
          <text y="0" fill="#38BDF8" fontSize="28" fontWeight="600">
            Prakriti
          </text>
          {/* <text y="20" fill="#38BDF8" fontSize="22" fontWeight="600">
            Mix
          </text> */}
        </g>

        {/* Arrows + Labels for each segment */}
        {segments.map((seg, i) => {
          const lbl = seg.label.toLowerCase()

          // foreignObject sizing for the inline label
          const foWidth = 150
          const foHeight = 40
          const labelGap = 6

          // Position the label block at the end of the tail
          let foX, foY

          if (seg.isRightSide) {
            // Label sits to the right of the tail end
            foX = seg.tailPt.x + labelGap
            foY = seg.tailPt.y - foHeight / 2
          } else {
            // Label sits to the left of the tail end
            foX = seg.tailPt.x - labelGap - foWidth
            foY = seg.tailPt.y - foHeight / 2
          }

          return (
            <g key={i}>
              {/* Dashed arrow: circle edge → radial out → horizontal tail */}
              <polyline
                points={seg.arrowPoints}
                fill="none"
                stroke="white"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Label: icon + name + percent (all inline) */}
              <foreignObject
                x={foX}
                y={foY}
                width={foWidth}
                height={foHeight}
                overflow="visible"
              >
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: seg.isRightSide ? 'flex-start' : 'flex-end',
                    gap: '6px',
                    width: '100%',
                    height: '100%',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                    }}
                  >
                    {lbl === 'vata' && <VataIcon />}
                    {lbl === 'pitta' && <PittaIcon />}
                    {lbl === 'kapha' && <KaphaIcon />}
                  </span>
                  <span
                    style={{
                      color: 'white',
                      fontSize: '18px',
                      fontFamily: 'var(--font-tech-mono), monospace',
                      lineHeight: 1,
                    }}
                  >
                    {seg.label}
                  </span>
                  <span
                    style={{
                      color: 'white',
                      fontSize: '16px',
                      lineHeight: 1,
                    }}
                  >
                    {Math.round(seg.normalizedPercent)}%
                  </span>
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </div>
  )
}