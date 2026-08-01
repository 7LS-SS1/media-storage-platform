type P2PHlsModule = {
  HlsJsP2PEngine: {
    injectMixin: (hls: unknown) => any
  }
}

let modulePromise: Promise<P2PHlsModule> | null = null

/** Load the browser-only P2P engine through the import map in app/layout.tsx. */
export function loadP2PHlsModule(): Promise<P2PHlsModule> {
  if (!modulePromise) {
    const browserImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<P2PHlsModule>
    modulePromise = browserImport("p2p-media-loader-hlsjs")
  }
  return modulePromise
}
