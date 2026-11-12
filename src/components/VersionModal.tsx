import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FolderOpen,
  FolderSearch,
  Layers,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { PROJECT_LABELS } from '../data/projects';
import { isTauriRuntime } from '../utils/runtime';
import type { PayloadConfiguration, PayloadId, PayloadStatus } from '../types/tauri';
import { Button } from './ui/Button';

interface VersionModalProps {
  profile: string;
  isOpen: boolean;
  onClose: () => void;
  configuration: PayloadConfiguration;
  onSave: (configuration: PayloadConfiguration) => Promise<void>;
}

type JarField = 'visualsJar' | 'fdpclientJar' | 'fdpLunarJar';

const PROJECTS: Array<{ id: PayloadId; field: JarField; detail: string; mark: ReactNode }> = [
  {
    id: 'visuals',
    field: 'visualsJar',
    detail: 'Effects, HUD and weapons for Minecraft 1.8.9',
    mark: <Sparkles size={17} aria-hidden="true" />,
  },
  {
    id: 'fdpclient',
    field: 'fdpclientJar',
    detail: 'Client for Minecraft 1.8.9',
    mark: <img src="/img/icon/social/fdp-logo.png" alt="" />,
  },
  {
    id: 'fdplunar',
    field: 'fdpLunarJar',
    detail: 'Client for Minecraft 1.8.9 | Lunar Client Compatible',
    mark: <img src="/img/icon/social/fdp-logo.png" alt="" />,
  },
];

const STATE_LABELS: Record<PayloadStatus['state'], string> = {
  ready: 'Ready',
  missing: 'No JAR',
  invalid: 'Wrong file',
};

