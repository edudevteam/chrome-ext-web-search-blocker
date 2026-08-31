// `!important` so a blocked result stays hidden regardless of how the page
// styles it, and an attribute selector so restoring is a single attribute removal.
export const CONTENT_CSS = `
[data-wcb-blocked] {
  display: none !important;
}

/*
 * Safety net for image results whose tile container could not be identified:
 * the pixels are replaced at the src, and this paints what is left a flat
 * white block of the original size.
 */
[data-wcb-blanked] {
  background: #fff !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  filter: none !important;
  object-fit: fill !important;
}
`;
