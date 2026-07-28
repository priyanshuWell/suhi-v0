export async function rotateStream90(stream) {
  const video = document.createElement("video")
  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  await video.play()

  const w = video.videoWidth
  const h = video.videoHeight

  const canvas = document.createElement("canvas")
  canvas.width = h
  canvas.height = w

  const ctx = canvas.getContext("2d")
  let rafId = null

  function draw() {
    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(Math.PI / 2)

    ctx.drawImage(video, -w / 2, -h / 2, w, h)
    ctx.restore()

    rafId = requestAnimationFrame(draw)
  }

  draw()

  const canvasStream = canvas.captureStream(30)

  // ✅ Expose a stop() so callers can cancel the rAF loop + release the hidden video
  canvasStream.stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    video.pause()
    video.srcObject = null
  }

  return canvasStream
}