function describeFile(status: PayloadStatus): string {
  const size = `${(status.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  const date = status.modifiedMs
    ? `, updated ${new Date(status.modifiedMs).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    : '';
  return `${size}${date}`;
}

export function VersionModal({
  isOpen,
  onClose,
  configuration,
  onSave,
  profile,
}: VersionModalProps) {
  const [draft, setDraft] = useState(configuration);
  const [statuses, setStatuses] = useState<Partial<Record<PayloadId, PayloadStatus>>>({});
  const [pickingField, setPickingField] = useState<JarField | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const wasOpen = useRef(false);
  const visible = useRef(isOpen);
  const selectionVersion = useRef(0);
  visible.current = isOpen;

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setDraft({ ...configuration, selected: [...configuration.selected] });
      setStatuses({});
      setPickingField(null);
      setError('');
    }
    if (!isOpen) selectionVersion.current++;
    wasOpen.current = isOpen;
  }, [configuration, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsChecking(true);
    const timer = window.setTimeout(() => {
      if (!isTauriRuntime()) {
        setIsChecking(false);
        return;
      }
      void invoke<PayloadStatus[]>('inspect_payloads', { configuration: draft })
        .then((result) => {
          if (active) setStatuses(Object.fromEntries(result.map((status) => [status.id, status])));
        })
        .catch((reason: unknown) => {
          if (active) setError(String(reason));
        })
        .finally(() => {
          if (active) setIsChecking(false);
        });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pickingField === null && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, pickingField, isSaving]);

  if (!isOpen) return null;

  const ensureSelected = (current: PayloadConfiguration, id: PayloadId): PayloadId[] =>
    current.allowMultiple && id !== 'fdplunar' && !current.selected.includes('fdplunar')
      ? [...new Set([...current.selected, id])]
      : [id];

  const toggleProject = (id: PayloadId) => {
    selectionVersion.current++;
    setDraft((current) => ({
      ...current,
      selected:
        current.allowMultiple && id !== 'fdplunar' && !current.selected.includes('fdplunar')
          ? current.selected.includes(id)
            ? current.selected.filter((value) => value !== id)
            : [...current.selected, id]
          : [id],
    }));
    setError('');
  };

  const setLoadBoth = (allowMultiple: boolean) => {
    selectionVersion.current++;
    setDraft((current) => ({
      ...current,
      allowMultiple,
      selected: allowMultiple ? current.selected : current.selected.slice(0, 1),
    }));
    setError('');
  };

  const changePath = (field: JarField, path: string) => {
    selectionVersion.current++;
    const project = PROJECTS.find((item) => item.field === field);
    if (!project) return;
    setStatuses({});
    setError('');
    setDraft((current) => ({
      ...current,
      [field]: path,
      selected: ensureSelected(current, project.id),
    }));
  };

  const identifyPath = async (field: JarField, path: string, ticket: number) => {
    if (!path.trim()) return;
    let project = PROJECTS.find((item) => item.field === field);
    if (!project) return;
    let reason = '';
    try {
      const id = await invoke<PayloadId>('identify_jar', { path });
      if (id === 'fdpclient' && profile !== 'Zywl') {
        throw new Error('This JAR is not supported by the available projects.');
      }
      project = PROJECTS.find((item) => item.id === id) ?? project;
    } catch (error: unknown) {
      reason = String(error);
    }
    if (ticket !== selectionVersion.current || !visible.current) return;
    const chosen = project;
    setStatuses({});
    setError(reason);
    setDraft((current) => ({
      ...current,
      [chosen.field]: path,
      selected: ensureSelected(current, chosen.id),
    }));
  };

  const pickJar = async (field: JarField) => {
    if (!isTauriRuntime()) {
      setError('The file picker is available in the desktop application.');
      return;
    }
    const ticket = ++selectionVersion.current;
    setPickingField(field);
    setError('');
    try {
      const path = await invoke<string | null>('pick_jar_file');
      if (path && ticket === selectionVersion.current && visible.current) {
        await identifyPath(field, path, ticket);
      }
    } catch (reason) {
      if (ticket === selectionVersion.current && visible.current) setError(String(reason));
    } finally {
      if (ticket === selectionVersion.current) setPickingField(null);
    }
  };

  const reveal = (path: string) => {
    if (!isTauriRuntime()) return;
    void invoke('reveal_in_explorer', { path }).catch((reason: unknown) =>
      setError(String(reason))
    );
  };

  const blockedProject = draft.selected.find((id) => statuses[id]?.state !== 'ready');
  const busy = isSaving || pickingField !== null;

  const save = async () => {
    if (busy || isChecking || blockedProject || !draft.selected.length) return;
    setIsSaving(true);
    setError('');
    try {
      await onSave(draft);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setIsSaving(false);
    }
  };

  const projects = PROJECTS.filter((project) => project.id !== 'fdpclient' || profile === 'Zywl');

  return (
    <div
      className="ds-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="ds-modal ds-project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-title"
      >
        <header className="ds-modal-header">
          <div className="ds-title-with-icon">
            <span className="ds-project-header-mark" aria-hidden="true">
              <Layers size={17} />
            </span>
            <div>
              <p className="ds-overline">Start loads</p>
              <h2 id="project-title">Choose a project</h2>
            </div>
          </div>
          <button
            type="button"
            className="ds-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close project selection"
          >
            <X size={16} />
          </button>
        </header>

        <div className="ds-project-body">
          <div
            className="ds-project-list"
            role={draft.allowMultiple ? 'group' : 'radiogroup'}
            aria-label="Projects"
          >
            {projects.map((project) => {
              const label = PROJECT_LABELS[project.id];
              const isSelected = draft.selected.includes(project.id);
              const status = statuses[project.id];
              const path = draft[project.field];
              return (
                <article
                  key={project.id}
                  className={`ds-project-card ${isSelected ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="ds-project-pick"
                    role={draft.allowMultiple ? 'checkbox' : 'radio'}
                    aria-checked={isSelected}
                    disabled={busy}
                    onClick={() => toggleProject(project.id)}
                  >
                    <span className="ds-project-mark">{project.mark}</span>
                    <span className="ds-project-title">
                      <strong>{label}</strong>
                      <small>{project.detail}</small>
                    </span>
                    {status ? (
                      <span className={`ds-project-state is-${status.state}`}>
                        {status.state === 'ready' ? (
                          <CheckCircle2 size={12} aria-hidden="true" />
                        ) : (
                          <AlertCircle size={12} aria-hidden="true" />
                        )}
                        {STATE_LABELS[status.state]}
                      </span>
                    ) : (
                      <span className="ds-project-state">
                        <Loader2 size={12} className="ds-spin" aria-hidden="true" />
                        Checking
                      </span>
                    )}
                    <span
                      className={`ds-project-check ${draft.allowMultiple ? 'is-square' : ''}`}
                      aria-hidden="true"
                    >
                      {isSelected && <Check size={12} />}
                    </span>
                  </button>

                  <div className="ds-project-file">
                    <input
                      value={path}
                      onChange={(event) => changePath(project.field, event.target.value)}
                      onBlur={(event) => {
                        if (isTauriRuntime()) {
                          const ticket = ++selectionVersion.current;
                          void identifyPath(project.field, event.target.value, ticket);
                        }
                      }}
                      spellCheck={false}
                      disabled={busy}
                      title={path}
                      placeholder="Choose a JAR or enter its full path"
                      aria-label={`${label} JAR location`}
                    />
                    <button
                      type="button"
                      onClick={() => reveal(path)}
                      disabled={busy || !path}
                      title="Show in folder"
                      aria-label={`Show the ${label} folder`}
                    >
                      <FolderSearch size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void pickJar(project.field)}
                      disabled={pickingField !== null || isSaving}
                      title="Choose file"
                      aria-label={`Choose the ${label} JAR`}
                    >
                      <FolderOpen size={15} />
                    </button>
                  </div>

                  {status && status.state === 'ready' && (
                    <p className="ds-project-note">{describeFile(status)}</p>
                  )}
                  {status && status.state !== 'ready' && (
                    <p className="ds-project-note is-error">{status.message}</p>
                  )}
                </article>
              );
            })}
          </div>

          <div className="ds-project-both">
            <span>
              <strong>Load both at once</strong>
              <small>Off: only the selected project loads.</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.allowMultiple}
              aria-label="Load both at once"
              className={`ds-switch ${draft.allowMultiple ? 'active' : ''}`}
              disabled={busy}
              onClick={() => setLoadBoth(!draft.allowMultiple)}
            >
              <span />
            </button>
          </div>

          {error && (
            <p className="ds-project-note is-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="ds-modal-footer">
          <span className="ds-project-footnote">Restart Minecraft before switching projects.</span>
          <div>
            <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void save()}
              loading={isSaving}
              disabled={busy || isChecking || Boolean(blockedProject) || !draft.selected.length}
            >
              Save selection
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
