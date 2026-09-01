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
  | { type: 'project'; projectId: number };
