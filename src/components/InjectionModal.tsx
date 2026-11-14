import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  FileCode2,
  FolderOpen,
  Gamepad2,
  Layers,
  Radar,
  RefreshCw,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button';
import type { InjectMode, InjectOptions, MinecraftClientInfo, WatcherStatus } from '../types/tauri';

type Step = 'select' | 'manual' | 'detect' | 'injecting' | 'error' | 'success';
type DetectSelection = 'all' | number;

interface InjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInject: (
    mode: InjectMode,
    options?: InjectOptions,
    onProgress?: (progress: number, message: string) => void
  ) => Promise<void>;
  dllPath: string;
  setDllPath: (path: string) => void;
  fdpMode: boolean;
  setFdpMode: (mode: boolean) => void;
  fdpInject?: boolean;
  watcherActive?: boolean;
  watcherStatus?: WatcherStatus | null;
  onStartLunar?: (dllPath?: string) => Promise<void>;
  onStopLunar?: () => Promise<void>;
}

interface SelectedDll {
  name: string;
  path: string;
}

const KIND_LABELS: Record<string, string> = {
  lunar: 'LunarClient',
  cheatbreaker: 'CheatBreaker',
  badlion: 'BadlionClient',
  cmclient: 'CMClient',
  vanilla: 'Vanilla',
  forge: 'Forge',
  minecraft: 'Minecraft',
};

function clientLabel(kind: string): string {
  return KIND_LABELS[kind.toLowerCase()] || kind || 'Minecraft';
}

