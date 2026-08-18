// AI-generated reports come back as markdown that starts with a top-level
// "# INCIDENT REPORT". Rendered verbatim that becomes a second <h1> on a page
// that already has one, so the document announces two competing top-level
// headings and the report title visually outranks the page title.
//
// Shifting every level down by one keeps the report's own internal hierarchy
// intact while leaving <h1> to the page itself.
export const markdownHeadingShift = {
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  h4: 'h5',
  h5: 'h6',
  h6: 'h6',
}
