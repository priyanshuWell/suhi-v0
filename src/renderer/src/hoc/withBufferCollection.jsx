/**
 * withBufferCollection HOC
 *
 * DEPRECATED: Buffer collection is now handled directly via the
 * `usePageBufferCollection` hook in each page component:
 *   - BIA:             useBIARecording (in BIACalcuate.jsx)
 *   - Voice:           usePageBufferCollection (in VoiceAnalysis.jsx)
 *   - ColorBlindness:  usePageBufferCollection (in ColorBlindPlate.jsx)
 *   - SpaceConvoy:     usePageBufferCollection (in SpaceConvoyMain.jsx)
 *
 * This file is kept for backward compatibility but is no longer used.
 */
export { usePageBufferCollection } from '../hooks/useBufferCollection';
