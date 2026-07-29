import React, { useState } from 'react'
import { useIdleTimer } from 'react-idle-timer'
import { useNavigate, useLocation } from 'react-router'
import { useDispatch } from 'react-redux'
import { resetCommonState } from '../features/common/commonSlice'
import AreYouThereModal from './ui/AreYouThereModal'


const AutoIdleRedirect = ({
  timeoutMs = 120000,
  promptBeforeMs = 10000,
  redirectTo = '/welcome'
}) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [isPrompted, setIsPrompted] = useState(false)

  // Disable on home/splash routes
  const isHomeRoute = location.pathname === '/' || location.pathname === redirectTo

  const handlePrompt = () => {
    if (!isHomeRoute) {
      setIsPrompted(true)
    }
  }

  const handleIdle = () => {
    setIsPrompted(false)
    if (!isHomeRoute) {
      console.log(`[AutoIdleRedirect] Idle timeout reached. Resetting Redux state & redirecting to ${redirectTo}...`)
      dispatch(resetCommonState())
      navigate(redirectTo)
    }
  }

  const handleActive = () => {
    setIsPrompted(false)
  }

  const { activate, reset } = useIdleTimer({
    timeout: timeoutMs,
    promptBeforeIdle: promptBeforeMs,
    onPrompt: handlePrompt,
    onIdle: handleIdle,
    onActive: handleActive,
    debounce: 500,
    disabled: isHomeRoute
  })

  const handleYes = () => {
    activate()
    setIsPrompted(false)
  }

  const handleNo = () => {
    reset()
    setIsPrompted(false)
    if (!isHomeRoute) {
      dispatch(resetCommonState())
      navigate(redirectTo)
    }
  }

  if (isPrompted && !isHomeRoute) {
    return (
      <AreYouThereModal
        timeoutSecs={Math.ceil(promptBeforeMs / 1000)}
        onYes={handleYes}
        onNo={handleNo}
      />
    )
  }

  return null
}

export default AutoIdleRedirect
