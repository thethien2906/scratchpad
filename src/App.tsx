import { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveView } from './types';
import { api } from './services/api';
import { useProjects } from './hooks/useProjects';
import { useAutoSave } from './hooks/useAutoSave';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';

export default function App() {
  const {
    projects,
    loading: loadingProjects,
    createProject,
    updateProjectName,
    deleteProject,
  } = useProjects();

  const [activeView, setActiveView] = useState<ActiveView>({ type: 'general' });
  const [content, setContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);

  // Reference to current active view for async handlers
  const activeViewRef = useRef<ActiveView>(activeView);
  activeViewRef.current = activeView;

  // Auto-save callback for current active view
  const handleSave = useCallback(async (val: string) => {
    const current = activeViewRef.current;
    if (current.type === 'general') {
      await api.saveGeneralScratchpad(val);
    } else {
      await api.saveProjectContent(current.projectId, val);
    }
  }, []);

  const { status: saveStatus, flush, resetSavedContent } = useAutoSave({
    content,
    onSave: handleSave,
    debounceMs: 500,
  });

  // Load content whenever activeView changes
  const loadContentForView = useCallback(
    async (view: ActiveView) => {
      setIsLoadingContent(true);
      try {
        if (view.type === 'general') {
          const text = await api.getGeneralScratchpad();
          setContent(text);
          resetSavedContent(text);
        } else {
          const text = await api.getProjectContent(view.projectId);
          setContent(text);
          resetSavedContent(text);
        }
      } catch (err) {
        console.error('Failed to load content for view:', view, err);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [resetSavedContent]
  );

  // Initial load
  useEffect(() => {
    loadContentForView(activeView);
  }, [loadContentForView, activeView]);

  // Safe navigation with flush on switch
  const handleSelectGeneral = async () => {
    if (activeView.type === 'general') return;
    await flush();
    setActiveView({ type: 'general' });
  };

  const handleSelectProject = async (id: number) => {
    if (activeView.type === 'project' && activeView.projectId === id) return;
    await flush();
    setActiveView({ type: 'project', projectId: id });
  };

  const handleCreateProject = async (name: string) => {
    await flush();
    const newProj = await createProject(name);
    setActiveView({ type: 'project', projectId: newProj.id });
  };

  const handleDeleteProject = async (id: number) => {
    if (activeView.type === 'project' && activeView.projectId === id) {
      setActiveView({ type: 'general' });
    }
    await deleteProject(id);
  };

  const handleRenameProject = async (id: number, name: string) => {
    await updateProjectName(id, name);
  };

  // Find active project details
  const activeProject =
    activeView.type === 'project'
      ? projects.find((p) => p.id === activeView.projectId)
      : null;

  return (
    <div className="flex h-screen w-screen bg-dark-base text-text-primary antialiased font-sans overflow-hidden">
      {/* Minimalist Dark Sidebar */}
      <Sidebar
        activeView={activeView}
        projects={projects}
        loading={loadingProjects}
        onSelectGeneral={handleSelectGeneral}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Editor */}
      {isLoadingContent ? (
        <div className="flex-1 flex items-center justify-center text-text-faint text-sm">
          Loading...
        </div>
      ) : activeView.type === 'general' ? (
        <Editor
          title="Creative Mode"
          isProject={false}
          content={content}
          saveStatus={saveStatus}
          onChangeContent={setContent}
        />
      ) : activeProject ? (
        <Editor
          title={activeProject.name}
          isProject={true}
          content={content}
          saveStatus={saveStatus}
          onChangeContent={setContent}
          onRenameTitle={(newName) => handleRenameProject(activeProject.id, newName)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Project not found. Select another item from the sidebar.
        </div>
      )}
    </div>
  );
}
