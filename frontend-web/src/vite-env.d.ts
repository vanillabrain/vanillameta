/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: string
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.svg?react' {
  import * as React from 'react'
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  export default ReactComponent
}
