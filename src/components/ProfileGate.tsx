import React, { ClipboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError, ProfileSummary } from '../types';
import { api } from '../services/api';

interface ProfileGateProps {
  refreshKey: number;
  onUnlocked: (profile: ProfileSummary) => void;
}

const PIN_LENGTH = 4;

export const ProfileGate: React.FC<ProfileGateProps> = ({ refreshKey, onUnlocked }) => {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [pinError, setPinError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submitInProgress = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    api.listProfiles()
      .then((items) => {
        if (!cancelled) setProfiles(items);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message || 'Unable to load profiles.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedProfile) return;
    setPinDigits(Array(PIN_LENGTH).fill(''));
    setPinError('');
    setLockedUntil(null);
    setSecondsLeft(0);
    window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
  }, [selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitInProgress.current) {
        setSelectedProfile(null);
        setPinError('');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedProfile]);

  useEffect(() => {
    if (lockedUntil === null) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setLockedUntil(null);
        setPinError('');
        window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const submitPin = useCallback(async (profile: ProfileSummary, pin: string) => {
    if (submitInProgress.current) return;
    submitInProgress.current = true;
    setIsUnlocking(true);
    setPinError('');
    try {
      const unlockedProfile = await api.unlockProfile(profile.id, pin);
      onUnlocked(unlockedProfile);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        setPinError('Incorrect PIN');
        setPinDigits(Array(PIN_LENGTH).fill(''));
        window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
      } else if (apiError.status === 429) {
        const seconds = Math.max(1, apiError.retryAfterSeconds || 300);
        setLockedUntil(Date.now() + seconds * 1000);
        setSecondsLeft(seconds);
        setPinError('');
      } else {
        setPinError(apiError.message || 'Unable to unlock profile.');
        setPinDigits(Array(PIN_LENGTH).fill(''));
        window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
      }
    } finally {
      submitInProgress.current = false;
      setIsUnlocking(false);
    }
  }, [onUnlocked]);

  const updateDigit = (index: number, rawValue: string) => {
    if (!selectedProfile || isUnlocking || lockedUntil !== null) return;
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError('');
    if (digit && index < PIN_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (next.every((value) => value.length === 1)) {
      void submitPin(selectedProfile, next.join(''));
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (!selectedProfile || isUnlocking || lockedUntil !== null) return;
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill('') as string[];
    for (let index = 0; index < pasted.length; index += 1) next[index] = pasted[index];
    setPinDigits(next);
    setPinError('');
    if (pasted.length === PIN_LENGTH) {
      void submitPin(selectedProfile, pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleInputKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
      event.preventDefault();
      const next = [...pinDigits];
      next[index - 1] = '';
      setPinDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const closeModal = () => {
    if (submitInProgress.current) return;
    setSelectedProfile(null);
    setPinDigits(Array(PIN_LENGTH).fill(''));
    setPinError('');
  };

  return (
    <main className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-dark-base px-6 py-12 text-text-primary">
      <section className="w-full max-w-4xl">
        <header className="mb-10 text-center">
          <div className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Erwining</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Who&apos;s writing?</h1>
        </header>

        {isLoading ? (
          <p className="text-center text-sm text-text-muted">Loading profiles…</p>
        ) : loadError ? (
          <p role="alert" className="text-center text-sm text-red-300">{loadError}</p>
        ) : profiles.length === 0 ? (
          <p className="text-center text-sm text-text-muted">No profiles found.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-9">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelectedProfile(profile)}
                className="group flex w-32 flex-col items-center gap-3 text-center"
              >
                <span
                  className="flex h-28 w-28 items-center justify-center rounded-xl text-4xl font-semibold text-white shadow-lg ring-1 ring-white/5 transition-all duration-150 group-hover:scale-[1.03] group-hover:ring-white/40"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {(profile.name.trim()[0] || '?').toLocaleUpperCase()}
                </span>
                <span className="max-w-full truncate text-sm text-text-secondary transition-colors group-hover:text-text-primary">
                  {profile.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedProfile && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-5 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-profile-title"
            className="w-full max-w-sm rounded-xl border border-dark-border bg-[#181818] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-xl font-semibold text-white"
                  style={{ backgroundColor: selectedProfile.avatar_color }}
                >
                  {(selectedProfile.name.trim()[0] || '?').toLocaleUpperCase()}
                </span>
                <div>
                  <h2 id="unlock-profile-title" className="text-base font-medium">{selectedProfile.name}</h2>
                  <p className="mt-1 text-xs text-text-muted">Enter your 4-digit PIN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isUnlocking}
                aria-label="Close PIN entry"
                className="rounded p-1 text-text-muted transition-colors hover:bg-dark-hover hover:text-text-primary disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-7 flex justify-center gap-3" onPaste={handlePaste}>
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { inputRefs.current[index] = element; }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  aria-label={`PIN digit ${index + 1}`}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  disabled={isUnlocking || lockedUntil !== null}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleInputKeyDown(index, event)}
                  className="h-12 w-12 rounded-md border border-dark-border bg-[#202020] text-center text-lg text-text-primary outline-none transition-colors focus:border-neutral-400 disabled:opacity-50"
                />
              ))}
            </div>

            <div aria-live="polite" className="mt-4 min-h-5 text-center text-xs">
              {lockedUntil !== null ? (
                <span className="text-amber-300">Too many attempts. Try again in {secondsLeft}s</span>
              ) : isUnlocking ? (
                <span className="text-text-muted">Unlocking…</span>
              ) : pinError ? (
                <span role="alert" className="text-red-300">{pinError}</span>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
