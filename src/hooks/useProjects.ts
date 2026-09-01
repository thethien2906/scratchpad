import { useState, useEffect, useCallback } from 'react';
import { ProjectSummary, Project } from '../types';
import { api } from '../services/api';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (name: string): Promise<Project> => {
    const newProj = await api.createProject(name);
    await fetchProjects();
    return newProj;
  };

  const updateProjectName = async (id: number, name: string): Promise<void> => {
    await api.updateProjectName(id, name);
    await fetchProjects();
  };

  const deleteProject = async (id: number): Promise<void> => {
    await api.deleteProject(id);
    await fetchProjects();
  };

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    updateProjectName,
    deleteProject,
  };
}
