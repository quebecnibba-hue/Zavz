import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { payloadsForProfile, projectNames } from './data/projects';
import { Header } from './components/Header';
import { NicknameModal } from './components/NicknameModal';
import { UpdateAlertModal } from './components/UpdateAlertModal';
import { ThemeModal } from './components/ThemeModal';
import { VersionModal } from './components/VersionModal';
import { ClientSelectionModal } from './components/ClientSelectionModal';
import { SettingsModal, type SettingsDraft } from './components/SettingsModal';
import { InjectionModal } from './components/InjectionModal';
import { LaunchCard, type LaunchState } from './components/dashboard/LaunchCard';
import type { AssetState } from './components/dashboard/FdpClientCard';
import { NewsPanel } from './components/dashboard/NewsPanel';
import { ChevronDown } from 'lucide-react';
import { ExternalLinks } from './components/dashboard/ExternalLinks';
import { PRODUCT } from './data/product';
import { useNews } from './hooks/useNews';
import { fetchInjectorConfig } from './utils/apiConnector';
import { openExternal } from './utils/openExternal';
import { loadInterfacePreferences, saveInterfacePreferences } from './utils/interfacePreferences';
import { playUiSound } from './utils/playSound';
import { isTauriRuntime } from './utils/runtime';
import type {
  FdpWrapper,
  InjectMode,
  InjectOptions,
  InjectorSettings,
  PayloadConfiguration,
  WatcherStatus,
} from './types/tauri';
import type { InterfacePreferences, NewsItem } from './types/product';

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'system';

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: LogType;
}

const METHOD_TO_BACKEND: Record<string, InjectorSettings['injectionMethod']> = {
  Standard: 'standard',
  Manual: 'manual_map',
  'Thread Hijack': 'thread_hijack',
  Reflective: 'reflective',
};

const METHOD_FROM_BACKEND: Record<InjectorSettings['injectionMethod'], string> = {
  standard: 'Standard',
  manual_map: 'Manual',
  thread_hijack: 'Thread Hijack',
  reflective: 'Reflective',
};

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '') || PRODUCT.version;
}

function normalizeInjectionError(message: string, usedPath: string): string {
  if (message.includes('System operation failed')) {
    return `DLL path is invalid or missing: ${usedPath}`;
  }
  return message;
}

