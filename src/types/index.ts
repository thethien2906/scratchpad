export interface Project {
  id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  updated_at: string;
}

export type SaveStatusState = 'saved' | 'saving' | 'unsaved' | 'error';

export type ActiveView = 
  | { type: 'general' }
  | { type: 'schedule' }
  | { type: 'project'; projectId: number };

export type ScheduleColor = 'default' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';

export interface ScheduleCell {
  text: string;
  color?: ScheduleColor;
  note?: string;
}

export type ScheduleData = Record<string, ScheduleCell>;
