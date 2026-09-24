import { fillControls } from './controls-list.js';

// "Click to dive": the first screen. Browsers only allow mouse capture after a real click,
// so this screen exists for a technical reason as much as a welcoming one.

export function createStartScreen({ presetLabel, onDive }) {
  const el = document.getElementById('start-screen');
  fillControls(el);
  el.querySelector('.preset-name').textContent = presetLabel;
  el.querySelector('#dive-button').addEventListener('click', onDive);

  return {
    show: () => el.classList.remove('hidden'),
    hide: () => el.classList.add('hidden'),
  };
}
