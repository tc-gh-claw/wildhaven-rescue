/**
 * Wildhaven mission content and deterministic progress rules.
 * Wildlife facts are sourced below. Rescue actions are simplified game fiction,
 * performed by a trained veterinary team, not instructions for handling wildlife.
 */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'wildhaven-rescue-v1';

export const MISSIONS = [
  {
    id: 'tiger', name: 'The silent clearing', species: 'Tiger', scientificName: 'Panthera tigris',
    location: 'Forest clearing', x: -11, z: -12, status: 'Endangered',
    fact: 'Tigers depend on connected habitat and healthy prey populations. Poaching and habitat loss threaten their survival.',
    threat: 'Illegal capture · injured foreleg',
    source: 'https://nationalzoo.si.edu/animals/tiger', sourceLabel: "Smithsonian's National Zoo",
    briefing: 'A tiger is trapped in an abandoned poacher cage. Decode the lock, then help the veterinary team care for its injured foreleg.',
    puzzle: {
      kind: 'code', title: 'Decode the cage lock',
      clue: 'The lock reads TRACKS → CLAWS → WATER. A field note records: 3 sets of tracks, 1 claw-marked tree, and 4 water containers.',
      hint: 'Use the three counts in the order written on the lock.',
      options: [], solution: '314',
      success: 'The lock clicks open. The ranger team secures the clearing so the vet can begin.'
    },
    careSteps: [
      {
        prompt: 'The veterinary team has safely assessed the tiger. Which kit should they use for the dirty scrape?',
        options: [
          { id: 'clean', label: 'Wound-cleaning kit', detail: 'Let the vet clean the scrape using the approved supplies.' },
          { id: 'camera', label: 'Camera kit', detail: 'Take more photographs before preparing care.' },
          { id: 'release', label: 'Open the exit now', detail: 'Release the tiger before its injury has been treated.' }
        ], correct: 'clean', success: 'The vet cleans the wound. The next step is protection.'
      },
      {
        prompt: 'The scrape is clean. Select the next item requested by the vet.',
        options: [
          { id: 'rope', label: 'Coarse rope', detail: 'Rope is for securing equipment, not dressing wounds.' },
          { id: 'dressing', label: 'Sterile dressing', detail: 'Hand over the dressing for the vet to apply.' },
          { id: 'food', label: 'Visitor snacks', detail: 'Human snacks are not part of this care plan.' }
        ], correct: 'dressing', success: 'The vet applies a protective dressing.'
      },
      {
        prompt: 'Treatment is complete. How should the team finish the rescue?',
        options: [
          { id: 'crowd', label: 'Invite a crowd closer', detail: 'Gather everyone around the cage.' },
          { id: 'chase', label: 'Chase it into the trees', detail: 'Make the tiger move before assessment.' },
          { id: 'monitor', label: 'Monitor, then clear for release', detail: 'Give it space while the vet checks that it is ready.' }
        ], correct: 'monitor', success: 'The tiger is cleared for release. Its forest trail is open again.'
      }
    ]
  },
  {
    id: 'elephant', name: 'A place to recover', species: 'Asian elephant', scientificName: 'Elephas maximus',
    location: 'Banyan grove', x: 15, z: -23, status: 'Endangered',
    fact: 'Asian elephants need room to move between feeding grounds and water. Habitat loss and fragmentation increase conflict with people.',
    threat: 'Exhaustion · habitat disturbance',
    source: 'https://www.fws.gov/cites/species/asian-elephant', sourceLabel: 'U.S. Fish & Wildlife Service',
    briefing: 'An exhausted elephant has stopped near a damaged water station. Put the response plan in order, then prepare its recovery area.',
    puzzle: {
      kind: 'order', title: 'Plan a calm approach',
      clue: 'First understand the situation from a safe distance. Next make the site safe. Only then should the veterinary team begin care.',
      hint: 'Assessment comes before securing the site; treatment comes last.',
      options: [
        { id: 'treat', label: 'Begin veterinary care' },
        { id: 'observe', label: 'Observe from a safe distance' },
        { id: 'secure', label: 'Secure a quiet recovery area' }
      ], solution: ['observe', 'secure', 'treat'],
      success: 'Your response plan is ready. The team approaches calmly and sets up a recovery area.'
    },
    careSteps: [
      {
        prompt: 'The team needs a cooler, quieter recovery spot. What should you prepare?',
        options: [
          { id: 'shade', label: 'Shade shelter', detail: 'Set up the recovery canopy requested by the vet.' },
          { id: 'music', label: 'Loud music', detail: 'Play a celebration while the elephant rests.' },
          { id: 'lights', label: 'Bright spotlights', detail: 'Point the work lights toward its eyes.' }
        ], correct: 'shade', success: 'A shaded recovery area is ready.'
      },
      {
        prompt: 'The vet asks the team to restore the clean-water station.',
        options: [
          { id: 'soda', label: 'Sweet drinks', detail: 'Use the visitor refreshments.' },
          { id: 'water', label: 'Fresh water supply', detail: 'Refill the station with the team’s clean water.' },
          { id: 'paint', label: 'Paint the tank', detail: 'Decorate the empty station first.' }
        ], correct: 'water', success: 'Clean water is available while the vet monitors recovery.'
      },
      {
        prompt: 'The elephant has recovered. What will help it leave safely?',
        options: [
          { id: 'trail', label: 'Clear the forest corridor', detail: 'Remove abandoned barriers and give the animal space.' },
          { id: 'fence', label: 'Build another barrier', detail: 'Close the route back into the forest.' },
          { id: 'selfie', label: 'Move in for a selfie', detail: 'Stand beside the animal as it leaves.' }
        ], correct: 'trail', success: 'The forest corridor is clear. The elephant can return to the grove.'
      }
    ]
  },
  {
    id: 'pangolin', name: 'Under the scales', species: 'Sunda pangolin', scientificName: 'Manis javanica',
    location: 'Fern hollow', x: -21, z: -34, status: 'Critically Endangered',
    fact: 'Sunda pangolins eat ants and termites and can climb using a gripping tail. Illegal trade in their meat and scales is a major threat.',
    threat: 'Illegal capture · stress',
    source: 'https://biodiversitysg.nparks.gov.sg/our-biodiversity/mammals/other-mammals/sunda-pangolin/', sourceLabel: 'Singapore NParks',
    statusSource: 'https://doi.org/10.2305/IUCN.UK.2019-3.RLTS.T12763A123584856.en',
    briefing: 'A frightened pangolin is locked inside a transport cage. Reproduce the symbols on the shipping tag to open the latch.',
    puzzle: {
      kind: 'sequence', title: 'Read the transport tag',
      clue: 'The tag shows MOON → LEAF → MOON → SUN. Press the symbols in exactly that order. You can read the tag for as long as you need.',
      hint: 'Moon appears twice. The sequence has four symbols.',
      options: [
        { id: 'leaf', label: 'Leaf', symbol: '❧' },
        { id: 'sun', label: 'Sun', symbol: '☀' },
        { id: 'moon', label: 'Moon', symbol: '☾' }
      ], solution: ['moon', 'leaf', 'moon', 'sun'],
      success: 'The latch releases. The team shields the cage from noise while the vet checks the pangolin.'
    },
    careSteps: [
      {
        prompt: 'The pangolin is curled up and frightened. How can the team reduce disturbance?',
        options: [
          { id: 'uncurl', label: 'Pull it open', detail: 'Force the animal to uncurl.' },
          { id: 'quiet', label: 'Prepare a quiet shelter', detail: 'Give it a sheltered place and let the specialists work.' },
          { id: 'flash', label: 'Use flash photography', detail: 'Take close-up photographs of the scales.' }
        ], correct: 'quiet', success: 'The quiet shelter gives the pangolin room to settle.'
      },
      {
        prompt: 'The specialist needs to check for injuries from transport.',
        options: [
          { id: 'check', label: 'Assist the veterinary check', detail: 'Prepare the examination supplies for the specialist.' },
          { id: 'release', label: 'Skip the check', detail: 'Release it before checking its condition.' },
          { id: 'brush', label: 'Polish the scales', detail: 'The scales do not need cosmetic treatment.' }
        ], correct: 'check', success: 'The specialist completes the health check and approves the next stage.'
      },
      {
        prompt: 'The pangolin is ready for the sanctuary team. Select the transport plan.',
        options: [
          { id: 'pet', label: 'Take it home', detail: 'Keep it as a pet.' },
          { id: 'display', label: 'Put it on public display', detail: 'Let visitors handle it.' },
          { id: 'sanctuary', label: 'Transfer to specialist care', detail: 'Use the prepared secure carrier and the approved quiet route.' }
        ], correct: 'sanctuary', success: 'The pangolin is safe with the sanctuary team. Its recovery can continue.'
      }
    ]
  },
  {
    id: 'turtle', name: 'Back to the blue', species: 'Hawksbill turtle', scientificName: 'Eretmochelys imbricata',
    location: 'Tidepool beach', x: 25, z: 9, status: 'Critically Endangered',
    fact: 'Hawksbills have overlapping shell scales and a narrow beak. Fishing gear and the illegal tortoiseshell trade threaten them.',
    threat: 'Discarded fishing net · injured flipper',
    source: 'https://www.nparks.gov.sg/florafaunaweb/fauna/2/6/262', sourceLabel: 'Singapore NParks',
    statusSource: 'https://www.iucn-mtsg.org/statuses',
    briefing: 'A hawksbill is tangled in discarded fishing net. Restore the field station’s rinse supply before the marine team begins treatment.',
    puzzle: {
      kind: 'valves', title: 'Restore the rinse station',
      clue: 'The maintenance arrows read: INTAKE points EAST, FILTER points WEST, OUTLET points SOUTH. Turn each dial to match.',
      hint: 'Clockwise from the top: North = 0, East = 1, South = 2, West = 3.',
      labels: ['Intake', 'Filter', 'Outlet'],
      directions: ['North', 'East', 'South', 'West'],
      options: [{ id: 0, label: 'North' }, { id: 1, label: 'East' }, { id: 2, label: 'South' }, { id: 3, label: 'West' }],
      solution: [1, 3, 2],
      success: 'The rinse station is working. The marine rescue team can begin.'
    },
    careSteps: [
      {
        prompt: 'The team has assessed the trapped turtle. Which kit is needed to remove the net?',
        options: [
          { id: 'pull', label: 'Pull on the flippers', detail: 'Pulling could worsen the injury.' },
          { id: 'net', label: 'Specialist net-removal kit', detail: 'Let the trained marine team remove the entanglement.' },
          { id: 'release', label: 'Leave the net attached', detail: 'Send the turtle away with the entanglement.' }
        ], correct: 'net', success: 'The marine team removes the discarded net without pulling on the flipper.'
      },
      {
        prompt: 'The vet asks for the cleaned treatment tray for the flipper injury.',
        options: [
          { id: 'care', label: 'Approved wound-care supplies', detail: 'Pass the prepared tray to the vet.' },
          { id: 'sand', label: 'A handful of sand', detail: 'Sand does not belong in the wound.' },
          { id: 'paint', label: 'Shell paint', detail: 'The turtle’s shell should not be painted.' }
        ], correct: 'care', success: 'The vet treats the flipper and completes the recovery assessment.'
      },
      {
        prompt: 'The marine team has cleared the turtle for release. Prepare the shoreline.',
        options: [
          { id: 'crowd', label: 'Gather spectators at the water', detail: 'Block the quiet route to the sea.' },
          { id: 'pet', label: 'Keep it in a home aquarium', detail: 'A wild sea turtle is not a pet.' },
          { id: 'shore', label: 'Clear litter and give it space', detail: 'Let the marine team manage a quiet release.' }
        ], correct: 'shore', success: 'The beach is clear. The hawksbill is ready to return to the sea.'
      }
    ]
  }
];

