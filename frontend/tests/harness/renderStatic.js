import React from 'react'
import ReactDOMServer from 'react-dom/server'

// Test-only helper: statically renders a UI primitive to an HTML string so
// Playwright can assert on its computed styles without wiring the component
// into any app route. Served by the same Vite dev server the specs already
// boot, so bare imports (react, @mui/material, CSS custom properties from
// the real global stylesheet) resolve exactly as they do for the app.
export function renderElementHTML(Comp, props, childText) {
  const children = childText != null ? React.createElement('span', null, childText) : undefined
  const element = React.createElement(Comp, props, children)
  return ReactDOMServer.renderToStaticMarkup(element)
}
