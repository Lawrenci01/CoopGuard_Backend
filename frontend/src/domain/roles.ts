import type { Role, TabName } from './types';
export const roleTabs: Record<Role, TabName[]> = {
  owner: ['Dashboard', 'Alerts', 'Heat Map', 'Analytics', 'Devices'],
  worker: ['Dashboard', 'Alerts', 'Heat Map', 'Notes'],
  technician: [],
  admin: [],
};
export const roleHomeTitle: Record<Role, string> = {
  owner: 'Farm overview',
  worker: 'Daily checks',
  technician: 'Technician setup',
  admin: 'Team administration',
};
