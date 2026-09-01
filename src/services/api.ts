import { invoke } from '@tauri-apps/api/core';
import { Project, ProjectSummary } from '../types';

// Check if running inside Tauri desktop environment
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Fallback in-memory / localStorage storage for testing in plain browser
const LOCAL_STORAGE_KEY_GENERAL = 'erwining_general_scratchpad';
const LOCAL_STORAGE_KEY_PROJECTS = 'erwining_projects';

export const api = {
  // General Scratchpad
  async getGeneralScratchpad(): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_general_scratchpad');
    }
    return localStorage.getItem(LOCAL_STORAGE_KEY_GENERAL) || '';
  },

  async saveGeneralScratchpad(content: string): Promise<void> {
    if (isTauri) {
      await invoke('save_general_scratchpad', { content });
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_GENERAL, content);
  },

  // Projects CRUD
  async listProjects(): Promise<ProjectSummary[]> {
    if (isTauri) {
      return await invoke<ProjectSummary[]>('list_projects');
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    if (!raw) return [];
    try {
      const projects: Project[] = JSON.parse(raw);
      return projects.map(p => ({ id: p.id, name: p.name, updated_at: p.updated_at }));
    } catch {
      return [];
    }
  },

  async createProject(name: string): Promise<Project> {
    if (isTauri) {
      return await invoke<Project>('create_project', { name });
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    const projects: Project[] = raw ? JSON.parse(raw) : [];
    const newProj: Project = {
      id: Date.now(),
      name,
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.unshift(newProj);
    localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    return newProj;
  },

  async updateProjectName(id: number, name: string): Promise<void> {
    if (isTauri) {
      await invoke('update_project_name', { id, name });
      return;
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    if (!raw) return;
    const projects: Project[] = JSON.parse(raw);
    const target = projects.find(p => p.id === id);
    if (target) {
      target.name = name;
      target.updated_at = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    }
  },

  async deleteProject(id: number): Promise<void> {
    if (isTauri) {
      await invoke('delete_project', { id });
      return;
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    if (!raw) return;
    const projects: Project[] = JSON.parse(raw);
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(filtered));
  },

  async getProject(id: number): Promise<Project> {
    if (isTauri) {
      return await invoke<Project>('get_project', { id });
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    const projects: Project[] = raw ? JSON.parse(raw) : [];
    const proj = projects.find(p => p.id === id);
    if (!proj) throw new Error(`Project ${id} not found`);
    return proj;
  },

  async getProjectContent(id: number): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_project_content', { id });
    }
    const proj = await this.getProject(id);
    return proj.content;
  },

  async saveProjectContent(id: number, content: string): Promise<void> {
    if (isTauri) {
      await invoke('save_project_content', { id, content });
      return;
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    if (!raw) return;
    const projects: Project[] = JSON.parse(raw);
    const target = projects.find(p => p.id === id);
    if (target) {
      target.content = content;
      target.updated_at = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    }
  }
};
