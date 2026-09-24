// Copies the controls list (one <template> in index.html) into a menu, so it's written only once.
export function fillControls(container) {
  const template = document.getElementById('controls-template');
  container.querySelector('.controls-slot').replaceWith(template.content.cloneNode(true));
}
