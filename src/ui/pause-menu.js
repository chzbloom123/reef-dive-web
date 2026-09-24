import { fillControls } from './controls-list.js';

// Pause menu: resume, graphics preset, mouse sensitivity.

export function createPauseMenu({ presetName, sensitivity, onResume, onPresetChange, onSensitivityChange }) {
  const el = document.getElementById('pause-menu');
  const hint = el.querySelector('#resume-hint');
  fillControls(el);

  el.querySelector('#resume-button').addEventListener('click', onResume);

  for (const button of el.querySelectorAll('[data-preset]')) {
    button.classList.toggle('active', button.dataset.preset === presetName);
    button.addEventListener('click', () => {
      if (button.dataset.preset !== presetName) onPresetChange(button.dataset.preset);
    });
  }

  const slider = el.querySelector('#sensitivity');
  const readout = el.querySelector('#sensitivity-value');
  const showValue = () => (readout.textContent = `${Number(slider.value).toFixed(2)}×`);
  slider.value = sensitivity;
  showValue();
  slider.addEventListener('input', () => {
    showValue();
    onSensitivityChange(Number(slider.value));
  });

  return {
    show() {
      hint.classList.add('hidden');
      el.classList.remove('hidden');
    },
    hide: () => el.classList.add('hidden'),
    showResumeHint: () => hint.classList.remove('hidden'),
  };
}
