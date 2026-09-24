import { fillControls } from './controls-list.js';

// Pause menu: resume, graphics preset, sound, mouse sensitivity.

export function createPauseMenu({ presetName, sensitivity, soundOn, onResume, onPresetChange, onSensitivityChange, onSoundChange }) {
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

  const soundButtons = el.querySelectorAll('[data-sound]');
  const showSound = (on) => soundButtons.forEach((b) => b.classList.toggle('active', (b.dataset.sound === 'on') === on));
  showSound(soundOn);
  soundButtons.forEach((b) =>
    b.addEventListener('click', () => {
      const on = b.dataset.sound === 'on';
      showSound(on);
      onSoundChange(on);
    }),
  );

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
    showSound,
  };
}
