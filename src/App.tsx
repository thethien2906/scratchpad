import { MutableRefObject, useState, useEffect, useCallback, useRef } from 'react';
import { ActiveView, ProfileSummary } from './types';
import { api, isTauri, setUnauthorizedHandler } from './services/api';
import { useProjects } from './hooks/useProjects';
import { useAutoSave } from './hooks/useAutoSave';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ScheduleView, ScheduleViewHandle } from './components/ScheduleView';
import { DevConsole } from './components/DevConsole';
import { CreateProfileView } from './components/CreateProfileView';
import { ProfileGate } from './components/ProfileGate';

interface WorkspaceProps {
  currentProfile?: ProfileSummary | null;
  onSwitchProfile?: () => Promise<void>;
  flushRef?: MutableRefObject<(() => Promise<void>) | null>;
}

function Workspace({ currentProfile, onSwitchProfile, flushRef }: WorkspaceProps) {
  const {
    projects,
    loading: loadingProjects,
    createProject,
    updateProjectName,
    deleteProject,
  } = useProjects();

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#schedule')) {
      return { type: 'schedule' };
    }
    return { type: 'general' };
  });
  const [content, setContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);
  const scheduleRef = useRef<ScheduleViewHandle>(null);

  // Reference to current active view for async handlers
  const activeViewRef = useRef<ActiveView>(activeView);
  activeViewRef.current = activeView;

  // Auto-save callback for current active view
  const handleSave = useCallback(async (val: string) => {
    const current = activeViewRef.current;
    if (current.type === 'general') {
      await api.saveGeneralScratchpad(val);
    } else if (current.type === 'project') {
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
      if (view.type === 'schedule') {
        setIsLoadingContent(false);
        return;
      }
      setIsLoadingContent(true);
      try {
        if (view.type === 'general') {
          const text = await api.getGeneralScratchpad();
          setContent(text);
          resetSavedContent(text);
        } else if (view.type === 'project') {
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
    if (typeof window !== 'undefined') window.location.hash = '';
  };

  const handleSelectSchedule = async () => {
    if (activeView.type === 'schedule') return;
    await flush();
    setActiveView({ type: 'schedule' });
    if (typeof window !== 'undefined') window.location.hash = 'schedule';
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

  const flushAll = useCallback(async () => {
    await flush();
    await scheduleRef.current?.flush();
  }, [flush]);

  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = flushAll;
    return () => {
      if (flushRef.current === flushAll) flushRef.current = null;
    };
  }, [flushRef, flushAll]);

  const handleSwitchProfile = async () => {
    await flushAll();
    await onSwitchProfile?.();
  };

  // Find active project details
  const activeProject =
    activeView.type === 'project'
      ? projects.find((project) => project.id === activeView.projectId)
      : null;

  return (
    <div className="flex h-screen w-screen bg-dark-base text-text-primary antialiased font-sans overflow-hidden">
      <Sidebar
        activeView={activeView}
        projects={projects}
        loading={loadingProjects}
        onSelectGeneral={handleSelectGeneral}
        onSelectSchedule={handleSelectSchedule}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        currentProfile={currentProfile}
        onSwitchProfile={handleSwitchProfile}
      />

      {isLoadingContent ? (
        <div className="flex-1 flex items-center justify-center text-text-faint text-sm">
          Loading...
        </div>
      ) : activeView.type === 'schedule' ? (
        <ScheduleView ref={scheduleRef} />
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

type AuthState = 'checking' | 'locked' | 'authenticated';

function WebApp() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [currentProfile, setCurrentProfile] = useState<ProfileSummary | null>(null);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [profilesRefreshKey, setProfilesRefreshKey] = useState(0);
  const workspaceFlushRef = useRef<(() => Promise<void>) | null>(null);

  const handleUnauthorized = useCallback(() => {
    setCurrentProfile(null);
    setAuthState('locked');
  }, []);

  useEffect(() => {
    const unregister = setUnauthorizedHandler(handleUnauthorized);
    let active = true;
    api.getCurrentProfile()
      .then((profile) => {
        if (!active) return;
        setCurrentProfile(profile);
        setAuthState(profile ? 'authenticated' : 'locked');
      })
      .catch((error) => {
        console.error('Failed to restore profile session:', error);
        if (active) {
          setCurrentProfile(null);
          setAuthState('locked');
        }
      });

    return () => {
      active = false;
      unregister();
    };
  }, [handleUnauthorized]);

  const handleUnlocked = useCallback((profile: ProfileSummary) => {
    setCurrentProfile(profile);
    setAuthState('authenticated');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await workspaceFlushRef.current?.();
      await api.logoutProfile();
    } finally {
      setCurrentProfile(null);
      setAuthState('locked');
    }
  }, []);

  const handleOpenCreateProfile = useCallback(async () => {
    try {
      await workspaceFlushRef.current?.();
    } catch (error) {
      console.error('Failed to flush workspace before opening profile creation:', error);
    }
    setShowCreateProfile(true);
  }, []);

  const handleProfileCreated = useCallback(async () => {
    try {
      await api.logoutProfile();
    } catch (error) {
      console.error('Unable to clear the previous session:', error);
    }
    setCurrentProfile(null);
    setAuthState('locked');
    setShowCreateProfile(false);
    setProfilesRefreshKey((key) => key + 1);
  }, []);

  return (
    <>
      <DevConsole
        onOpenCreateProfile={() => { void handleOpenCreateProfile(); }}
        onLock={handleLogout}
        hasUnlockedProfile={authState === 'authenticated' && currentProfile !== null}
      />

      {showCreateProfile ? (
        <CreateProfileView
          onBack={() => setShowCreateProfile(false)}
          onProfileCreated={() => { void handleProfileCreated(); }}
        />
      ) : authState === 'checking' ? (
        <main className="fixed inset-0 flex items-center justify-center bg-dark-base text-sm text-text-muted">
          Loading…
        </main>
      ) : authState === 'locked' ? (
        <ProfileGate refreshKey={profilesRefreshKey} onUnlocked={handleUnlocked} />
      ) : currentProfile ? (
        <Workspace
          key={currentProfile.id}
          currentProfile={currentProfile}
          onSwitchProfile={handleLogout}
          flushRef={workspaceFlushRef}
        />
      ) : (
        <ProfileGate refreshKey={profilesRefreshKey} onUnlocked={handleUnlocked} />
      )}
    </>
  );
}

export default function App() {
  if (isTauri) return <Workspace />;
  return <WebApp />;
}