const missionById = new Map(MISSIONS.map(m => [m.id, m]));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createState() {
  return {
    version: SAVE_VERSION,
    missions: Object.fromEntries(MISSIONS.map(m => [m.id, { unlocked: false, careStep: 0, rescued: false, attempts: 0 }])),
    elapsed: 0,
    player: { x: 0, z: 13, yaw: 0 },
    cameraMode: 'third',
    selectedMission: 'tiger'
  };
}

function getProgress(state, id) {
  const mission = missionById.get(id);
  const progress = state?.missions?.[id];
  return mission && progress ? { mission, progress } : null;
}

function matchesSolution(answer, solution) {
  if (typeof solution === 'string') return typeof answer === 'string' && answer.trim() === solution;
  return Array.isArray(answer) && answer.length === solution.length && answer.every((v, i) => v === solution[i]);
}

export function applyPuzzle(state, id, answer) {
  const current = getProgress(state, id);
  if (!current) return { ok: false, message: 'This rescue site is not available.' };
  const { mission, progress } = current;
  if (progress.unlocked) return { ok: true, message: 'This obstacle is already cleared.', completed: progress.rescued };
  progress.attempts = Math.min(1000000, progress.attempts + 1);
  if (!matchesSolution(answer, mission.puzzle.solution)) {
    return { ok: false, message: `Not quite. ${mission.puzzle.hint}` };
  }
  progress.unlocked = true;
  return { ok: true, message: mission.puzzle.success, completed: false };
}

