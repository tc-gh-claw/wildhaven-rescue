import { MISSIONS, applyPuzzle, applyCare } from './missions.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, action) {
  const node = element('button', className, label);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

/** Build the active rescue dialog. All progress changes go through the state engine. */
export function renderRescue({ mission, state, container, onProgress, onClose, onFinish }) {
  const definition = MISSIONS.find(item => item.id === mission.id);
  if (!definition || !state?.missions?.[definition.id]) throw new Error('Unknown rescue mission.');
  mission = definition;

  function render(success = '') {
    container.replaceChildren();
    container.setAttribute('aria-labelledby', 'modal-title');
    const progress = state.missions[mission.id];
    const close = button('×', 'modal-close', onClose);
    close.setAttribute('aria-label', 'Close rescue and return to the reserve');
    close.dataset.action = 'close-rescue';
    container.append(close, element('p', 'eyebrow', `${mission.location} / Rescue station`));
    const title = element('h2', '', mission.species);
    title.id = 'modal-title';
    container.append(title);
    const status = element('div', 'status-row');
    status.append(
      element('span', 'status-badge', mission.status),
      element('span', '', progress.rescued ? 'Safe with the rescue team' : progress.unlocked ? 'Veterinary care in progress' : mission.threat)
    );
    container.append(status);
    const feedback = element('p', 'feedback', success);
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    feedback.id = 'rescue-feedback';
    if (success) feedback.classList.add('success');

    function say(message, good = false) {
      feedback.textContent = message;
      feedback.classList.toggle('success', good);
      feedback.classList.toggle('error', !good);
    }

    function finishAttempt(result) {
      if (!result.ok) {
        say(result.message);
        return;
      }
      onProgress?.();
      if (result.completed) onFinish?.(mission);
      else render(result.message);
    }

    if (progress.rescued) {
      container.append(element('p', '', 'This rescue is complete. Thank you for giving wildlife a second chance.'));
      container.append(element('div', 'note-box', mission.fact));
      container.append(button('Return to the reserve', 'primary', onClose));
    } else if (!progress.unlocked) {
      container.append(element('p', 'rescue-briefing', mission.briefing));
      container.append(element('h3', '', mission.puzzle.title));
      const note = element('div', 'note-box');
      note.append(element('strong', '', 'Field note'), element('p', '', mission.puzzle.clue));
      container.append(note);
      const puzzle = mission.puzzle;
      const controls = element('div', 'puzzle-controls');
      container.append(controls);

      if (puzzle.kind === 'code') {
        const form = element('form', 'code-form');
        const label = element('label', '', 'Three-digit cage code');
        label.htmlFor = 'rescue-code';
        const input = element('input', 'code-input');
        input.id = 'rescue-code';
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 3;
        input.pattern = '[0-9]{3}';
        input.autocomplete = 'off';
        input.placeholder = '000';
        input.setAttribute('aria-describedby', 'rescue-feedback');
        const submit = element('button', 'primary', 'Unlock cage');
        submit.type = 'submit';
        submit.dataset.action = 'submit-puzzle';
        form.append(label, input, submit);
        form.addEventListener('submit', event => {
          event.preventDefault();
          finishAttempt(applyPuzzle(state, mission.id, input.value));
        });
        controls.append(form);
      } else if (puzzle.kind === 'sequence' || puzzle.kind === 'order') {
        let selected = [];
        const max = puzzle.solution.length;
        const sequence = element('div', 'sequence-display');
        sequence.setAttribute('aria-label', 'Selected sequence');
        sequence.setAttribute('aria-live', 'polite');
        const row = element('div', 'symbol-options');
        const chooseButtons = [];
        controls.append(element('p', 'puzzle-instruction', `Choose ${max} ${puzzle.kind === 'order' ? 'actions' : 'symbols'} in order.`), row, sequence);

        function drawSequence() {
          sequence.replaceChildren();
          for (let index = 0; index < max; index++) {
            const option = puzzle.options.find(item => item.id === selected[index]);
            const chip = element('span', 'sequence-chip', option ? `${index + 1}. ${option.label}` : `${index + 1}. —`);
            sequence.append(chip);
          }
          for (const [index, node] of chooseButtons.entries()) {
            node.disabled = puzzle.kind === 'order' && selected.includes(puzzle.options[index].id);
          }
          undo.disabled = selected.length === 0;
          reset.disabled = selected.length === 0;
          submit.disabled = selected.length !== max;
        }

        for (const option of puzzle.options) {
          const choose = button('', 'symbol-button', () => {
            if (selected.length >= max) {
              say('The sequence is full. Use Undo or Reset to change it.');
              return;
            }
            selected.push(option.id);
            drawSequence();
          });
          choose.dataset.value = option.id;
          choose.setAttribute('aria-label', option.label);
          if (option.symbol) {
            const symbol = element('span', 'symbol-glyph', option.symbol);
            symbol.setAttribute('aria-hidden', 'true');
            choose.append(symbol);
          }
          choose.append(element('span', '', option.label));
          row.append(choose);
          chooseButtons.push(choose);
        }
        const actions = element('div', 'puzzle-actions');
        const undo = button('Undo', 'secondary', () => { selected.pop(); drawSequence(); });
        undo.dataset.action = 'undo-sequence';
        const reset = button('Reset', 'secondary', () => { selected = []; drawSequence(); });
        reset.dataset.action = 'reset-sequence';
        const submit = button(puzzle.kind === 'order' ? 'Confirm rescue plan' : 'Open the latch', 'primary', () => {
          finishAttempt(applyPuzzle(state, mission.id, selected));
        });
        submit.dataset.action = 'submit-puzzle';
        actions.append(undo, reset, submit);
        controls.append(actions);
        drawSequence();
      } else if (puzzle.kind === 'valves') {
        const orientations = [0, 0, 0];
        const valves = element('div', 'valves');
        controls.append(element('p', 'puzzle-instruction', 'Click a dial to turn it one quarter-turn clockwise.'), valves);
        puzzle.labels.forEach((label, index) => {
          const arrow = element('span', 'pipe valve-arrow', '↑');
          arrow.setAttribute('aria-hidden', 'true');
          const direction = element('small', 'valve-direction', 'North');
          const dial = button('', 'valve', () => {
            orientations[index] = (orientations[index] + 1) % 4;
            arrow.style.transform = `rotate(${orientations[index] * 90}deg)`;
            direction.textContent = puzzle.directions[orientations[index]];
            dial.setAttribute('aria-label', `${label}: ${direction.textContent}. Turn clockwise`);
          });
          dial.dataset.valve = String(index);
          dial.setAttribute('aria-label', `${label}: North. Turn clockwise`);
          dial.append(element('strong', '', label), arrow, direction);
          valves.append(dial);
        });
        const submit = button('Test the water supply', 'primary', () => {
          finishAttempt(applyPuzzle(state, mission.id, orientations));
        });
        submit.dataset.action = 'submit-puzzle';
        controls.append(submit);
      }
      const hints = element('details', 'puzzle-hint');
      hints.append(element('summary', '', 'Need a hint?'), element('p', '', puzzle.hint));
      container.append(hints, feedback);
    } else {
      const step = mission.careSteps[progress.careStep];
      const steps = element('div', 'steps-progress');
      steps.setAttribute('aria-label', `Care step ${progress.careStep + 1} of ${mission.careSteps.length}`);
      mission.careSteps.forEach((_, index) => {
        const marker = element('span', index < progress.careStep ? 'done' : index === progress.careStep ? 'active' : '');
        marker.setAttribute('aria-label', `Step ${index + 1}${index < progress.careStep ? ', complete' : ''}`);
        if (index === progress.careStep) marker.setAttribute('aria-current', 'step');
        steps.append(marker);
      });
      container.append(steps, element('p', 'eyebrow', `Care step ${progress.careStep + 1} of ${mission.careSteps.length}`));
      container.append(element('h3', '', step.prompt));
      const choices = element('div', 'choices');
      for (const option of step.options) {
        const choice = button('', 'choice', () => finishAttempt(applyCare(state, mission.id, option.id)));
        choice.dataset.choice = option.id;
        const copy = element('span', 'choice-copy');
        copy.append(element('strong', '', option.label), element('small', '', option.detail));
        const number = element('span', 'choice-index', String(step.options.indexOf(option) + 1));
        number.setAttribute('aria-hidden', 'true');
        choice.append(number, copy);
        choices.append(choice);
      }
      container.append(choices, feedback);
      container.append(element('p', 'care-note', 'Game scenario: all treatment is supervised by trained wildlife specialists.'));
    }

    // Keep keyboard navigation in the dialog. Escape has the same effect as its close control.
    container.onkeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      } else if (event.key === 'Tab') {
        const focusable = [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), summary, a[href], [tabindex="0"]')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    const firstControl = container.querySelector('.code-input, .symbol-button:not([disabled]), .valve, .choice, .primary');
    firstControl?.focus({ preventScroll: true });
  }
  render();
}
