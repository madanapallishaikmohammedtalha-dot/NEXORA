import { AppState } from '../types';
import { DataService, dataService, STORAGE_KEY } from './dataService';
import { INITIAL_SEEDED_STATE } from './seedData';

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

export function exportStateAsJSON(state: AppState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nexora_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importStateFromJSON(jsonString: string): AppState {
  const parsed = JSON.parse(jsonString);
  if (!parsed.profile || !parsed.subjects) {
    throw new Error('Invalid NEXORA backup file format: missing profile or subjects');
  }
  const restored: AppState = {
    ...INITIAL_SEEDED_STATE,
    ...parsed,
    goals: parsed.goals || INITIAL_SEEDED_STATE.goals,
    timeBlocks: parsed.timeBlocks || INITIAL_SEEDED_STATE.timeBlocks || {},
  };
  dataService.saveState(restored);
  return restored;
}

export function resetToDemoState(): AppState {
  return dataService.resetToSeedData();
}
