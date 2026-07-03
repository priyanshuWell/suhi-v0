/**
 * Buffer collection is managed centrally by BufferCollectionManager (App.jsx)
 * via stepBufferSession.js — one minute max per screening step across routes:
 *
 *   Step 1 BIA:            /bia/leg50, /bia/wh, /bia/whcomplete, /bia/im, /bia/imcomplete
 *   Step 2 Voice:          /voice
 *   Step 3 Color Blindness: /colorblindness, /colorblindness/quiz
 *   Step 4 Space Convoy:   /space-convoy-main, /divide-attention, /space-convoy-complete
 */
export { getStepForPath, BUFFER_COLLECTION_STEPS } from '../utils/bufferCollectionRoutes';
