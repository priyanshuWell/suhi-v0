export const getCoordinates = (percent, r, size) => {
    const angle = (percent / 100) * 360 - 90
    const rad = (angle * Math.PI) / 180

    const svgWidth = 260
    const svgHeight = 160

    const cx = 130
    const cy = 80

    let x = cx + r * Math.cos(rad)
    let y = cy + r * Math.sin(rad)

    const scaleX = size.width / svgWidth
    const scaleY = size.height / svgHeight

    return {
        x: x * scaleX,
        y: y * scaleY
    }
}