export function InjectionModal({
  isOpen,
  onClose,
  onInject,
  dllPath: _dllPath,
  setDllPath,
  fdpMode: _fdpMode,
  setFdpMode,
  fdpInject = false,
  watcherActive = false,
  watcherStatus,
  onStartLunar,
  onStopLunar,
}: InjectionModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [startingLunar, setStartingLunar] = useState(false);
  const [activeMode, setActiveMode] = useState<InjectMode | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedDll | null>(null);
  const [manualError, setManualError] = useState('');
  const [detectError, setDetectError] = useState('');
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState('Initializing native operation…');
  const [operationError, setOperationError] = useState('');
  const [clients, setClients] = useState<MinecraftClientInfo[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [detectSelection, setDetectSelection] = useState<DetectSelection>('all');
  const [injectOptions, setInjectOptions] = useState<InjectOptions | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onInjectRef = useRef(onInject);

  useEffect(() => {
    onInjectRef.current = onInject;
  }, [onInject]);

  useEffect(() => {
    if (!isOpen) return;

    setStep('select');
    setActiveMode(null);
    setSelectedFile(null);
    setManualError('');
    setDetectError('');
    setProgress(0);
    setLogText('Initializing native operation…');
    setOperationError('');
    setClients([]);
    setDetectSelection('all');
    setInjectOptions(undefined);
  }, [isOpen, fdpInject]);

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    setDetectError('');
    try {
      const result = await invoke<MinecraftClientInfo[]>('list_minecraft_clients');
      const list = fdpInject
        ? (result || []).filter((client) => client.kind === 'lunar')
        : result || [];
      setClients(list);
      setDetectSelection(fdpInject && list.length > 0 ? list[0].pid : 'all');
      if (list.length === 0) {
        setDetectError(
          fdpInject
            ? 'Lunar Client is not open. Launch Lunar 1.8.9 and refresh the list.'
            : 'No Minecraft clients found.'
        );
      }
    } catch (reason) {
      setClients([]);
      setDetectError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setClientsLoading(false);
    }
  }, [fdpInject]);

  useEffect(() => {
    if (!isOpen || step !== 'detect') return;
    void fetchClients();
  }, [fetchClients, isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'injecting') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, step]);

  useEffect(() => {
    if (!isOpen || step !== 'injecting') return;

    let cancelled = false;
    let transitionTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: UnlistenFn | null = null;
    setProgress(5);
    setOperationError('');
    setLogText('Preparing the injection request…');

    const runInjection = async () => {
      try {
        unlisten = await listen<{ progress: number; message: string }>(
          'injection-progress',
          (event) => {
            if (cancelled) return;
            setProgress(event.payload.progress);
            setLogText(event.payload.message);
          }
        );
        if (cancelled) {
          unlisten();
          return;
        }
        if (!activeMode) throw new Error('No injection mode selected.');
        await onInjectRef.current(activeMode, injectOptions, (nextProgress, message) => {
          if (cancelled) return;
          setProgress(nextProgress);
          setLogText(message);
        });

        if (!cancelled) {
          setProgress(100);
          setLogText('Native injection completed.');
          transitionTimer = setTimeout(() => {
            if (!cancelled) setStep('success');
          }, 650);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setProgress(0);
          setLogText(message || 'Injection failed. Review the target and try again.');
          setOperationError(message || 'Injection failed. Review the target and try again.');
          setStep('error');
        }
      }
    };

    void runInjection();
    return () => {
      cancelled = true;
      if (transitionTimer) clearTimeout(transitionTimer);
      unlisten?.();
    };
  }, [activeMode, injectOptions, isOpen, step]);

  if (!isOpen) return null;

  const extractNativePath = (file: File): string | null => {
    const nativePath = (file as File & { path?: string }).path;
    return nativePath && !nativePath.startsWith('C:\\fakepath\\') ? nativePath : null;
  };

  const setManualDll = (path: string, name: string) => {
    setSelectedFile({ path, name });
    setDllPath(path);
    setManualError('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nativePath = extractNativePath(file);
    if (!nativePath) {
      setSelectedFile(null);
      setDllPath('');
      setManualError('The absolute path is unavailable. Use the native file picker.');
      return;
    }
    setManualDll(nativePath, file.name);
  };

  const handleBrowseDll = async () => {
    setIsPickingFile(true);
    setManualError('');
    try {
      const selectedPath = await invoke<string | null>('pick_dll_file');
      if (!selectedPath) return;
      const normalizedPath = selectedPath.replace(/\//g, '\\');
      setManualDll(normalizedPath, normalizedPath.split('\\').pop() || normalizedPath);
    } catch {
      setManualError('The native picker could not be opened. Try again.');
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const nativePath = extractNativePath(file);
    if (!nativePath) {
      setManualError('The dropped file path is unavailable. Use the native file picker.');
      return;
    }
    setManualDll(nativePath, file.name);
  };

  const handleDetectInject = () => {
    if (clients.length === 0) {
      setDetectError('No Minecraft clients found.');
      return;
    }

    if (detectSelection === 'all') {
      setInjectOptions({
        pids: clients.map((client) => client.pid),
        ...(selectedFile ? { dllPath: selectedFile.path } : {}),
      });
    } else {
      setInjectOptions({
        target: String(detectSelection),
        ...(selectedFile ? { dllPath: selectedFile.path } : {}),
      });
    }

    setFdpMode(true);
    setActiveMode('detect');
    setDetectError('');
    setStep('injecting');
  };

  const title =
    step === 'select'
      ? fdpInject
        ? 'FDPClient Inject'
        : 'Select injection mode'
      : step === 'manual'
        ? 'Manual payload'
        : step === 'detect'
          ? fdpInject
            ? 'Select Lunar process'
            : 'Detect clients'
          : step === 'error'
            ? 'Injection failed'
            : 'Injection';

  return (
    <div
      className="ds-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== 'injecting') onClose();
      }}
    >
      <section
        className="ds-modal ds-injection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="injection-title"
      >
        {step !== 'injecting' && step !== 'success' && (
          <header className="ds-modal-header">
            <div>
              <p className="ds-overline">Native operation</p>
              <h2 id="injection-title">{title}</h2>
            </div>
            <div className="ds-header-actions">
              {step === 'detect' && (
                <button
                  className="ds-icon-button"
                  onClick={() => void fetchClients()}
                  disabled={clientsLoading}
                  aria-label="Refresh client list"
                >
                  <RefreshCw size={15} className={clientsLoading ? 'animate-spin' : ''} />
                </button>
              )}
              <button className="ds-icon-button" onClick={onClose} aria-label="Close injection">
                <X size={16} />
              </button>
            </div>
          </header>
        )}

        <div className="ds-injection-body">
          {step === 'select' && fdpInject && (
            <div className="ds-manual-payload">
              <p className="ds-field-help">
                Open Lunar Client 1.8.9 and inject from the menu, singleplayer, or multiplayer.
                Select the current FDPClient Inject JAR in the JAR window first.
              </p>
              <Button
                disabled={watcherActive || startingLunar || isPickingFile}
                icon={<Zap size={16} />}
                onClick={() => {
                  setFdpMode(true);
                  setActiveMode('detect');
                  setDetectError('');
                  setStep('detect');
                }}
              >
                Inject into running Lunar
              </Button>
              {watcherStatus && (
                <div className="ds-process-state" role="status" aria-live="polite">
                  {watcherStatus.state === 'success' ? (
                    <CheckCircle2 size={24} />
                  ) : watcherStatus.state === 'error' ? (
                    <AlertTriangle size={24} />
                  ) : (
                    <Radar size={24} />
                  )}
                  <strong>
                    {watcherStatus.state === 'success'
                      ? 'FDPClient Inject loaded'
                      : watcherStatus.state === 'loading'
                        ? 'Loading FDPClient Inject'
                        : watcherStatus.state === 'error'
                          ? 'Startup failed'
                          : watcherStatus.state === 'stopped'
                            ? 'Watcher stopped'
                            : 'Waiting for the next Lunar startup'}
                  </strong>
                  <span>{watcherStatus.message}</span>
                </div>
              )}
              <p className="ds-field-help">
                DLL: {selectedFile?.path || 'Bundled FDPClient Inject loader'}
              </p>
              <div className="ds-modal-inline-actions">
                <Button
                  variant="ghost"
                  loading={isPickingFile}
                  disabled={watcherActive || startingLunar}
                  onClick={() => void handleBrowseDll()}
                >
                  Choose DLL
                </Button>
                {selectedFile && (
                  <Button
                    variant="ghost"
                    disabled={watcherActive || startingLunar}
                    onClick={() => setSelectedFile(null)}
                  >
                    Use bundled DLL
                  </Button>
                )}
              </div>
              <Button
                variant="secondary"
                loading={startingLunar}
                disabled={watcherActive ? !onStopLunar : !onStartLunar}
                icon={<Radar size={16} />}
                onClick={() => {
                  setStartingLunar(true);
                  setManualError('');
                  const operation = watcherActive
                    ? onStopLunar?.()
                    : onStartLunar?.(selectedFile?.path);
                  void operation
                    ?.catch((error: unknown) => setManualError(String(error)))
                    .finally(() => setStartingLunar(false));
                }}
              >
                {watcherActive ? 'Stop watching' : 'Watch next Lunar startup'}
              </Button>
              {manualError && (
                <p className="ds-field-error" role="alert">
                  {manualError}
                </p>
              )}
            </div>
          )}
          {step === 'select' && !fdpInject && (
            <div className="ds-mode-grid">
              <button
                className="ds-mode-option"
                onClick={() => {
                  setFdpMode(false);
                  setActiveMode('manual');
                  setManualError('');
                  setStep('manual');
                }}
              >
                <span className="ds-mode-icon-row">
                  <span className="ds-icon-tile">
                    <FolderOpen size={20} />
                  </span>
                  <span className="ds-icon-tile soft">
                    <FileCode2 size={16} />
                  </span>
                </span>
                <span>
                  <strong>Manual</strong>
                  <small>Pick a local DLL payload with the secure native file picker.</small>
                </span>
              </button>
              <button
                className="ds-mode-option accent"
                onClick={() => {
                  setFdpMode(true);
                  setActiveMode('detect');
                  setDetectError('');
                  setStep('detect');
                }}
              >
                <span className="ds-mode-icon-row">
                  <span className="ds-icon-tile">
                    <Radar size={20} />
                  </span>
                  <span className="ds-icon-tile soft">
                    <Crosshair size={16} />
                  </span>
                </span>
                <span>
                  <strong>Detect</strong>
                  <small>Scan running Minecraft clients and inject into selected PIDs.</small>
                </span>
              </button>
            </div>
          )}

          {step === 'manual' && (
            <div className="ds-manual-payload">
              <div
                className={`ds-drop-zone ${selectedFile ? 'selected' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dll,.lib"
                  onChange={handleFileSelect}
                  hidden
                />
                {selectedFile ? <CheckCircle2 size={26} /> : <FileCode2 size={26} />}
                <strong>{selectedFile?.name || 'Drop a DLL here'}</strong>
                <span>
                  {selectedFile
                    ? 'Payload path validated and ready.'
                    : 'Or select a file using the native Windows picker.'}
                </span>
              </div>
              <Button
                variant="secondary"
                loading={isPickingFile}
                icon={<FolderOpen size={15} />}
                onClick={() => void handleBrowseDll()}
              >
                Browse DLL
              </Button>
              {manualError && (
                <p className="ds-field-error" role="alert">
                  {manualError}
                </p>
              )}
              <div className="ds-modal-inline-actions">
                <Button
                  variant="ghost"
                  icon={<ArrowLeft size={15} />}
                  onClick={() => setStep('select')}
                >
                  Back
                </Button>
                <Button
                  icon={<Zap size={15} />}
                  disabled={!selectedFile}
                  onClick={() => {
                    setFdpMode(false);
                    setActiveMode('manual');
                    setInjectOptions(undefined);
                    setStep('injecting');
                  }}
                >
                  Inject
                </Button>
              </div>
            </div>
          )}

          {step === 'detect' && (
            <div className="ds-detect-panel">
              <div className="ds-detect-list" aria-live="polite">
                {clientsLoading && (
                  <div className="ds-process-state">
                    <RefreshCw size={20} className="animate-spin" />
                    <strong>Scanning Minecraft clients…</strong>
                    <span>
                      {fdpInject
                        ? 'Looking for Lunar Client 1.8.9.'
                        : 'Looking for LunarClient, CheatBreaker, Badlion, and more.'}
                    </span>
                  </div>
                )}

                {!clientsLoading && clients.length === 0 && (
                  <div className="ds-process-state">
                    <Gamepad2 size={22} />
                    <strong>No clients detected</strong>
                    <span>
                      {fdpInject
                        ? 'Open Lunar Client 1.8.9 and refresh the list.'
                        : 'Open LunarClient, CheatBreaker, Badlion, CMClient, or Vanilla first.'}
                    </span>
                  </div>
                )}

                {!clientsLoading && clients.length > 0 && (
                  <>
                    <button
                      type="button"
                      className={`ds-process-item ${detectSelection === 'all' ? 'selected' : ''}`}
                      onClick={() => setDetectSelection('all')}
                    >
                      <span className="ds-icon-tile">
                        <Layers size={16} />
                      </span>
                      <span>
                        <strong>All</strong>
                        <small>
                          Inject into every detected client ({clients.length}{' '}
                          {clients.length === 1 ? 'process' : 'processes'})
                        </small>
                      </span>
                    </button>
                    {clients.map((client) => (
                      <button
                        type="button"
                        className={`ds-process-item ${detectSelection === client.pid ? 'selected' : ''}`}
                        key={client.pid}
                        onClick={() => setDetectSelection(client.pid)}
                      >
                        <span className="ds-icon-tile">
                          <Crosshair size={16} />
                        </span>
                        <span>
                          <strong>
                            {clientLabel(client.kind)} · PID {client.pid}
                          </strong>
                          <small>
                            {client.name}
                            {client.title ? ` · ${client.title}` : ''}
                          </small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {detectError && (
                <p className="ds-field-error" role="alert">
                  {detectError}
                </p>
              )}

              <div className="ds-modal-inline-actions">
                <Button
                  variant="ghost"
                  icon={<ArrowLeft size={15} />}
                  onClick={() => setStep('select')}
                >
                  Back
                </Button>
                <Button
                  icon={<Zap size={15} />}
                  loading={clientsLoading}
                  onClick={handleDetectInject}
                >
                  Inject
                </Button>
              </div>
            </div>
          )}

          {step === 'injecting' && (
            <div className="ds-operation-state" aria-live="polite">
              <span className="ds-operation-orbit">
                <ShieldCheck size={28} />
              </span>
              <p className="ds-overline">Protected native operation</p>
              <h2 id="injection-title">Injecting payload</h2>
              <p>{logText}</p>
              <div
                className="ds-operation-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="ds-operation-state error" aria-live="assertive">
              <span className="ds-operation-failure">
                <AlertTriangle size={30} />
              </span>
              <p className="ds-overline">Operation stopped</p>
              <h2>Payload was not injected</h2>
              <p className="ds-operation-error-message" role="alert">
                {operationError || logText}
              </p>
              <div className="ds-modal-inline-actions ds-operation-error-actions">
                <Button
                  variant="ghost"
                  icon={<ArrowLeft size={15} />}
                  onClick={() => {
                    setOperationError('');
                    setStep(
                      activeMode === 'manual'
                        ? 'manual'
                        : activeMode === 'detect'
                          ? 'detect'
                          : 'select'
                    );
                  }}
                >
                  Back
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="ds-operation-state success" aria-live="polite">
              <span className="ds-operation-success">
                <CheckCircle2 size={32} />
              </span>
              <p className="ds-overline">Operation complete</p>
              <h2 id="injection-title">Injection successful</h2>
              <p>The payload was injected into the selected target process.</p>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
