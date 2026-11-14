// TypeScript type definitions for Tauri backend commands

export interface ProcessInfo {
  pid: number;
  name: string;
}

export interface MinecraftClientInfo {
  pid: number;
  name: string;
  kind: string;
  title: string;
}

export type InjectMode = 'manual' | 'detect';

export interface InjectOptions {
  target?: string;
  pids?: number[];
  dllPath?: string;
}

export type InjectionMethod = 'standard' | 'manual_map' | 'thread_hijack' | 'reflective';
/** FDP Mode target preference — backend falls back to any open game JVM. */
export type FdpWrapper =
  | 'auto'
  | 'lunar'
  | 'badlion'
  | 'cmclient'
  | 'cheatbreaker'
  | 'vanilla'
  | 'forge';

export interface InjectRequest {
  payloads?: PayloadConfiguration | null;
  target: string;
  dllPath: string;
  method: InjectionMethod;
}

export interface WatcherRequest {
  payloads: PayloadConfiguration;
  target: string;
  dllPath: string;
  method: InjectionMethod;
}

export interface WatcherStatus {
  state: 'waiting' | 'loading' | 'success' | 'error' | 'stopped';
  message: string;
}

export type PayloadId = 'visuals' | 'fdpclient' | 'fdplunar';
export interface PayloadConfiguration {
  selected: PayloadId[];
  allowMultiple: boolean;
  visualsJar: string;
  fdpclientJar: string;
  fdpLunarJar: string;
}

export interface PayloadStatus {
  id: PayloadId;
  path: string;
  state: 'ready' | 'missing' | 'invalid';
  message: string;
  sizeBytes: number;
  modifiedMs: number;
}

export interface InjectorSettings {
  jvmArgs: string;
  injectionMethod: InjectionMethod;
  autoClose: boolean;
  randomWindowTitle: boolean;
  payloads: PayloadConfiguration;
  fdpWrapper: FdpWrapper;
}

// Tauri command type definitions
export interface TauriCommands {
  list_processes: () => Promise<ProcessInfo[]>;
  list_minecraft_clients: () => Promise<MinecraftClientInfo[]>;
  inject_dll: (request: InjectRequest) => Promise<string>;
  start_watcher: (request: WatcherRequest) => Promise<string>;
  stop_watcher: () => Promise<string>;
  resolve_loader_dll: (configuration?: PayloadConfiguration) => Promise<string>;
  ensure_payload_assets: (configuration: PayloadConfiguration) => Promise<string>;
  configure_payloads: (configuration: PayloadConfiguration) => Promise<PayloadConfiguration>;
  identify_jar: (path: string) => Promise<PayloadId>;
  build_and_install_fdp_assets: () => Promise<string>;
  pick_dll_file: () => Promise<string | null>;
  get_settings: () => Promise<InjectorSettings>;
  save_settings: (settings: InjectorSettings) => Promise<string>;
}

// Type-safe invoke wrapper
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export async function invokeCommand<K extends keyof TauriCommands>(
  command: K,
  args?: Parameters<TauriCommands[K]>[0]
): Promise<ReturnType<TauriCommands[K]>> {
  const argumentName =
    command === 'save_settings'
      ? 'settings'
      : command === 'configure_payloads' ||
          command === 'ensure_payload_assets' ||
          command === 'resolve_loader_dll'
        ? 'configuration'
        : 'request';
  return tauriInvoke(command, args ? { [argumentName]: args } : undefined) as Promise<
    ReturnType<TauriCommands[K]>
  >;
}
