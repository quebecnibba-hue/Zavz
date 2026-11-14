#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ffi_bridge;
mod injection_method;
mod injector;
mod manual_map;
mod payloads;
mod reflective;
mod thread_hijack;

use std::{fs, path::PathBuf, sync::Mutex, time::Duration};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sysinfo::{ProcessRefreshKind, System};
use tauri::{generate_context, AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::{sync::oneshot, time::sleep};

const EMBEDDED_LOADER_DLL: &[u8] = include_bytes!("../../src/load/native.dll");
const EMBEDDED_LUNAR_DLL: &[u8] = include_bytes!("../../src/load/fdp-lunar.dll");

#[derive(Debug, Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MinecraftClientInfo {
    pid: u32,
    name: String,
    kind: String,
    title: String,
}

use injection_method::InjectionMethod;
use payloads::{PayloadConfiguration, PayloadId};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
enum FdpWrapper {
    Auto,
    Lunar,
    Badlion,
    Cmclient,
    Cheatbreaker,
    Vanilla,
    Forge,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
struct InjectorSettings {
    jvm_args: String,
    injection_method: InjectionMethod,
    auto_close: bool,
    random_window_title: bool,
    payloads: PayloadConfiguration,
    fdp_wrapper: FdpWrapper,
    #[serde(skip_serializing)]
    fdp_jar_path: Option<String>,
}

impl Default for InjectorSettings {
    fn default() -> Self {
        Self {
            jvm_args: String::new(),
            injection_method: InjectionMethod::Standard,
            auto_close: false,
            random_window_title: false,
            payloads: PayloadConfiguration::default(),
            fdp_wrapper: FdpWrapper::Auto,
            fdp_jar_path: None,
        }
    }
}

impl InjectorSettings {
    fn healed(mut self) -> Self {
        if let Some(legacy) = self.fdp_jar_path.take() {
            if self.payloads.fdpclient_jar.trim().is_empty() {
                self.payloads.fdpclient_jar = legacy;
            }
        }
        self.payloads = self.payloads.healed();
        self
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InjectRequest {
    target: String,
    dll_path: String,
    method: InjectionMethod,
    payloads: Option<PayloadConfiguration>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
struct InjectionProgress {
    progress: u8,
    message: String,
}

fn emit_injection_progress(app: &AppHandle, progress: u8, message: &str) {
    let _ = app.emit(
        "injection-progress",
        InjectionProgress {
            progress,
            message: message.to_string(),
        },
    );
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatcherRequest {
    target: String,
    dll_path: String,
    method: InjectionMethod,
    payloads: PayloadConfiguration,
}

struct WatcherHandle {
    stop: oneshot::Sender<()>,
}

#[derive(Debug, Clone, Serialize)]
struct WatcherStatus {
    state: &'static str,
    message: String,
}

fn emit_watcher_status(app: &AppHandle, state: &'static str, message: impl Into<String>) {
    let message = message.into();
    let _ = app.emit("watcher-status", &message);
    let _ = app.emit("watcher-state", WatcherStatus { state, message });
}

#[derive(Default)]
struct WatcherState {
    handle: Mutex<Option<WatcherHandle>>,
}

fn settings_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = payloads::root().join("injector");
    fs::create_dir_all(&config_dir)
        .map_err(|err| format!("Failed to create config folder: {err}"))?;
    Ok(config_dir.join("settings.json"))
}

fn materialize_loader_dll(_app: &AppHandle) -> Result<PathBuf, String> {
    materialize_dll("native.dll", EMBEDDED_LOADER_DLL)
}

fn materialize_lunar_dll() -> Result<PathBuf, String> {
    let hash = Sha256::digest(EMBEDDED_LUNAR_DLL);
    materialize_dll(&format!("fdp-lunar-{:x}.dll", hash), EMBEDDED_LUNAR_DLL)
}

fn materialize_dll(name: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let directory = payloads::root().join("injector");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let dll = directory.join(name);
    if fs::read(&dll).ok().as_deref() != Some(bytes) {
        if dll.is_file() {
            let stamp = chrono_like_now();
            fs::copy(&dll, directory.join(format!("{name}.backup-{stamp}")))
                .map_err(|e| e.to_string())?;
        }
        fs::write(&dll, bytes)
            .map_err(|e| format!("Could not install updated ZAVZ loader DLL: {e}"))?;
    }
    dll.canonicalize().map_err(|e| e.to_string())
}

fn decode_settings_text(bytes: &[u8]) -> String {
    if let [0xFF, 0xFE, rest @ ..] = bytes {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        return String::from_utf16_lossy(&units);
    }
    let text = String::from_utf8_lossy(bytes);
    text.trim_start_matches('\u{feff}').to_string()
}

fn parse_settings(bytes: &[u8]) -> Result<InjectorSettings, serde_json::Error> {
    serde_json::from_str(&decode_settings_text(bytes))
}

fn load_settings(path: &PathBuf) -> Result<InjectorSettings, String> {
    if !path.exists() {
        return Ok(InjectorSettings::default());
    }
    let bytes =
        fs::read(path).map_err(|err| format!("Failed to read {}: {err}", path.display()))?;
    parse_settings(&bytes).map_err(|err| format!("{} is not valid: {err}", path.display()))
}

#[tauri::command]
async fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut system = System::new();
        system.refresh_processes_specifics(ProcessRefreshKind::new());

        system
            .processes()
            .values()
            .map(|process| ProcessInfo {
                pid: process.pid().as_u32(),
                name: process.name().to_string(),
            })
            .collect::<Vec<ProcessInfo>>()
    })
    .await
    .map_err(|err| format!("Failed to read running processes: {err}"))
}

#[tauri::command]
async fn list_minecraft_clients() -> Result<Vec<MinecraftClientInfo>, String> {
    let clients = tauri::async_runtime::spawn_blocking(injector::list_game_clients)
        .await
        .map_err(|err| format!("Failed to detect Minecraft clients: {err}"))??;
    Ok(clients
        .into_iter()
        .map(|client| MinecraftClientInfo {
            pid: client.pid,
            name: client.name,
            kind: client.kind,
            title: client.title,
        })
        .collect())
}

#[cfg(windows)]
const WINDOW_EDGE_COLORREF: u32 = 0x0012_1212;

#[cfg(windows)]
fn hide_window_border(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
    };

    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    for attribute in [DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR] {
        unsafe {
            DwmSetWindowAttribute(
                hwnd.0,
                attribute as u32,
                (&WINDOW_EDGE_COLORREF as *const u32).cast(),
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}

#[cfg(not(windows))]
fn hide_window_border(_window: &tauri::WebviewWindow) {}

fn configure_window(app: &AppHandle) -> Result<(), tauri::Error> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_decorations(false)?;
        hide_window_border(&window);
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

fn import_legacy_settings(app: &AppHandle, path: &std::path::Path) -> Option<InjectorSettings> {
    let legacy = app
        .path()
        .config_dir()
        .ok()?
        .join("Zavz")
        .join("settings.json");
    if !legacy.is_file() {
        return None;
    }
    let settings = match load_settings(&legacy) {
        Ok(settings) => settings,
        Err(reason) => {
            let _ = append_fdp_inject_log(&format!("WARN old settings ignored: {reason}\n"));
            return None;
        }
    };
    let _ = fs::copy(&legacy, path.with_file_name("settings.legacy-backup.json"));
    Some(settings)
}

fn set_aside_broken_settings(path: &std::path::Path, reason: &str) {
    let _ = append_fdp_inject_log(&format!("WARN settings reset: {reason}\n"));
    let backup = path.with_file_name(format!("settings.invalid-{}.json", chrono_like_now()));
    let _ = fs::rename(path, backup);
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<InjectorSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        if let Some(settings) = import_legacy_settings(&app, &path) {
            let settings = settings.healed();
            save_settings(app, settings.clone())?;
            return Ok(settings);
        }
        return Ok(InjectorSettings::default().healed());
    }
    let settings = match load_settings(&path) {
        Ok(settings) => settings,
        Err(reason) => {
            set_aside_broken_settings(&path, &reason);
            InjectorSettings::default()
        }
    };
    Ok(settings.healed())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: InjectorSettings) -> Result<String, String> {
    let settings = settings.healed();
    settings.payloads.validate()?;
    let path = settings_path(&app)?;
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|err| format!("Failed to serialize: {err}"))?;
    let incoming = path.with_extension("json.incoming");
    fs::write(&incoming, data).map_err(|err| format!("Failed to save settings: {err}"))?;
    fs::rename(&incoming, &path).map_err(|err| format!("Failed to save settings: {err}"))?;
    Ok("Settings saved.".to_string())
}

#[tauri::command]
async fn inject_dll(app: AppHandle, request: InjectRequest) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(configuration) = request
            .payloads
            .as_ref()
            .filter(|p| p.selected.contains(&PayloadId::Fdplunar))
        {
            let selected = payloads::resolve_selected(configuration)?;
            payloads::require_runtime_bundle(&selected[0].1)?;
        }
        inject_selected(&app, request)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn inject_selected(app: &AppHandle, request: InjectRequest) -> Result<String, String> {
    let early_lunar = request
        .payloads
        .as_ref()
        .is_some_and(|p| p.selected.contains(&PayloadId::Fdplunar));
    if let Some(configuration) = &request.payloads {
        configuration.validate()?;
    }
    if early_lunar && !matches!(request.method, InjectionMethod::Standard) {
        return Err("FDPClient Inject uses the Standard DLL loader.".into());
    }
    emit_injection_progress(app, 5, "Checking the selected game process…");
    // Validate target process name
    if request.target.is_empty() {
        return Err("Process name cannot be empty.".to_string());
    }

    // Validate DLL path
    let dll_path = PathBuf::from(&request.dll_path);
    if !dll_path.exists() {
        return Err(
            "System operation failed. Please check for updates or contact support for assistance."
                .to_string(),
        );
    }

    if !dll_path.is_file() {
        return Err(
            "System operation failed. Please check for updates or contact support for assistance."
                .to_string(),
        );
    }

    // Validate DLL extension
    let extension = dll_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    if extension != "dll" && extension != "lib" {
        return Err(format!(
            "File must have .dll or .lib extension, found: .{}",
            extension
        ));
    }

    // Resolve target: PID | name | badlion | lunar | auto (FDP smart detect)
    let (process, resolved) = injector::resolve_injection_target(&request.target)?;
    if early_lunar
        && !injector::list_game_clients()?
            .iter()
            .any(|p| p.pid == resolved.pid && p.kind == "lunar")
    {
        return Err("FDPClient Inject can only be loaded into a Lunar game JVM.".into());
    }

    // Hard refuse browsers even if title matched "Badlion"
    let name_l = resolved.name.to_ascii_lowercase();
    if name_l.contains("chrome")
        || name_l.contains("msedge")
        || name_l.contains("firefox")
        || name_l.contains("browser")
        || name_l.contains("electron")
    {
        let err = format!(
            "Refused to load into {} (pid={}): only the game's java or javaw process is allowed.",
            resolved.name, resolved.pid
        );
        let _ = append_fdp_inject_log(&format!("ERR {}\n", err));
        return Err(err);
    }

    emit_injection_progress(
        app,
        22,
        "Checking whether the ZAVZ loader is already present…",
    );
    if thread_hijack::is_module_loaded(resolved.pid, &dll_path)? {
        let error = format!(
            "The ZAVZ loader is already loaded in PID {}. Close and restart that game process before retrying; no second injection was started.",
            resolved.pid
        );
        let _ = append_fdp_inject_log(&format!("ERR {}\n", error));
        return Err(error);
    }

    emit_injection_progress(app, 44, "Validating payload files…");
    let payload_result = if let Some(configuration) = &request.payloads {
        let installed = prepare_selected_payloads(app, configuration)?;
        Some(payloads::write_plan(
            resolved.pid,
            configuration,
            &installed,
        )?)
    } else {
        None
    };

    let log_line = format!(
        "[{}] target={} dll={} -> {} [{}] pid={}\n",
        chrono_like_now(),
        request.target,
        dll_path.display(),
        resolved.name,
        resolved.kind,
        resolved.pid
    );
    let _ = append_fdp_inject_log(&log_line);

    emit_injection_progress(
        app,
        58,
        "Injecting the ZAVZ loader into the selected process…",
    );
    let result = injector::inject_dll(process, &dll_path, request.method);

    match result {
        Ok(_) => {
            if let Some(result) = payload_result {
                emit_injection_progress(
                    app,
                    76,
                    if early_lunar {
                        "Waiting for FDPClient Inject to finish loading (up to five minutes)…"
                    } else {
                        "Waiting for Minecraft to confirm the payload (up to 30 seconds)…"
                    },
                );
                let outcome = payloads::wait_result(resolved.pid, &result, early_lunar);
                payloads::discard_plan(resolved.pid);
                if let Err(error) = outcome {
                    let _ = append_fdp_inject_log(&format!("ERR {}\n", error));
                    return Err(error);
                }
            }
            let mut response = String::new();
            if matches!(request.method, InjectionMethod::ManualMap) {
                response.push_str("[STEALTH MODE] ");
            } else if matches!(request.method, InjectionMethod::ThreadHijack) {
                response.push_str("[THREAD HIJACK] ");
            } else if matches!(request.method, InjectionMethod::Reflective) {
                response.push_str("[REFLECTIVE] ");
            }
            response.push_str(&format!(
                "Loaded into {} [{}] pid={}",
                resolved.name, resolved.kind, resolved.pid
            ));
            let _ = append_fdp_inject_log(&format!("OK {}\n", response));
            Ok(response)
        }
        Err(e) => {
            payloads::discard_plan(resolved.pid);
            let _ = append_fdp_inject_log(&format!("ERR {}\n", e));
            Err(e)
        }
    }
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn append_fdp_inject_log(line: &str) -> Result<(), String> {
    let home = payloads::root().join("injector");
    fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let path = home.join("zavz-inject.log");
    use std::io::Write;
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    f.write_all(line.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_watcher(
    app: AppHandle,
    state: State<'_, WatcherState>,
    request: WatcherRequest,
) -> Result<String, String> {
    let mut guard = state
        .handle
        .lock()
        .map_err(|_| "Watcher state corrupted.".to_string())?;

    if guard.is_some() {
        return Err("Watcher is already running.".to_string());
    }

    // Validate target process name
    if request.target.is_empty() {
        return Err("Process name cannot be empty.".to_string());
    }

    // Validate DLL path
    let dll_path = PathBuf::from(&request.dll_path);
    if !dll_path.exists() {
        return Err(format!("DLL file not found: {}", request.dll_path));
    }

    if !dll_path.is_file() {
        return Err(format!(
            "Specified path is not a file: {}",
            request.dll_path
        ));
    }

    // Validate DLL extension
    let extension = dll_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    if extension != "dll" && extension != "lib" {
        return Err(format!(
            "File must have .dll or .lib extension, found: .{}",
            extension
        ));
    }

    let (stop_tx, mut stop_rx) = oneshot::channel();
    let early_lunar = request.payloads.selected.contains(&PayloadId::Fdplunar);
    request.payloads.validate()?;
    if early_lunar {
        if !matches!(request.method, InjectionMethod::Standard) {
            return Err(
                "FDPClient Inject uses the Standard DLL loader during game startup.".into(),
            );
        }
        prepare_selected_payloads(&app, &request.payloads)?;
    }
    // Existing JVMs are never startup targets, even if their window disappears.
    let mut excluded = if early_lunar {
        injector::existing_lunar_processes()
    } else {
        Default::default()
    };
    let message = if early_lunar {
        if excluded.is_empty() {
            "Waiting for Lunar startup. Launch Lunar Client 1.8.9 from its official launcher."
        } else {
            "Lunar is already running. Close the game and launch it again from the official launcher; ZAVZ is watching for the next startup."
        }
        .to_string()
    } else {
        format!("Waiting for {}...", request.target)
    };
    emit_watcher_status(&app, "waiting", &message);
    let target = request.target;
    let method = request.method;
    let payload_configuration = request.payloads;
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut last_pid: Option<u32> = None;
        let mut waiting_reported = true;

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let next = if early_lunar {
                injector::resolve_next_lunar_startup(&excluded)
                    .map(|(process, info, identity)| (process, info, Some(identity)))
            } else {
                injector::resolve_injection_target(&target)
                    .map(|(process, info)| (process, info, None))
            };
            match next {
                Ok((proc, info, identity)) => {
                    if !early_lunar {
                        waiting_reported = false;
                    }
                    if last_pid != Some(info.pid) {
                        drop(proc);
                        last_pid = Some(info.pid);
                        if let Some(identity) = identity {
                            excluded.insert(identity);
                        }
                        emit_watcher_status(
                            &app_handle,
                            "loading",
                            if early_lunar {
                                "New Lunar startup detected. Waiting for FDPClient Inject to initialize..."
                            } else {
                                "Process found. Injecting..."
                            },
                        );
                        let app_for_inject = app_handle.clone();
                        let request = InjectRequest {
                            target: info.pid.to_string(),
                            dll_path: dll_path.to_string_lossy().into_owned(),
                            method,
                            payloads: Some(payload_configuration.clone()),
                        };
                        let outcome = tauri::async_runtime::spawn_blocking(move || {
                            inject_selected(&app_for_inject, request)
                        })
                        .await;
                        if stop_rx.try_recv().is_ok() {
                            break;
                        }
                        match outcome.unwrap_or_else(|error| Err(error.to_string())) {
                            Ok(_) => {
                                emit_watcher_status(
                                    &app_handle,
                                    "success",
                                    format!(
                                        "Selected payloads initialized in {} [{}] pid={}!",
                                        info.name, info.kind, info.pid
                                    ),
                                );
                                last_pid = Some(info.pid);
                            }
                            Err(err) => {
                                emit_watcher_status(
                                    &app_handle,
                                    "error",
                                    format!("Error: {}", err),
                                );
                            }
                        }
                    }
                }
                Err(_) => {
                    if !early_lunar || !waiting_reported {
                        emit_watcher_status(
                            &app_handle,
                            "waiting",
                            format!("Waiting for {}...", target),
                        );
                    }
                    waiting_reported = true;
                    last_pid = None;
                }
            }

            sleep(if early_lunar {
                Duration::from_millis(100)
            } else {
                Duration::from_secs(2)
            })
            .await;
        }
    });

    *guard = Some(WatcherHandle { stop: stop_tx });

    Ok(message)
}

#[tauri::command]
fn stop_watcher(app: AppHandle, state: State<'_, WatcherState>) -> Result<String, String> {
    let mut guard = state
        .handle
        .lock()
        .map_err(|_| "Watcher state corrupted.".to_string())?;

    if let Some(handle) = guard.take() {
        let _ = handle.stop.send(());
        emit_watcher_status(&app, "stopped", "Watcher stopped.");
        return Ok("Watcher stopped.".to_string());
    }

    Err("Watcher is not active.".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchJvmRequest {
    jar_path: String,
    jvm_args: String,
}

#[tauri::command]
fn launch_jvm(request: LaunchJvmRequest) -> Result<String, String> {
    use std::process::Command;

    let jar_path = PathBuf::from(&request.jar_path);
    if !jar_path.exists() {
        return Err(format!("JAR file not found: {}", request.jar_path));
    }

    // Split JVM arguments
    let args: Vec<&str> = if request.jvm_args.is_empty() {
        vec![]
    } else {
        request.jvm_args.split_whitespace().collect()
    };

    // Build command
    let mut cmd = Command::new("java");

    // Add JVM arguments
    for arg in args {
        cmd.arg(arg);
    }

    // Add JAR
    cmd.arg("-jar");
    cmd.arg(jar_path.to_str().unwrap());

    // Spawn process
    match cmd.spawn() {
        Ok(_) => Ok(format!(
            "Java launched successfully!\nArguments: {}",
            request.jvm_args
        )),
        Err(e) => Err(format!("Failed to launch Java: {}", e)),
    }
}

fn injector_home_dir() -> PathBuf {
    payloads::root().join("injector")
}

#[tauri::command]
fn resolve_loader_dll(
    app: AppHandle,
    configuration: Option<PayloadConfiguration>,
) -> Result<String, String> {
    let lunar = configuration
        .as_ref()
        .is_some_and(|p| p.selected.contains(&PayloadId::Fdplunar));
    let dll = if lunar {
        materialize_lunar_dll()?
    } else {
        materialize_loader_dll(&app)?
    };
    Ok(dll.to_string_lossy().into_owned())
}

fn prepare_selected_payloads(
    _app: &AppHandle,
    configuration: &PayloadConfiguration,
) -> Result<Vec<(PayloadId, PathBuf)>, String> {
    payloads::resolve_selected(&configuration.clone().with_resolved_paths())
}

#[tauri::command]
fn configure_payloads(
    app: AppHandle,
    configuration: PayloadConfiguration,
) -> Result<PayloadConfiguration, String> {
    prepare_selected_payloads(&app, &configuration)?;
    let canonical = configuration.with_resolved_paths().healed();
    let mut settings = get_settings(app.clone())?;
    settings.payloads = canonical.clone();
    save_settings(app, settings)?;
    Ok(canonical)
}

#[tauri::command]
fn ensure_payload_assets(
    app: AppHandle,
    configuration: PayloadConfiguration,
) -> Result<String, String> {
    let installed = prepare_selected_payloads(&app, &configuration)?;
    if configuration.selected.contains(&PayloadId::Fdplunar) {
        materialize_lunar_dll()?;
    } else {
        materialize_loader_dll(&app)?;
    }
    let names = installed
        .iter()
        .map(|(id, _)| id.label())
        .collect::<Vec<_>>()
        .join(" + ");
    Ok(format!("{names} ready."))
}

#[tauri::command]
async fn inspect_payloads(
    configuration: PayloadConfiguration,
) -> Result<Vec<payloads::PayloadStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(payloads::inspect(&configuration)))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn identify_jar(path: String) -> Result<PayloadId, String> {
    tauri::async_runtime::spawn_blocking(move || {
        payloads::identify_jar(&PathBuf::from(payloads::expand_user_path(&path)))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let expanded = payloads::expand_user_path(&path);
    let target = PathBuf::from(&expanded);
    let mut command = std::process::Command::new("explorer.exe");
    if target.is_file() {
        command.arg(format!("/select,{}", target.display()));
    } else {
        let folder = target
            .parent()
            .filter(|folder| folder.is_dir())
            .map(PathBuf::from)
            .unwrap_or_else(payloads::root);
        command.arg(folder);
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the folder: {error}"))
}

fn resolve_cmake() -> PathBuf {
    let candidates = [
        r"C:\Program Files\CMake\bin\cmake.exe",
        r"C:\Program Files (x86)\CMake\bin\cmake.exe",
    ];
    for path in candidates {
        let p = PathBuf::from(path);
        if p.is_file() {
            return p;
        }
    }
    PathBuf::from("cmake")
}

fn run_process(program: &str, args: &[&str], cwd: &PathBuf) -> Result<(), String> {
    use std::process::{Command, Stdio};

    let is_batch = program.to_ascii_lowercase().ends_with(".bat")
        || program.to_ascii_lowercase().ends_with(".cmd");

    let mut command = if is_batch {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/C").arg(program).args(args);
        cmd
    } else {
        let mut cmd = Command::new(program);
        cmd.args(args);
        cmd
    };

    command
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Keep PATH usable for GUI-launched ZAVZ (cmake/java).
    let mut path = std::env::var_os("PATH").unwrap_or_default();
    for extra in [
        r"C:\Program Files\CMake\bin",
        r"C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin",
        r"C:\Program Files\Eclipse Adoptium\jdk-8.0.452.9-hotspot\bin",
    ] {
        if PathBuf::from(extra).is_dir() {
            path.push(";");
            path.push(extra);
        }
    }
    command.env("PATH", path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let _ = append_fdp_inject_log(&format!(
        "RUN {} {} (cwd={})\n",
        program,
        args.join(" "),
        cwd.display()
    ));

    let output = command
        .output()
        .map_err(|err| format!("Failed to start `{program}`: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}");
    let tail = if combined.len() > 1200 {
        combined[combined.len() - 1200..].to_string()
    } else {
        combined.clone()
    };
    let _ = append_fdp_inject_log(&format!(
        "EXIT {} code={:?}\n{}\n",
        program,
        output.status.code(),
        tail
    ));

    if !output.status.success() {
        let code = output
            .status
            .code()
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unknown".to_string());
        return Err(format!(
            "`{program} {}` failed (exit {code}). See ~/.zywl/injector/zavz-inject.log",
            args.join(" ")
        ));
    }
    Ok(())
}

fn first_existing(paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().find(|path| path.is_file()).cloned()
}

/// Build latest jar + dll from LiquidBounce-DLL and install into ~/.zywl + project load.
#[tauri::command]
fn build_and_install_fdp_assets(app: AppHandle) -> Result<String, String> {
    let root = std::env::var_os("ZAVZ_FDP_PROJECT")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join("IdeaProjects").join("LiquidBounce-DLL")))
        .unwrap_or_default();
    if !root.is_dir() {
        return Ok(
            "No local FDPClient project on this machine; using the installed files.".to_string(),
        );
    }

    let _ = append_fdp_inject_log("=== build_and_install_fdp_assets start ===\n");

    let cmake = resolve_cmake();
    let cmake_bin = cmake.to_string_lossy().to_string();
    let native_dir = root.join("native");
    let vs_build = native_dir.join("build-vs2022");
    let fallback_build = native_dir.join("build");
    let build_dir = if vs_build.join("CMakeCache.txt").is_file() {
        vs_build.clone()
    } else if fallback_build.join("CMakeCache.txt").is_file() {
        fallback_build.clone()
    } else {
        let target = if vs_build.exists() {
            vs_build.clone()
        } else {
            fallback_build.clone()
        };
        fs::create_dir_all(&target)
            .map_err(|err| format!("Failed to create native build dir: {err}"))?;
        let native_s = native_dir.to_string_lossy().to_string();
        let target_s = target.to_string_lossy().to_string();
        if let Err(err) = run_process(
            &cmake_bin,
            &["-S", &native_s, "-B", &target_s, "-A", "x64"],
            &root,
        ) {
            let _ = append_fdp_inject_log(&format!("WARN cmake configure: {err}\n"));
        }
        target
    };

    let build_dir_s = build_dir.to_string_lossy().to_string();
    let cmake_build_err = run_process(
        &cmake_bin,
        &["--build", &build_dir_s, "--config", "Release"],
        &root,
    )
    .err();
    if let Some(err) = &cmake_build_err {
        let _ = append_fdp_inject_log(&format!("WARN cmake build: {err}\n"));
    }

    let gradle = root.join("gradlew.bat");
    if !gradle.is_file() {
        return Err(format!("gradlew.bat not found in {}", root.display()));
    }
    let gradle_s = gradle.to_string_lossy().to_string();
    let gradle_err = run_process(&gradle_s, &["shadowJar", "releaseJar", "-q"], &root).err();
    if let Some(err) = &gradle_err {
        let _ = append_fdp_inject_log(&format!("WARN gradle: {err}\n"));
    }

    let rebuilt = cmake_build_err.is_none() && gradle_err.is_none();

    let dll_src = first_existing(&[
        build_dir.join("target").join("Release").join("native.dll"),
        root.join("native")
            .join("build-vs2022")
            .join("target")
            .join("Release")
            .join("native.dll"),
        root.join("native")
            .join("build")
            .join("target")
            .join("Release")
            .join("native.dll"),
        root.join("build").join("libs").join("native.dll"),
        injector_home_dir().join("native.dll"),
    ])
    .ok_or_else(|| {
        format!(
            "native.dll not found after build. {}",
            cmake_build_err.as_deref().unwrap_or("no cmake error")
        )
    })?;

    let jar_src = first_existing(&[
        root.join("build").join("libs").join("release.jar"),
        root.join("build")
            .join("libs")
            .join("fdpclient-Build-all.jar"),
        root.join("build").join("libs").join("FDPClient-Build.jar"),
        payloads::jar_path(PayloadId::Fdpclient),
    ])
    .ok_or_else(|| {
        format!(
            "release.jar not found after build. {}",
            gradle_err.as_deref().unwrap_or("no gradle error")
        )
    })?;

    let home = injector_home_dir();
    fs::create_dir_all(&home).map_err(|err| format!("Failed to create .zywl/injector: {err}"))?;
    let dll_dst = home.join("native.dll");
    let jar_dst = payloads::jar_path(PayloadId::Fdpclient);
    fs::create_dir_all(jar_dst.parent().unwrap()).map_err(|e| e.to_string())?;

    if dll_src != dll_dst {
        fs::copy(&dll_src, &dll_dst).map_err(|err| {
            format!(
                "Failed to install native.dll from {}: {err}",
                dll_src.display()
            )
        })?;
    }
    payloads::copy_with_backup(&jar_src, &jar_dst)?;

    let mut staged = Vec::new();
    let load_candidates = [
        std::env::current_dir()
            .ok()
            .map(|cwd| cwd.join("src").join("load")),
        dirs::home_dir().map(|home| {
            home.join("RustroverProjects")
                .join("YZYInjector")
                .join("src")
                .join("load")
        }),
    ];
    for load_dir in load_candidates.into_iter().flatten() {
        if !load_dir.is_dir() {
            continue;
        }
        let load_dll = load_dir.join("native.dll");
        let load_jar = load_dir.join("release.jar");
        let _ = fs::copy(&dll_dst, &load_dll);
        let _ = fs::copy(&jar_dst, &load_jar);
        staged.push(load_dir.display().to_string());
    }

    if let Ok(mut settings) = get_settings(app.clone()) {
        settings.payloads.fdpclient_jar = jar_dst.to_string_lossy().to_string();
        let _ = save_settings(app, settings);
    }

    let dll_size = fs::metadata(&dll_dst).map(|m| m.len()).unwrap_or(0);
    let jar_size = fs::metadata(&jar_dst).map(|m| m.len()).unwrap_or(0);
    let msg = format!(
        "{} FDP assets dll={} ({} bytes) jar={} ({} bytes){}",
        if rebuilt {
            "Built and installed"
        } else {
            "Installed existing"
        },
        dll_dst.display(),
        dll_size,
        jar_dst.display(),
        jar_size,
        if staged.is_empty() {
            String::new()
        } else {
            format!(" | staged {}", staged.join(", "))
        }
    );
    let _ = append_fdp_inject_log(&format!("OK {msg}\n"));
    Ok(msg)
}

#[tauri::command]
fn toggle_dll_console(enable: bool) -> Result<String, String> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(r"\\.\pipe\fdpclient_log")
        .map_err(|e| format!("DLL pipe not available (is the DLL injected?): {}", e))?;
    let cmd = if enable { "ENABLE" } else { "DISABLE" };
    file.write_all(cmd.as_bytes())
        .map_err(|e| format!("Failed to send command: {}", e))?;
    Ok(format!(
        "Console {} successfully",
        if enable { "enabled" } else { "disabled" }
    ))
}

#[tauri::command]
fn pick_dll_file() -> Result<Option<String>, String> {
    let selected = rfd::FileDialog::new()
        .add_filter("Dynamic Libraries", &["dll", "lib"])
        .pick_file();

    Ok(selected.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_jar_file() -> Result<Option<String>, String> {
    let selected = rfd::AsyncFileDialog::new()
        .add_filter("Java Archives", &["jar"])
        .pick_file()
        .await;

    Ok(selected.map(|file| file.path().to_string_lossy().to_string()))
}

fn validate_external_url(url: &str) -> Result<tauri::Url, String> {
    let parsed = tauri::Url::parse(url).map_err(|_| "Invalid external URL.".to_string())?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "External URL has no host.".to_string())?
        .to_ascii_lowercase();
    let allowed_hosts = [
        "lucas-lima.xyz",
        "www.lucas-lima.xyz",
        "fdpinfo.github.io",
        "github.com",
        "www.github.com",
        "discord.gg",
        "discord.com",
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
    ];

    if parsed.scheme() != "https" || !allowed_hosts.contains(&host.as_str()) {
        return Err("External URL is not allowlisted.".to_string());
    }

    Ok(parsed)
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = validate_external_url(&url)?;

    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| format!("Failed to open external URL: {error}"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherState::default())
        .setup(|app| {
            configure_window(app.handle())?;
            if let Err(reason) = payloads::ensure_layout() {
                let _ = append_fdp_inject_log(&format!("WARN {reason}\n"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            list_processes,
            list_minecraft_clients,
            inject_dll,
            start_watcher,
            stop_watcher,
            launch_jvm,
            resolve_loader_dll,
            ensure_payload_assets,
            configure_payloads,
            inspect_payloads,
            identify_jar,
            reveal_in_explorer,
            build_and_install_fdp_assets,
            pick_dll_file,
            pick_jar_file,
            toggle_dll_console,
            open_external,
        ])
        .run(generate_context!())
        .expect("Error running Tauri application");
}

#[cfg(test)]
mod settings_tests {
    use super::*;

    const LEGACY: &str = "{\n  \"jvmArgs\": \"-Xmx4G\",\n  \"injectionMethod\": \"standard\",\n  \"autoClose\": false,\n  \"randomWindowTitle\": false,\n  \"fdpJarPath\": \"C:\\\\old\\\\release.jar\",\n  \"fdpWrapper\": \"auto\"\n}\n";

    fn with_utf8_bom(text: &str) -> Vec<u8> {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(text.as_bytes());
        bytes
    }

    #[test]
    fn a_utf8_bom_does_not_break_the_settings_file() {
        let settings = parse_settings(&with_utf8_bom(LEGACY)).expect("BOM must be tolerated");
        assert_eq!(settings.jvm_args, "-Xmx4G");
        assert_eq!(
            settings.fdp_jar_path.as_deref(),
            Some("C:\\old\\release.jar")
        );
    }

    #[test]
    fn a_utf16_file_written_by_powershell_is_readable() {
        let mut bytes = vec![0xFF, 0xFE];
        bytes.extend(LEGACY.encode_utf16().flat_map(u16::to_le_bytes));
        assert_eq!(parse_settings(&bytes).unwrap().jvm_args, "-Xmx4G");
    }

    #[test]
    fn previous_settings_keep_the_original_jar_location() {
        let settings = parse_settings(&with_utf8_bom(LEGACY)).unwrap().healed();
        assert!(settings.payloads.visuals_jar.is_empty());
        assert_eq!(settings.payloads.fdpclient_jar, r"C:\old\release.jar");
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let settings = parse_settings(b"{}").unwrap().healed();
        assert!(matches!(
            settings.injection_method,
            InjectionMethod::Standard
        ));
        assert!(settings.payloads.fdpclient_jar.is_empty());
    }

    #[test]
    fn the_legacy_field_is_not_written_back() {
        let settings = parse_settings(&with_utf8_bom(LEGACY)).unwrap().healed();
        let text = serde_json::to_string(&settings).unwrap();
        assert!(!text.contains("fdpJarPath"));
    }
}

#[cfg(test)]
mod external_url_tests {
    use super::validate_external_url;

    #[test]
    fn allows_the_configured_https_destinations() {
        assert!(validate_external_url("https://lucas-lima.xyz/").is_ok());
        assert!(validate_external_url("https://github.com/opZywl").is_ok());
        assert!(validate_external_url("https://discord.gg/3XRFGeqEYD").is_ok());
        assert!(validate_external_url("https://www.youtube.com/@opZywl").is_ok());
    }

    #[test]
    fn rejects_untrusted_or_insecure_destinations() {
        assert!(validate_external_url("http://lucas-lima.xyz/").is_err());
        assert!(validate_external_url("https://lucas-lima.xyz.evil.example/").is_err());
        assert!(validate_external_url("file:///C:/Windows/System32/cmd.exe").is_err());
    }
}
