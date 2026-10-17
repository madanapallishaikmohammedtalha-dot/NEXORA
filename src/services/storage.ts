import { AppState } from '../types';
import { dataService, STORAGE_KEY } from './dataService';
import { INITIAL_SEEDED_STATE } from './seedData';
import { validateBackupImport } from './validation';

export { STORAGE_KEY };
export const INITIAL_DEMO_STATE: AppState = INITIAL_SEEDED_STATE;

/**
 * Standard data access delegates routed through DataService
 */
export function loadAppState(): AppState {
  return dataService.getState();
}

export function saveAppState(state: AppState): void {
  dataService.saveState(state);
}

/**
 * Exports learner data as JSON while stripping API credentials for security.
 */
export function exportStateAsJSON(state: AppState): void {
  // Strip sensitive API keys before generating backup
  const sanitizedState: AppState = {
    ...state,
    profile: {
      ...state.profile,
      apiKey: undefined,
    },
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sanitizedState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nexora_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Validates and imports a NEXORA state backup with schema migration.
 */
export function importStateFromJSON(jsonString: string): AppState {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Corrupted JSON file: ${err.message}`);
  }

  const validation = validateBackupImport(parsed);
  if (!validation.isValid) {
    throw new Error(`Invalid NEXORA backup file format: ${validation.errors.map((e) => e.message).join('; ')}`);
  }

  const restored: AppState = {
    ...INITIAL_SEEDED_STATE,
    ...parsed,
    schemaVersion: 2,
    profile: {
      ...INITIAL_SEEDED_STATE.profile,
      ...parsed.profile,
      apiKey: undefined, // Do not import untrusted API keys
    },
    goals: Array.isArray(parsed.goals) ? parsed.goals : INITIAL_SEEDED_STATE.goals,
    timeBlocks: parsed.timeBlocks || INITIAL_SEEDED_STATE.timeBlocks || {},
    missions: parsed.missions || INITIAL_SEEDED_STATE.missions || {},
    learnerMemories: Array.isArray(parsed.learnerMemories) ? parsed.learnerMemories : (INITIAL_SEEDED_STATE.learnerMemories || []),
    projects: Array.isArray(parsed.projects) ? parsed.projects : (INITIAL_SEEDED_STATE.projects || []),
    activeFocusSession: null,
  };

  dataService.saveState(restored);
  return restored;
}

export function resetToDemoState(): AppState {
  return dataService.resetToSeedData();
}