export function applyCare(state, id, choice) {
  const current = getProgress(state, id);
  if (!current) return { ok: false, message: 'This rescue site is not available.', completed: false };
  const { mission, progress } = current;
  if (!progress.unlocked) return { ok: false, message: 'Clear the rescue obstacle first.', completed: false };
  if (progress.rescued) return { ok: true, message: 'This animal is already safe.', completed: true };
  const step = mission.careSteps[progress.careStep];
  if (!step) return { ok: false, message: 'This care step is not available.', completed: false };
  progress.attempts = Math.min(1000000, progress.attempts + 1);
  if (choice !== step.correct) {
    return { ok: false, message: 'That does not fit the care plan. Read the options and try again.', completed: false };
  }
  progress.careStep += 1;
  progress.rescued = progress.careStep === mission.careSteps.length;
  return { ok: true, message: step.success, completed: progress.rescued };
}

export function rescueCount(state) {
  return MISSIONS.reduce((total, mission) => total + (state?.missions?.[mission.id]?.rescued === true ? 1 : 0), 0);
}

/** Return a clean state or null. Invalid progress cannot silently unlock a rescue. */
export function restoreState(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!record(value) || value.version !== SAVE_VERSION || !record(value.missions)) return null;
  if (!finite(value.elapsed) || value.elapsed < 0 || !record(value.player)) return null;
  if (!['x', 'z', 'yaw'].every(key => finite(value.player[key]))) return null;
  const result = createState();
  for (const mission of MISSIONS) {
    if (!Object.hasOwn(value.missions, mission.id)) return null;
    const p = value.missions[mission.id];
    if (!record(p) || typeof p.unlocked !== 'boolean' || typeof p.rescued !== 'boolean') return null;
    if (!Number.isInteger(p.careStep) || p.careStep < 0 || p.careStep > mission.careSteps.length) return null;
    if (!Number.isInteger(p.attempts) || p.attempts < 0) return null;
    if (!p.unlocked && p.careStep !== 0) return null;
    if (p.rescued !== (p.careStep === mission.careSteps.length)) return null;
    result.missions[mission.id] = {
      unlocked: p.unlocked, careStep: p.careStep, rescued: p.rescued,
      attempts: clamp(p.attempts, 0, 1000000)
    };
  }
  result.elapsed = clamp(value.elapsed, 0, 864000);
  result.player = {
    x: clamp(value.player.x, -46, 36),
    z: clamp(value.player.z, -46, 46),
    yaw: Math.atan2(Math.sin(value.player.yaw), Math.cos(value.player.yaw))
  };
  result.cameraMode = value.cameraMode === 'first' ? 'first' : 'third';
  result.selectedMission = missionById.has(value.selectedMission) ? value.selectedMission : 'tiger';
  return result;
}

export function serializeState(state) {
  const clean = restoreState(state);
  if (!clean) throw new TypeError('Cannot save invalid rescue progress.');
  return JSON.stringify(clean);
}
