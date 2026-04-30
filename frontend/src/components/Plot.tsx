// Shared Plotly component factory
// Uses react-plotly.js with the full plotly.js bundle.
// All chart components import from here to keep things consistent.

import type { CSSProperties, ComponentType } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – react-plotly.js types are separate; installed via @types/react-plotly.js
import Plot from 'react-plotly.js'

export default Plot as ComponentType<{
  data: object[]
  layout?: object
  config?: object
  style?: CSSProperties
  useResizeHandler?: boolean
}>
