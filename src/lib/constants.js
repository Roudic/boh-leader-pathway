export const DAYPARTS = ['AM', 'PM'];

// App roles stored on members/{email}.role
export const APP_ROLES = {
  admin: 'Admin',
  manager: 'Manager (MOD)',
  shift_leader: 'Shift Leader (MOD)',
  captain: 'Area Captain',
  assistant_captain: 'Assistant Captain',
  team_member: 'Team Member (learner)',
};
export const EVALUATOR_ROLES = ['admin', 'manager', 'shift_leader'];
export const LEARNER_ROLES = ['captain', 'assistant_captain', 'team_member'];

export const PERSON_ROLES = ['Admin', 'Manager', 'Shift Leader', 'Area Captain', 'Assistant Captain', 'Team Member'];
export const TARGET_ROLES = ['Assistant Captain', 'Area Captain', 'Shift Leader'];

export const PIPELINE_STAGES = [
  'Team Member',
  'Assistant Captain candidate',
  'Assistant Captain',
  'Area Captain candidate',
  'Area Captain',
  'Shift Leader candidate',
  'Shift Leader',
];

export const STATUS_LABEL = {
  none: '',
  prereqs_tbd: 'Prerequisites TBD',
  in_pathways: 'In Pathways',
  prerequisites_in_progress: 'Prerequisites in progress',
  ready_for_eval_shifts: 'Ready for shifts',
  eval_shifts_complete: 'Shifts complete',
  ready_for_promotion: 'Ready for promotion',
  promoted: 'Promoted',
};

export const LETTER_AUTHOR_ROLES = ['Manager', 'Shift Leader', 'Shift Leader in Training', 'Other'];
export const ATTENDANCE_STATUSES = ['on_time', 'late', 'absent', 'excused'];
export const ATTENDANCE_LABEL = { on_time: 'On time', late: 'Late', absent: 'Absent', excused: 'Excused' };
export const NOTE_TYPES = ['coaching', 'praise', 'follow-up'];

export const TBD = 'TBD';
