import React, { FormEvent, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { ApiError } from '../types';
import { api } from '../services/api';

interface CreateProfileViewProps {
  onBack: () => void;
  onProfileCreated: () => void;
}

const AVATAR_COLORS = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#10b981',
  '#14b8a6',
];

const fieldClassName =
  'w-full rounded-md border border-dark-border bg-[#1b1b1b] px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-neutral-500';

export const CreateProfileView: React.FC<CreateProfileViewProps> = ({ onBack, onProfileCreated }) => {
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Profile name is required.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must contain exactly four digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    if (!adminSecret) {
      setError('Admin Secret is required.');
      return;
    }

    setIsCreating(true);
    try {
      await api.createProfile({
        name: trimmedName,
        avatar_color: avatarColor,
        pin,
        admin_secret: adminSecret,
      });
      onProfileCreated();
    } catch (createError) {
      const apiError = createError as ApiError;
      setError(
        apiError.code === 'ADMIN_SECRET_INVALID'
          ? 'Admin Secret is incorrect.'
          : apiError.status === 409
            ? 'A profile with this name already exists.'
            : apiError.message || 'Unable to create profile.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-dark-base px-5 py-10 text-text-primary">
      <section className="w-full max-w-md space-y-7">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <header>
          <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Erwining</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create Profile</h1>
          <p className="mt-2 text-sm text-text-muted">Set up a private writing space.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="profile-name" className="block text-xs font-medium text-text-secondary">Profile Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={48}
              autoComplete="off"
              className={fieldClassName}
              placeholder="Name"
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-text-secondary">Avatar Color</legend>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select avatar color ${color}`}
                  aria-pressed={avatarColor === color}
                  onClick={() => setAvatarColor(color)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                    avatarColor === color ? 'ring-2 ring-neutral-100 ring-offset-2 ring-offset-dark-base' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="profile-pin" className="block text-xs font-medium text-text-secondary">PIN (4 digits)</label>
              <input
                id="profile-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                autoComplete="new-password"
                value={pin}
                onChange={(event) => setPin(digitsOnly(event.target.value))}
                className={fieldClassName}
                placeholder="••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-pin-confirm" className="block text-xs font-medium text-text-secondary">Confirm PIN</label>
              <input
                id="profile-pin-confirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                autoComplete="new-password"
                value={confirmPin}
                onChange={(event) => setConfirmPin(digitsOnly(event.target.value))}
                className={fieldClassName}
                placeholder="••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-secret" className="block text-xs font-medium text-text-secondary">Admin Secret</label>
            <input
              id="admin-secret"
              type="password"
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              autoComplete="new-password"
              className={fieldClassName}
              placeholder="Enter server admin secret"
              required
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#303030] px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-[#3c3c3c] disabled:cursor-wait disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {isCreating ? 'Creating…' : 'Create Profile'}
          </button>
        </form>
      </section>
    </main>
  );
};
