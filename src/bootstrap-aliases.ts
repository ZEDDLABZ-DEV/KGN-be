// Resolve the "@" path alias at runtime.
//
// In production we run the compiled output (dist/*.js) via `npm start`, where
// `module-alias` must map "@" -> "dist". In development we run the TypeScript
// sources directly through ts-node, where `tsconfig-paths` already maps
// "@" -> "src". If `module-alias` also ran in dev it would hijack every "@"
// import to the (often stale) dist build instead of the live src files.
//
// This file is compiled to .js for production and stays .ts under ts-node, so
// the extension check reliably tells the two environments apart.
if (__filename.endsWith('.js')) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('module-alias/register');
}