function App() {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('zavz-nickname') || localStorage.getItem('yzy-nickname') || ''
  );
  const [appVersion, setAppVersion] = useState<string>(PRODUCT.version);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const { items: newsItems, state: newsState, retry: retryNews } = useNews();

  const [savedPreferences, setSavedPreferences] = useState(loadInterfacePreferences);
  const [previewPreferences, setPreviewPreferences] = useState(savedPreferences);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(() => !nickname);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInjectionModalOpen, setIsInjectionModalOpen] = useState(false);

  const [targetProcess, setTargetProcess] = useState('javaw.exe');
  const [dllPath, setDllPath] = useState('native.dll');
  const [injectionMethod, setInjectionMethod] = useState('Standard');
  const [fdpMode, setFdpMode] = useState(false);
  const [configuredPayloads, setPayloads] = useState<PayloadConfiguration>({
    selected: ['visuals'],
    allowMultiple: false,
    visualsJar: '',
    fdpclientJar: '',
    fdpLunarJar: '',
  });
  const payloads = useMemo(
    () => payloadsForProfile(configuredPayloads, nickname),
    [configuredPayloads, nickname]
  );
  const [fdpWrapper, setFdpWrapper] = useState<FdpWrapper>('auto');
  const [jvmArgs, setJvmArgs] = useState('-Xmx4G -XX:+UseG1GC -noverify');
  const [autoClose, setAutoClose] = useState(false);
  const [streamerMode, setStreamerMode] = useState(false);
  const [watcherActive, setWatcherActive] = useState(false);
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null);
  const [systemLog, setSystemLog] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 0, time: '--:--:--', message: 'ZAVZ initialized', type: 'system' },
  ]);
  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const [assetState, setAssetState] = useState<AssetState>('idle');
  const [assetDetail, setAssetDetail] = useState('');
  const logSequence = useRef(1);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((message: string, type: LogType = 'info') => {
    const entry: LogEntry = {
      id: logSequence.current++,
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      message,
      type,
    };
    setLogs((current) => [...current.slice(-49), entry]);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchInjectorConfig().then((config) => {
      if (!active) return;
      setAppVersion(normalizeVersion(config.version));
      setShowUpdateAlert(config.showUpdateAlert);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUiClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          'button, a, [role="button"], .ds-process-item, .ds-mode-option, .ds-client-option, .ds-client-selector, .ds-story-action, .ds-story-card'
        )
      ) {
        playUiSound(0.4);
      }
    };
    document.addEventListener('click', onUiClick, true);
    return () => document.removeEventListener('click', onUiClick, true);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    void invoke<InjectorSettings>('get_settings')
      .then((settings) => {
        if (disposed) return;
        if (settings.jvmArgs) setJvmArgs(settings.jvmArgs);
        setInjectionMethod(METHOD_FROM_BACKEND[settings.injectionMethod] ?? 'Standard');
        setAutoClose(settings.autoClose);
        setStreamerMode(settings.randomWindowTitle);
        setPayloads(settings.payloads);
        setFdpWrapper(settings.fdpWrapper);
      })
      .catch((error: unknown) => {
        if (!disposed) addLog(`Settings could not be loaded: ${String(error)}`, 'warning');
      });

    const registerListener = <T,>(eventName: string, type: LogType) => {
      void listen<T>(eventName, (event) => addLog(String(event.payload), type))
        .then((unlisten) => {
          if (disposed) unlisten();
          else unlisteners.push(unlisten);
        })
        .catch((error: unknown) => {
          if (!disposed) addLog(`Event listener unavailable: ${String(error)}`, 'warning');
        });
    };

    registerListener<string>('watcher-status', 'system');
    registerListener<string>('injection-log', 'info');
    void listen<WatcherStatus>('watcher-state', (event) => {
      if (disposed) return;
      setWatcherStatus(event.payload);
      if (event.payload.state === 'stopped') setWatcherActive(false);
      setLaunchState(
        event.payload.state === 'loading'
          ? 'working'
          : event.payload.state === 'success'
            ? 'success'
            : event.payload.state === 'error'
              ? 'error'
              : 'idle'
      );
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      })
      .catch((error: unknown) => {
        if (!disposed) addLog(`Watcher status unavailable: ${String(error)}`, 'warning');
      });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [addLog]);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  const nativeSettings = useCallback(
    (wrapper = fdpWrapper): InjectorSettings => ({
      jvmArgs,
      injectionMethod: METHOD_TO_BACKEND[injectionMethod] ?? 'standard',
      autoClose,
      randomWindowTitle: streamerMode,
      payloads,
      fdpWrapper: wrapper,
    }),
    [autoClose, payloads, fdpWrapper, injectionMethod, jvmArgs, streamerMode]
  );

  const handleSavePayloads = async (configuration: PayloadConfiguration) => {
    if (!isTauriRuntime()) {
      setPayloads(configuration);
      setIsVersionModalOpen(false);
      return;
    }
    if (watcherActive) {
      await invoke('stop_watcher');
      setWatcherActive(false);
      addLog('Watcher stopped to apply the new project selection.', 'system');
    }
    const canonical = await invoke<PayloadConfiguration>('configure_payloads', { configuration });
    setPayloads(canonical);
    addLog(`Selected projects: ${projectNames(canonical.selected)}.`, 'success');
    setIsVersionModalOpen(false);
  };

  const handleSaveSettings = async (draft: SettingsDraft) => {
    setTargetProcess(draft.targetProcess);
    setInjectionMethod(draft.injectionMethod);
    setJvmArgs(draft.jvmArgs);
    setAutoClose(draft.autoClose);
    setStreamerMode(draft.streamerMode);

    if (!isTauriRuntime()) {
      addLog('Settings previewed outside the desktop runtime.', 'warning');
      setIsSettingsModalOpen(false);
      return;
    }
    try {
      await invoke('save_settings', {
        settings: {
          ...nativeSettings(),
          jvmArgs: draft.jvmArgs,
          injectionMethod: METHOD_TO_BACKEND[draft.injectionMethod] ?? 'standard',
          autoClose: draft.autoClose,
          randomWindowTitle: draft.streamerMode,
        },
      });
      addLog('Application settings saved.', 'success');
      setIsSettingsModalOpen(false);
    } catch (error) {
      addLog(`Settings save failed: ${String(error)}`, 'error');
    }
  };

  const handleSelectClient = (wrapper: FdpWrapper) => {
    setFdpWrapper(wrapper);
    setTargetProcess(wrapper === 'auto' ? 'auto' : wrapper);
    addLog(`Target client set to ${wrapper}.`, 'system');
    if (!isTauriRuntime()) return;
    void invoke('save_settings', { settings: nativeSettings(wrapper) }).catch((error: unknown) => {
      addLog(`Client preference could not be saved: ${String(error)}`, 'error');
    });
  };

  const handlePrepareAssets = async () => {
    if (assetState === 'preparing') return;
    if (!isTauriRuntime()) {
      setAssetState('error');
      setAssetDetail('Install files is available in the desktop application.');
      return;
    }
    setAssetState('preparing');
    setAssetDetail(`Preparing ${projectNames(payloads.selected)}…`);
    addLog(`Preparing ${projectNames(payloads.selected)}…`, 'system');
    try {
      if (payloads.selected.includes('fdpclient')) {
        await invoke<string>('build_and_install_fdp_assets');
      }
      const result = await invoke<string>('ensure_payload_assets', { configuration: payloads });
      setAssetState('ready');
      setAssetDetail(`${projectNames(payloads.selected)} ready.`);
      setDllPath('native.dll');
      addLog(result, 'success');
    } catch (error) {
      const message = String(error);
      setAssetState('error');
      setAssetDetail(message);
      addLog(`Install files failed: ${message}`, 'error');
    }
  };

  const handleInject = async (
    mode: InjectMode,
    options?: InjectOptions,
    onProgress?: (progress: number, message: string) => void
  ) => {
    if (!isTauriRuntime()) {
      setLaunchState('error');
      throw new Error('Injection is available only in the desktop runtime.');
    }

    const tryInject = (
      path: string,
      target: string,
      method?: InjectorSettings['injectionMethod']
    ) =>
      invoke<string>('inject_dll', {
        request: {
          target,
          dllPath: path,
          method: payloads.selected.includes('fdplunar')
            ? 'standard'
            : (method ?? METHOD_TO_BACKEND[injectionMethod] ?? 'standard'),
          payloads: mode === 'detect' || payloads.selected.includes('fdplunar') ? payloads : null,
        },
      });

    setLaunchState('working');

    try {
      if (mode === 'manual' && !dllPath.trim()) throw new Error('No DLL selected.');

      let result: string;
      if (mode === 'detect') {
        const pids = options?.pids?.filter((pid) => Number.isFinite(pid) && pid > 0) ?? [];
        const singleTarget = options?.target?.trim() || '';

        if (pids.length === 0 && !singleTarget) {
          throw new Error('No Minecraft clients found.');
        }

        onProgress?.(8, 'Preparing the selected payload files…');
        const assets = await invoke<string>('ensure_payload_assets', { configuration: payloads });
        setAssetState('ready');
        setAssetDetail(`${projectNames(payloads.selected)} ready.`);
        addLog(assets, 'info');

        onProgress?.(15, 'Resolving the native loader…');
        const resolvedPath =
          options?.dllPath?.trim() ||
          (await invoke<string>('resolve_loader_dll', {
            configuration: payloads,
          }));
        setDllPath(resolvedPath);

        if (pids.length > 0) {
          addLog(`Injecting into ${pids.length} detected client(s)…`, 'system');
          const messages: string[] = [];
          for (const pid of pids) {
            onProgress?.(18, `Checking selected game process ${pid}…`);
            const message = await tryInject(resolvedPath, String(pid), 'standard');
            messages.push(message);
            addLog(message, 'success');
          }
          result = messages.join(' | ');
        } else {
          onProgress?.(18, `Checking selected game process ${singleTarget}…`);
          addLog(`Injecting into PID ${singleTarget}…`, 'system');
          result = await tryInject(resolvedPath, singleTarget, 'standard');
        }
      } else {
        const injectTarget = targetProcess;
        onProgress?.(12, 'Validating the selected DLL and game process…');
        addLog(`Injecting into ${injectTarget}…`, 'system');
        result = await tryInject(dllPath.trim(), injectTarget);
      }

      setLaunchState('success');
      addLog(result, 'success');
      if (autoClose) {
        closeTimeout.current = setTimeout(() => {
          if (isTauriRuntime()) void getCurrentWindow().close();
        }, 3000);
      }
    } catch (error) {
      const usedPath = mode === 'detect' ? dllPath || 'native.dll' : dllPath || '<empty>';
      const message = normalizeInjectionError(String(error), usedPath);
      setLaunchState('error');
      addLog(`Injection failed: ${message}`, 'error');
      throw new Error(message);
    }
  };

  const handleWatcherToggle = async (
    enabled: boolean,
    propagateError = false,
    manualDll?: string
  ) => {
    if (enabled && watcherActive) return;
    if (!isTauriRuntime()) {
      addLog('Process watcher requires the desktop runtime.', 'warning');
      if (propagateError) throw new Error('Process watcher requires the desktop runtime.');
      return;
    }
    if (enabled && !dllPath && !payloads.selected.includes('fdplunar')) {
      addLog('Select a DLL before starting the watcher.', 'error');
      if (propagateError) throw new Error('Select a DLL before starting the watcher.');
      return;
    }
    try {
      if (enabled) setWatcherStatus(null);
      if (enabled && payloads.selected.includes('fdplunar')) {
        await invoke<string>('ensure_payload_assets', { configuration: payloads });
      }
      const watcherDll = enabled
        ? manualDll || (await invoke<string>('resolve_loader_dll', { configuration: payloads }))
        : dllPath;
      const result = enabled
        ? await invoke<string>('start_watcher', {
            request: {
              target: payloads.selected.includes('fdplunar') ? 'lunar' : targetProcess,
              dllPath: watcherDll,
              method: payloads.selected.includes('fdplunar')
                ? 'standard'
                : (METHOD_TO_BACKEND[injectionMethod] ?? 'standard'),
              payloads,
            },
          })
        : await invoke<string>('stop_watcher');
      setWatcherActive(enabled);
      setWatcherStatus((current) =>
        enabled
          ? (current ?? { state: 'waiting', message: result })
          : { state: 'stopped', message: result }
      );
      addLog(result, enabled ? 'success' : 'warning');
    } catch (error) {
      setWatcherActive(false);
      setWatcherStatus({ state: 'error', message: String(error) });
      addLog(`Watcher failed: ${String(error)}`, 'error');
      if (propagateError) throw error;
    }
  };

  const handleSystemLogToggle = async (enabled: boolean) => {
    if (!isTauriRuntime()) return;
    try {
      const result = await invoke<string>('toggle_dll_console', { enable: enabled });
      setSystemLog(enabled);
      addLog(result, 'system');
    } catch (error) {
      addLog(`System log toggle failed: ${String(error)}`, 'error');
    }
  };

  const handleLaunchJvm = async (args = jvmArgs) => {
    if (payloads.selected.length !== 1) {
      addLog('Choose one JAR for the standalone Java launcher.', 'error');
      return;
    }
    const fdpPath =
      payloads.selected[0] === 'visuals'
        ? payloads.visualsJar
        : payloads.selected[0] === 'fdplunar'
          ? payloads.fdpLunarJar
          : payloads.fdpclientJar;
    if (!fdpPath) {
      addLog('Select a JAR file first.', 'error');
      return;
    }
    if (!isTauriRuntime()) return;
    try {
      const result = await invoke<string>('launch_jvm', {
        request: { jarPath: fdpPath, jvmArgs: args },
      });
      addLog(result, 'success');
    } catch (error) {
      addLog(`JVM launch failed: ${String(error)}`, 'error');
    }
  };

  const handleDrag = async (event: MouseEvent) => {
    if (event.button !== 0 || !isTauriRuntime()) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, a, [role="button"], .no-drag')) return;
    try {
      await getCurrentWindow().startDragging();
    } catch {
      addLog('Window drag is temporarily unavailable.', 'warning');
    }
  };

  const handleNicknameConfirm = (name: string) => {
    if (watcherActive) void handleWatcherToggle(false);
    localStorage.setItem('zavz-nickname', name);
    setNickname(name);
    setIsNicknameModalOpen(false);
    addLog(`Player profile updated to ${name}.`, 'success');
  };

  const handleNewsOpen = (item: NewsItem) => {
    playUiSound(0.4);
    if (item.url) void openExternal(item.url);
  };

  const savePreferences = (preferences: InterfacePreferences) => {
    saveInterfacePreferences(preferences);
    setSavedPreferences(preferences);
    setPreviewPreferences(preferences);
    setIsThemeModalOpen(false);
  };

  const latestMessage = logs[logs.length - 1]?.message ?? 'System ready.';
  const displayNickname = streamerMode ? 'Player' : nickname;

  return (
    <div
      className="ds-app-shell"
      style={{ '--effect-intensity': previewPreferences.effectsIntensity / 100 } as CSSProperties}
      data-appearance={previewPreferences.appearance}
      data-density={previewPreferences.density}
      data-motion={previewPreferences.animations ? 'on' : 'off'}
    >
      {isNicknameModalOpen && (
        <NicknameModal
          initialValue={nickname}
          onConfirm={handleNicknameConfirm}
          onClose={nickname ? () => setIsNicknameModalOpen(false) : undefined}
        />
      )}

      <Header
        nickname={displayNickname}
        onOpenNickname={() => setIsNicknameModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onDrag={handleDrag}
      />

      <main className="ds-dashboard" aria-label="ZAVZ dashboard">
        <div className="ds-compact-workspace">
          <LaunchCard
            version={`v${appVersion}`}
            client={fdpWrapper}
            selectedProjects={projectNames(payloads.selected)}
            fdpInject={payloads.selected.includes('fdplunar')}
            launchState={launchState}
            assetState={assetState}
            started={isInjectionModalOpen}
            statusMessage={
              watcherActive && watcherStatus
                ? watcherStatus.message
                : launchState === 'idle'
                  ? assetState === 'idle'
                    ? ''
                    : assetDetail
                  : latestMessage
            }
            onLaunch={() => setIsInjectionModalOpen(true)}
            onSelectClient={() => setIsClientModalOpen(true)}
            onPrepareAssets={() => void handlePrepareAssets()}
            onConfigureJar={() => setIsVersionModalOpen(true)}
            onCustomize={() => setIsThemeModalOpen(true)}
          />
          <div className="ds-feed-column">
            <NewsPanel
              items={newsItems}
              state={newsState}
              onOpen={handleNewsOpen}
              onRetry={retryNews}
            />
            <div className="ds-scroll-cue" aria-hidden="true">
              <ChevronDown size={20} />
            </div>
            <div className="ds-feed-dock">
              <ExternalLinks />
            </div>
          </div>
        </div>
      </main>

      <InjectionModal
        isOpen={isInjectionModalOpen}
        onClose={() => setIsInjectionModalOpen(false)}
        onInject={handleInject}
        dllPath={dllPath}
        setDllPath={setDllPath}
        fdpMode={fdpMode}
        setFdpMode={setFdpMode}
        fdpInject={payloads.selected.includes('fdplunar')}
        watcherActive={watcherActive}
        watcherStatus={watcherStatus}
        onStartLunar={(manualDll) => handleWatcherToggle(true, true, manualDll)}
        onStopLunar={() => handleWatcherToggle(false, true)}
      />
      <ClientSelectionModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        selected={fdpWrapper}
        onSelect={handleSelectClient}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        targetProcess={targetProcess}
        injectionMethod={injectionMethod}
        jvmArgs={jvmArgs}
        watcherActive={watcherActive}
        onWatcherToggle={(enabled) => void handleWatcherToggle(enabled)}
        autoClose={autoClose}
        streamerMode={streamerMode}
        systemLogActive={systemLog}
        onSystemLogToggle={(enabled) => void handleSystemLogToggle(enabled)}
        onSave={(draft) => void handleSaveSettings(draft)}
        onLaunchJvm={(args) => void handleLaunchJvm(args)}
      />
      <VersionModal
        profile={nickname}
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        configuration={payloads}
        onSave={handleSavePayloads}
      />
      <ThemeModal
        isOpen={isThemeModalOpen}
        value={savedPreferences}
        onClose={() => {
          setPreviewPreferences(savedPreferences);
          setIsThemeModalOpen(false);
        }}
        onPreview={setPreviewPreferences}
        onSave={savePreferences}
      />
      <UpdateAlertModal
        isOpen={showUpdateAlert}
        onClose={() => setShowUpdateAlert(false)}
        version={`v${appVersion}`}
      />
    </div>
  );
}

export default App;
