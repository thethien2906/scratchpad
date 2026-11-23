import { invoke } from '@tauri-apps/api/core';
import { ApiError, ProfileSummary, Project, ProjectSummary } from '../types';

// Check if running inside Tauri desktop environment
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      retry_after_seconds?: number;
    };
    const error = new Error(body.error || response.statusText || 'Request failed') as ApiError;
    error.status = response.status;
    if (body.code) error.code = body.code;
    if (typeof body.retry_after_seconds === 'number') {
      error.retryAfterSeconds = body.retry_after_seconds;
    }

    const path = url.split('?')[0];
    if (
      response.status === 401 &&
      path !== '/api/auth/unlock' &&
      path !== '/api/auth/me'
    ) {
      unauthorizedHandler?.();
    }
    throw error;
  }

  if (response.status === 204 || response.status === 205) return undefined as T;
  return await response.json() as T;
}

export const api = {
  // General Scratchpad
  async getGeneralScratchpad(): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_general_scratchpad');
    }
    const response = await apiFetch<{ content: string }>('/api/scratchpad');
    return response.content;
  },

  async saveGeneralScratchpad(content: string): Promise<void> {
    if (isTauri) {
      await invoke('save_general_scratchpad', { content });
      return;
    }
    await apiFetch<void>('/api/scratchpad', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  // Projects CRUD
  async listProjects(): Promise<ProjectSummary[]> {
    if (isTauri) {
      return await invoke<ProjectSummary[]>('list_projects');
    }
    return await apiFetch<ProjectSummary[]>('/api/projects');
  },

  async createProject(name: string): Promise<Project> {
    if (isTauri) {
      return await invoke<Project>('create_project', { name });
    }
    return await apiFetch<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateProjectName(id: number, name: string): Promise<void> {
    if (isTauri) {
      await invoke('update_project_name', { id, name });
      return;
    }
    await apiFetch<void>(`/api/projects/${id}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  async deleteProject(id: number): Promise<void> {
    if (isTauri) {
      await invoke('delete_project', { id });
      return;
    }
    await apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' });
  },

  async getProject(id: number): Promise<Project> {
    if (isTauri) {
      return await invoke<Project>('get_project', { id });
    }
    return await apiFetch<Project>(`/api/projects/${id}`);
  },

  async getProjectContent(id: number): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_project_content', { id });
    }
    const response = await apiFetch<{ content: string }>(`/api/projects/${id}/content`);
    return response.content;
  },

  async saveProjectContent(id: number, content: string): Promise<void> {
    if (isTauri) {
      await invoke('save_project_content', { id, content });
      return;
    }
    await apiFetch<void>(`/api/projects/${id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  // Schedule CRUD
  async getSchedule(key: string): Promise<string> {
    if (isTauri) {
      return await invoke<string>('get_schedule', { key });
    }
    const response = await apiFetch<{ content: string }>(`/api/schedules/${encodeURIComponent(key)}`);
    return response.content;
  },

  async saveSchedule(key: string, content: string): Promise<void> {
    if (isTauri) {
      await invoke('save_schedule', { key, content });
      return;
    }
    await apiFetch<void>(`/api/schedules/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  async deleteSchedule(key: string): Promise<void> {
    if (isTauri) {
      await invoke('delete_schedule', { key });
      return;
    }
    await apiFetch<void>(`/api/schedules/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },

  // Web profile and session API
  async listProfiles(): Promise<ProfileSummary[]> {
    return await apiFetch<ProfileSummary[]>('/api/profiles');
  },

  async createProfile(payload: {
    name: string;
    avatar_color: string;
    pin: string;
    admin_secret?: string;
  }): Promise<ProfileSummary> {
    return await apiFetch<ProfileSummary>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async unlockProfile(profileId: number, pin: string): Promise<ProfileSummary> {
    return await apiFetch<ProfileSummary>('/api/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ profile_id: profileId, pin }),
    });
  },

  async getCurrentProfile(): Promise<ProfileSummary | null> {
    try {
      return await apiFetch<ProfileSummary>('/api/auth/me');
    } catch (error) {
      if ((error as ApiError).status === 401) return null;
      throw error;
    }
  },

  async logoutProfile(): Promise<void> {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' });
  },

  async updateCurrentProfile(payload: {
    name?: string;
    avatar_color?: string;
    current_pin?: string;
    new_pin?: string;
  }): Promise<ProfileSummary> {
    return await apiFetch<ProfileSummary>('/api/profiles/current', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteCurrentProfile(pin: string): Promise<void> {
    await apiFetch<void>('/api/profiles/current', {
      method: 'DELETE',
      body: JSON.stringify({ pin }),
    });
  },
};
