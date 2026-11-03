// What each app role can do in the UI. Firestore rules (firestore.rules) enforce the same thing server-side.
import { EVALUATOR_ROLES } from './constants.js';

export function defaultAppRole(person) {
  if (person.isAdmin) return 'admin';
  switch (person.currentRole) {
    case 'Manager': return 'manager';
    case 'Shift Leader': return 'shift_leader';
    case 'Area Captain': return 'captain';
    case 'Assistant Captain': return 'assistant_captain';
    default: return 'team_member';
  }
}

export const can = {
  admin: (m) => m?.role === 'admin',
  evaluate: (m) => EVALUATOR_ROLES.includes(m?.role),
  scoreShifts: (m) => !!m?.isManager && EVALUATOR_ROLES.includes(m?.role),
  seeAll: (m) => EVALUATOR_ROLES.includes(m?.role),
};
