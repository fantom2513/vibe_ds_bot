import React from 'react'
import { createRoot } from 'react-dom/client'

// Test-only helper: mounts a UI primitive into a detached container via a
// real React 18 root so Playwright can assert on its computed styles without
// wiring the component into any app route. A real commit (not
// renderToStaticMarkup) is required here — MUI/Emotion insert their
// generated CSS rules from a `useInsertionEffect`, which only fires once
// React actually commits the tree, not during string rendering. Served by
// the same Vite dev server the specs already boot, so bare imports (react,
// @mui/material, CSS custom properties from the real global stylesheet)
// resolve exactly as they do for the app.
export async function mountElement(container, Comp, props, childText) {
  const children = childText != null ? React.createElement('span', null, childText) : undefined
  const element = React.createElement(Comp, props, children)
  const root = createRoot(container)
  root.render(element)
  // Flush the insertion + layout effects that write Emotion's <style> rules.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return () => root.unmount()
}
