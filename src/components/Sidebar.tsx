import React, { useState, useRef, useEffect } from 'react';
import { ActiveView, ProjectSummary } from '../types';
import { 
  Folder, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X 
} from 'lucide-react';

interface SidebarProps {
  activeView: ActiveView;
  projects: ProjectSummary[];
  loading: boolean;
  onSelectGeneral: () => void;
  onSelectProject: (id: number) => void;
  onCreateProject: (name: string) => Promise<void>;
  onRenameProject: (id: number, name: string) => Promise<void>;
  onDeleteProject: (id: number) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  projects,
  loading,
  onSelectGeneral,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewProjectName('');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewProjectName('');
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    await onCreateProject(trimmed);
    setNewProjectName('');
    setIsAdding(false);
  };

  const handleStartRename = (project: ProjectSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleRenameSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingId === null) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== projects.find(p => p.id === editingId)?.name) {
      await onRenameProject(editingId, trimmed);
    }
    setEditingId(null);
  };

  const handleDeleteConfirm = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await onDeleteProject(id);
    setDeletingId(null);
  };

  return (
    <aside className="w-64 h-full bg-dark-sidebar border-r border-dark-border flex flex-col select-none">
      {/* App Header */}
      <div className="px-5 py-5 border-b border-dark-border flex items-center justify-between">
        <span className="font-semibold text-text-primary text-base tracking-tight">
          Erwining
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Section: Creative Mode */}
        <div>
          <button
            onClick={onSelectGeneral}
            className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors duration-150 text-left ${
              activeView.type === 'general'
                ? 'bg-dark-active text-text-primary font-medium'
                : 'text-text-secondary hover:bg-dark-hover'
            }`}
          >
            <span className="truncate">Creative Mode</span>
          </button>
        </div>

        {/* Section: Projects */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            <span>Projects</span>
            <button
              onClick={handleStartAdd}
              title="Add Project"
              className="p-1 rounded hover:bg-dark-hover text-text-secondary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline Add Input */}
          {isAdding && (
            <form onSubmit={handleCreateSubmit} className="px-1 py-1">
              <div className="flex items-center gap-1.5 bg-[#202020] border border-dark-subtle rounded-md px-2.5 py-1.5">
                <Folder className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <input
                  ref={addInputRef}
                  type="text"
                  placeholder="Project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelAdd();
                  }}
                  onBlur={() => {
                    if (!newProjectName.trim()) setIsAdding(false);
                  }}
                  className="w-full text-xs text-text-primary outline-none bg-transparent placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  className="text-text-muted hover:text-text-primary p-0.5"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="text-text-muted hover:text-text-primary p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* Project List */}
          <div className="space-y-0.5">
            {loading && projects.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-faint">Loading...</div>
            ) : projects.length === 0 && !isAdding ? (
              <div className="px-3 py-3 text-xs text-text-faint text-center">
                No projects yet
              </div>
            ) : (
              projects.map((project) => {
                const isActive =
                  activeView.type === 'project' &&
                  activeView.projectId === project.id;
                const isEditing = editingId === project.id;
                const isDeleting = deletingId === project.id;

                if (isEditing) {
                  return (
                    <form
                      key={project.id}
                      onSubmit={handleRenameSubmit}
                      className="px-1 py-0.5"
                    >
                      <div className="flex items-center gap-1.5 bg-[#202020] border border-dark-subtle rounded-md px-2.5 py-1.5">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={handleRenameSubmit}
                          className="w-full text-xs text-text-primary outline-none bg-transparent"
                        />
                        <button
                          type="submit"
                          className="text-text-muted hover:text-text-primary"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    </form>
                  );
                }

                if (isDeleting) {
                  return (
                    <div
                      key={project.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-red-950/40 border border-red-800/40 text-red-300 rounded-md text-xs"
                    >
                      <span>Delete?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDeleteConfirm(project.id, e)}
                          className="font-medium hover:underline px-1 text-red-200"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="text-text-muted hover:text-text-primary px-1"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-dark-active text-text-primary font-medium'
                        : 'text-text-secondary hover:bg-dark-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Folder className="w-4 h-4 stroke-[1.75] flex-shrink-0 text-text-muted" />
                      <span className="truncate">{project.name}</span>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleStartRename(project, e)}
                        title="Rename"
                        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-[#303030] transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(project.id);
                        }}
                        title="Delete"
                        className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-[#303030] transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
