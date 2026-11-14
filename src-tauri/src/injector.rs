use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

#[cfg(target_os = "windows")]
use dll_syringe::{process::OwnedProcess, Syringe};
use sysinfo::System;
#[cfg(target_os = "windows")]
use {std::ptr, winapi::shared::minwindef::FALSE, winapi::um::wow64apiset::IsWow64Process};

use crate::injection_method::InjectionMethod;

/// Validates DLL architecture against target process
#[cfg(target_os = "windows")]
pub fn validate_dll_architecture(dll_path: &Path, process: &OwnedProcess) -> Result<(), String> {
    // Check if DLL is 32-bit or 64-bit
    let dll_is_64bit = is_pe_64bit(dll_path)?;

    // Check if process is 32-bit or 64-bit
    let process_is_64bit = is_process_64bit(process)?;

    if dll_is_64bit != process_is_64bit {
        return Err(format!(
            "Architecture mismatch: the DLL is {}-bit but the process is {}-bit",
            if dll_is_64bit { 64 } else { 32 },
            if process_is_64bit { 64 } else { 32 }
        ));
    }

    Ok(())
}

/// Check if a PE file (DLL/EXE) is 64-bit
#[cfg(target_os = "windows")]
fn is_pe_64bit(path: &Path) -> Result<bool, String> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open DLL: {}", e))?;

    // Read DOS header
    let mut dos_header = [0u8; 64];
    file.read_exact(&mut dos_header)
        .map_err(|e| format!("Failed to read DOS header: {}", e))?;

    // Check MZ signature
    if &dos_header[0..2] != b"MZ" {
        return Err("File is not a valid PE".to_string());
    }

    // Get PE header offset (at position 0x3C)
    let pe_offset = u32::from_le_bytes([
        dos_header[0x3C],
        dos_header[0x3D],
        dos_header[0x3E],
        dos_header[0x3F],
    ]);

    // Seek to PE header
    file.seek(SeekFrom::Start(pe_offset as u64))
        .map_err(|e| format!("Failed to seek PE header: {}", e))?;

    // Read PE signature and machine type
    let mut pe_header = [0u8; 6];
    file.read_exact(&mut pe_header)
        .map_err(|e| format!("Failed to read PE header: {}", e))?;

    // Check PE signature
    if &pe_header[0..4] != b"PE\0\0" {
        return Err("Invalid PE signature".to_string());
    }

    // Machine type at offset 4-5
    let machine = u16::from_le_bytes([pe_header[4], pe_header[5]]);

    // 0x8664 = AMD64, 0x014c = I386
    Ok(machine == 0x8664)
}

/// Check if a process is 64-bit
#[cfg(target_os = "windows")]
fn is_process_64bit(process: &OwnedProcess) -> Result<bool, String> {
    use std::os::windows::io::{AsHandle, AsRawHandle};

    let handle = process.as_handle().as_raw_handle() as *mut _;
    let mut is_wow64 = FALSE;

    unsafe {
        if IsWow64Process(handle, &mut is_wow64) == 0 {
            return Err("Failed to check process architecture".to_string());
        }
    }

    // If running on 64-bit Windows:
    // - 64-bit process: IsWow64 = FALSE
    // - 32-bit process: IsWow64 = TRUE
    #[cfg(target_pointer_width = "64")]
    return Ok(is_wow64 == FALSE);

    // If running on 32-bit Windows, all processes are 32-bit
    #[cfg(target_pointer_width = "32")]
    return Ok(false);
}

/// Sets file access control for UWP compatibility
/// Based on UWPDumper by Wunkolo
#[cfg(target_os = "windows")]
pub fn set_access_control(file_path: &Path, sid_string: &str) -> Result<(), String> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

    use windows_sys::Win32::{
        Foundation::{LocalFree, ERROR_SUCCESS, GENERIC_EXECUTE, GENERIC_READ},
        Security::{
            Authorization::{
                ConvertStringSidToSidW, GetNamedSecurityInfoW, SetEntriesInAclW,
                SetNamedSecurityInfoW, EXPLICIT_ACCESS_W, SET_ACCESS, TRUSTEE_IS_SID,
                TRUSTEE_IS_WELL_KNOWN_GROUP, TRUSTEE_W,
            },
            ACL, DACL_SECURITY_INFORMATION, PSID,
        },
    };

    // Windows SDK constants
    const SE_FILE_OBJECT: i32 = 1;
    const SUB_CONTAINERS_AND_OBJECTS_INHERIT: u32 = 0x03;

    let wide_path: Vec<u16> = OsStr::new(file_path.to_str().unwrap())
        .encode_wide()
        .chain(Some(0))
        .collect();

    let wide_sid: Vec<u16> = OsStr::new(sid_string)
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        let mut sd: *mut std::ffi::c_void = ptr::null_mut();
        let mut current_acl: *mut ACL = ptr::null_mut();

        // Get current security info
        let result = GetNamedSecurityInfoW(
            wide_path.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            ptr::null_mut(),
            ptr::null_mut(),
            &mut current_acl,
            ptr::null_mut(),
            &mut sd,
        );

        if result != ERROR_SUCCESS {
            return Err(format!("GetNamedSecurityInfoW failed: {}", result));
        }

        let mut sid: PSID = ptr::null_mut();
        if ConvertStringSidToSidW(wide_sid.as_ptr(), &mut sid) == 0 {
            if !sd.is_null() {
                LocalFree(sd);
            }
            return Err("ConvertStringSidToSidW failed".to_string());
        }

        if sid.is_null() {
            if !sd.is_null() {
                LocalFree(sd);
            }
            return Err("SID conversion returned null".to_string());
        }

        let ea = EXPLICIT_ACCESS_W {
            grfAccessPermissions: GENERIC_READ | GENERIC_EXECUTE,
            grfAccessMode: SET_ACCESS,
            grfInheritance: SUB_CONTAINERS_AND_OBJECTS_INHERIT,
            Trustee: TRUSTEE_W {
                pMultipleTrustee: ptr::null_mut(),
                MultipleTrusteeOperation: 0,
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_WELL_KNOWN_GROUP,
                ptstrName: sid as *mut u16,
            },
        };

        let mut new_acl: *mut ACL = ptr::null_mut();
        let result = SetEntriesInAclW(1, &ea, current_acl, &mut new_acl);

        if result == ERROR_SUCCESS {
            let _ = SetNamedSecurityInfoW(
                wide_path.as_ptr() as *mut u16,
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                new_acl as *const ACL,
                ptr::null_mut(),
            );

            if !new_acl.is_null() {
                LocalFree(new_acl as *mut std::ffi::c_void);
            }
        }

        if !sd.is_null() {
            LocalFree(sd);
        }
        LocalFree(sid);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set_access_control(_file_path: &Path, _sid_string: &str) -> Result<(), String> {
    // No-op on non-Windows platforms
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn validate_dll_architecture(_dll_path: &Path, _process: u32) -> Result<(), String> {
    // No-op on non-Windows platforms
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientPrefer {
    Auto,
    Badlion,
    Lunar,
    CheatBreaker,
    CmClient,
    Vanilla,
    Forge,
}

#[derive(Debug, Clone)]
pub struct ResolvedTarget {
    pub pid: u32,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone)]
pub struct GameClientInfo {
    pub pid: u32,
    pub name: String,
    pub kind: String,
    pub title: String,
}

/// Find process by name (first match). Prefer resolve_injection_target for games.
#[cfg(target_os = "windows")]
pub fn find_process_by_name(target: &str) -> Result<OwnedProcess, String> {
    let mut system = System::new_all();
    system.refresh_processes();

    let target_lower = target.to_ascii_lowercase();
    let target_no_ext = target_lower.strip_suffix(".exe").unwrap_or(&target_lower);

    let process = system
        .processes()
        .values()
        .find(|proc| {
            let name = proc.name().to_ascii_lowercase();
            let name_no_ext = name.strip_suffix(".exe").unwrap_or(&name);
            name == target_lower || name_no_ext == target_no_ext
        })
        .ok_or_else(|| format!("Process '{}' not found", target))?;

    OwnedProcess::from_pid(process.pid().as_u32())
        .map_err(|err| format!("Failed to open process: {}", err))
}

#[cfg(not(target_os = "windows"))]
pub fn find_process_by_name(target: &str) -> Result<u32, String> {
    Err(format!("Process injection not supported on this platform"))
}

#[cfg(target_os = "windows")]
fn is_jvm_process_name(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    let n = n.strip_suffix(".exe").unwrap_or(&n);
    n == "java" || n == "javaw"
}

fn is_forbidden_inject_target(name: &str, exe: &str) -> bool {
    let blob = format!("{} {}", name, exe).to_ascii_lowercase();
    blob.contains("chrome")
        || blob.contains("msedge")
        || blob.contains("edge.exe")
        || blob.contains("firefox")
        || blob.contains("opera")
        || blob.contains("brave")
        || blob.contains("browser")
        || blob.contains("electron")
        || blob.contains("discord")
        || blob.contains("spotify")
        || blob.contains("code.exe")
        || blob.contains("cursor.exe")
}

fn is_noise_java_path(s: &str) -> bool {
    let s = s.to_ascii_lowercase();
    s.contains("\\cursor\\")
        || s.contains("/cursor/")
        || s.contains("redhat.java")
        || s.contains("jetbrains")
        || s.contains("intellij")
        || s.contains("android studio")
        || s.contains("\\vscode\\")
        || s.contains("gradle")
        || s.contains("maven")
        || s.contains("eclipse")
        || s.contains("language server")
        || s.contains("jdt.ls")
        || s.contains("chrome")
        || s.contains("msedge")
        || s.contains("console debugger")
        || s.contains("lucas-lima")
        || s.contains("opzywl")
        || s.contains("idea64")
        || s.contains("webstorm")
        || s.contains("grok")
}

#[cfg(target_os = "windows")]
fn collect_window_titles() -> std::collections::HashMap<u32, String> {
    use std::collections::HashMap;

    use winapi::{
        shared::{
            minwindef::{BOOL, FALSE, LPARAM, TRUE},
            windef::HWND,
        },
        um::winuser::{EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible},
    };

    struct State {
        map: HashMap<u32, String>,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut State);
        if IsWindowVisible(hwnd) == FALSE {
            return TRUE;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return TRUE;
        }
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len <= 0 {
            return TRUE;
        }
        let title = String::from_utf16_lossy(&buf[..len as usize]);
        if title.trim().is_empty() {
            return TRUE;
        }
        state
            .map
            .entry(pid)
            .and_modify(|existing| {
                if title.len() > existing.len() {
                    *existing = title.clone();
                }
            })
            .or_insert(title);
        TRUE
    }

    let mut state = State {
        map: HashMap::new(),
    };
    unsafe {
        EnumWindows(Some(enum_proc), &mut state as *mut State as LPARAM);
    }
    state.map
}

#[cfg(target_os = "windows")]
fn process_fingerprint(proc: &sysinfo::Process) -> (String, String, String) {
    let name = proc.name().to_string();
    let exe = proc
        .exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let cmd = proc.cmd().join(" ");
    (name, exe, cmd)
}

#[cfg(target_os = "windows")]
fn classify_client(exe: &str, cmd: &str, title: &str) -> Option<&'static str> {
    let blob = format!("{} {} {}", exe, cmd, title).to_ascii_lowercase();
    let title_l = title.to_ascii_lowercase();
    if is_noise_java_path(&blob) {
        return None;
    }
    // Debugger / IDE never
    if title_l.contains("console debugger")
        || title_l.contains("lucas-lima")
        || title_l.contains("opzywl")
    {
        return None;
    }
    // Order matters: specific packs before generic Minecraft
    if blob.contains("cmclient")
        || blob.contains("cm launcher")
        || blob.contains("cmlauncher")
        || blob.contains("cmpack")
        || title_l.contains("cmclient")
    {
        return Some("cmclient");
    }
    if blob.contains("cheatbreaker")
        || blob.contains("cheat breaker")
        || title_l.contains("cheatbreaker")
        || title_l.contains("cheat breaker")
    {
        return Some("cheatbreaker");
    }
    if blob.contains("badlion") {
        return Some("badlion");
    }
    // Lunar Home (Electron) is not the game JVM
    if blob.contains("lunarclient")
        || blob.contains("lunar client")
        || blob.contains(".lunarclient")
        || blob.contains("\\lunar\\")
        || blob.contains("/lunar/")
        || (blob.contains("lunar")
            && (blob.contains("minecraft") || blob.contains("ichor") || blob.contains("optifine")))
    {
        return Some("lunar");
    }
    if blob.contains("net.minecraftforge")
        || blob.contains("minecraftforge")
        || (blob.contains("forge") && blob.contains("1.8.9"))
        || (blob.contains("--tweakclass") && blob.contains("fml"))
    {
        return Some("forge");
    }
    // Vanilla / generic Minecraft window (not launcher home)
    if title_l.contains("minecraft") && !title_l.contains("launcher") && !title_l.contains("home") {
        return Some("vanilla");
    }
    if blob.contains("versions\\1.8.9")
        || blob.contains("versions/1.8.9")
        || blob.contains("net.minecraft.client.main.main")
    {
        return Some("vanilla");
    }
    None
}

/// Resolve game JVM for FDP injection.
/// Target: PID | name | badlion | lunar | cmclient | cheatbreaker | vanilla | forge | auto.
/// Preferred client falls back to any game JVM if missing (FDP Mode 100%).
#[cfg(target_os = "windows")]
pub fn resolve_injection_target(target: &str) -> Result<(OwnedProcess, ResolvedTarget), String> {
    let t = target.trim();
    if t.is_empty() {
        return Err("Process name cannot be empty.".to_string());
    }
    if t.eq_ignore_ascii_case("lunar-startup") {
        return resolve_next_lunar_startup(&HashSet::new())
            .map(|(process, target, _)| (process, target));
    }

    if let Ok(pid) = t.parse::<u32>() {
        let process = OwnedProcess::from_pid(pid)
            .map_err(|err| format!("Failed to open process PID {}: {}", pid, err))?;
        return Ok((
            process,
            ResolvedTarget {
                pid,
                name: format!("pid:{}", pid),
                kind: "pid".to_string(),
            },
        ));
    }

    let lower = t.to_ascii_lowercase();
    let prefer = match lower.as_str() {
        "badlion" | "blc" | "badlionclient" | "badlion.exe" => Some(ClientPrefer::Badlion),
        "lunar" | "lunarclient" | "lunar_client" | "lunar.exe" => Some(ClientPrefer::Lunar),
        "cmclient" | "cm" | "cmpack" | "cmlauncher" | "cm client" => Some(ClientPrefer::CmClient),
        "cheatbreaker" | "cb" | "cheat_breaker" | "cheat-breaker" => {
            Some(ClientPrefer::CheatBreaker)
        }
        "vanilla" | "official" | "mojang" => Some(ClientPrefer::Vanilla),
        "forge" | "minecraftforge" => Some(ClientPrefer::Forge),
        "auto" | "fdp" | "minecraft" | "mc" | "javaw" | "javaw.exe" | "java" | "java.exe" => {
            Some(ClientPrefer::Auto)
        }
        _ => None,
    };

    if let Some(pref) = prefer {
        match find_game_process(pref) {
            Ok(v) => return Ok(v),
            Err(strict_err) => {
                // Soft prefer — inject whatever game JVM is open
                if pref != ClientPrefer::Auto {
                    if let Ok(v) = find_game_process(ClientPrefer::Auto) {
                        return Ok(v);
                    }
                }
                return Err(strict_err);
            }
        }
    }

    match find_process_by_name(t) {
        Ok(process) => {
            use dll_syringe::process::Process;
            let pid = process.pid().map(|p| p.get()).unwrap_or(0);
            Ok((
                process,
                ResolvedTarget {
                    pid,
                    name: t.to_string(),
                    kind: "name".to_string(),
                },
            ))
        }
        Err(err) => find_game_process(ClientPrefer::Auto).map_err(|_| {
            format!(
                "{}: no game process found. Open Minecraft and try again.",
                err
            )
        }),
    }
}

#[cfg(target_os = "windows")]
struct GameCand {
    pid: u32,
    started_at: u64,
    name: String,
    kind: String,
    title: String,
    score: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct GameProcessIdentity {
    pub pid: u32,
    pub started_at: u64,
}

#[cfg(target_os = "windows")]
impl GameCand {
    fn identity(&self) -> GameProcessIdentity {
        GameProcessIdentity {
            pid: self.pid,
            started_at: self.started_at,
        }
    }
}

#[cfg(target_os = "windows")]
fn next_lunar_candidate<'a>(
    candidates: &'a [GameCand],
    excluded: &HashSet<GameProcessIdentity>,
) -> Option<&'a GameCand> {
    candidates.iter().find(|candidate| {
        candidate.kind == "lunar"
            && candidate.title.is_empty()
            && !excluded.contains(&candidate.identity())
    })
}

#[cfg(target_os = "windows")]
pub fn existing_lunar_processes() -> HashSet<GameProcessIdentity> {
    collect_game_candidates(ClientPrefer::Lunar)
        .iter()
        .filter(|candidate| candidate.kind == "lunar")
        .map(GameCand::identity)
        .collect()
}

#[cfg(target_os = "windows")]
pub fn resolve_next_lunar_startup(
    excluded: &HashSet<GameProcessIdentity>,
) -> Result<(OwnedProcess, ResolvedTarget, GameProcessIdentity), String> {
    let candidates = collect_game_candidates(ClientPrefer::Lunar);
    let candidate = next_lunar_candidate(&candidates, excluded).ok_or(
        "Waiting for the next Lunar startup. Launch Lunar Client 1.8.9 from its official launcher.",
    )?;
    let process = OwnedProcess::from_pid(candidate.pid).map_err(|error| error.to_string())?;
    Ok((
        process,
        ResolvedTarget {
            pid: candidate.pid,
            name: candidate.name.clone(),
            kind: "lunar".into(),
        },
        candidate.identity(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn existing_lunar_processes() -> HashSet<GameProcessIdentity> {
    HashSet::new()
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_next_lunar_startup(
    _excluded: &HashSet<GameProcessIdentity>,
) -> Result<(u32, ResolvedTarget, GameProcessIdentity), String> {
    Err("Lunar startup loading requires Windows.".into())
}

#[cfg(target_os = "windows")]
fn collect_game_candidates(prefer: ClientPrefer) -> Vec<GameCand> {
    let mut system = System::new_all();
    system.refresh_processes();
    let titles = collect_window_titles();
    let mut cands: Vec<GameCand> = Vec::new();

    for (pid, title) in &titles {
        let title_l = title.to_ascii_lowercase();
        if title_l.contains("console debugger")
            || title_l.contains("lucas-lima")
            || title_l.contains("opzywl")
        {
            continue;
        }
        let name = system
            .process(sysinfo::Pid::from_u32(*pid))
            .map(|p| p.name().to_string())
            .unwrap_or_default();
        let started_at = system
            .process(sysinfo::Pid::from_u32(*pid))
            .map_or(0, sysinfo::Process::start_time);
        if !is_jvm_process_name(&name) {
            continue;
        }
        if title_l.contains("cmclient") {
            cands.push(GameCand {
                pid: *pid,
                started_at,
                name,
                kind: "cmclient".to_string(),
                title: title.clone(),
                score: 520,
            });
        } else if title_l.contains("cheatbreaker") || title_l.contains("cheat breaker") {
            cands.push(GameCand {
                pid: *pid,
                started_at,
                name,
                kind: "cheatbreaker".to_string(),
                title: title.clone(),
                score: 510,
            });
        } else if title_l.contains("badlion") {
            cands.push(GameCand {
                pid: *pid,
                started_at,
                name,
                kind: "badlion".to_string(),
                title: title.clone(),
                score: 500,
            });
        } else if title_l.contains("minecraft")
            && !title_l.contains("home")
            && !title_l.contains("launcher")
        {
            let kind = if title_l.contains("lunar") {
                "lunar"
            } else if title_l.contains("forge") {
                "forge"
            } else {
                "vanilla"
            };
            cands.push(GameCand {
                pid: *pid,
                started_at,
                name,
                kind: kind.to_string(),
                title: title.clone(),
                score: 400,
            });
        }
    }

    for proc in system.processes().values() {
        let pid = proc.pid().as_u32();
        let (name, exe, cmd) = process_fingerprint(proc);
        let name_l = name.to_ascii_lowercase();
        let is_java = is_jvm_process_name(&name_l);

        if is_forbidden_inject_target(&name_l, &exe) {
            continue;
        }

        let title = titles.get(&pid).cloned().unwrap_or_default();
        let title_l = title.to_ascii_lowercase();

        if !is_java {
            continue;
        }

        let blob = format!("{} {} {}", exe, cmd, title).to_ascii_lowercase();
        if is_java && is_noise_java_path(&blob) {
            continue;
        }

        let kind = if title_l.contains("cmclient")
            || blob.contains("cmlauncher")
            || blob.contains("cmpack")
        {
            "cmclient".to_string()
        } else if title_l.contains("cheatbreaker") || blob.contains("cheatbreaker") {
            "cheatbreaker".to_string()
        } else if title_l.contains("badlion")
            || blob.contains("badlion")
            || blob.contains("\\badlion")
            || blob.contains("/badlion")
        {
            "badlion".to_string()
        } else {
            match classify_client(&exe, &cmd, &title) {
                Some(k) => k.to_string(),
                None if is_java
                    && !title.is_empty()
                    && (title_l.contains("minecraft") || title_l.contains("lunar")) =>
                {
                    if title_l.contains("lunar") && !title_l.contains("home") {
                        "lunar".to_string()
                    } else {
                        "vanilla".to_string()
                    }
                }
                None => continue,
            }
        };

        if kind == "lunar" && title_l.contains("home - lunar") {
            continue;
        }

        let mut score = 10;
        match kind.as_str() {
            "cmclient" => score += 110,
            "cheatbreaker" => score += 105,
            "badlion" => score += 100,
            "lunar" => score += 90,
            "forge" => score += 70,
            "vanilla" | "minecraft" => score += 50,
            _ => {}
        }
        if !title.is_empty() {
            score += 25;
        }
        if title_l.contains("1.8")
            || title_l.contains("minecraft")
            || title_l.contains("badlion")
            || title_l.contains("cmclient")
            || title_l.contains("cheatbreaker")
        {
            score += 20;
        }
        if kind == "badlion"
            && (name_l == "java" || name_l == "java.exe" || name_l.starts_with("java"))
        {
            score += 40;
        }
        if kind == "lunar" && (name_l.starts_with("javaw") || name_l.starts_with("java")) {
            score += 20;
        }
        if kind == "cmclient" && (name_l.starts_with("javaw") || name_l.starts_with("java")) {
            score += 30;
        }
        let mem_mb = (proc.memory() / (1024 * 1024)) as i32;
        score += (mem_mb / 128).min(40);

        match prefer {
            ClientPrefer::Badlion if kind != "badlion" => continue,
            ClientPrefer::Lunar if kind != "lunar" => continue,
            ClientPrefer::CmClient if kind != "cmclient" => continue,
            ClientPrefer::CheatBreaker if kind != "cheatbreaker" => continue,
            ClientPrefer::Vanilla if kind != "vanilla" && kind != "minecraft" => continue,
            ClientPrefer::Forge if kind != "forge" => continue,
            _ => {}
        }

        cands.push(GameCand {
            pid,
            started_at: proc.start_time(),
            name,
            kind,
            title,
            score,
        });
    }

    cands.sort_by(|a, b| b.score.cmp(&a.score));
    cands
}

/// List every detected Minecraft game JVM (Lunar, CheatBreaker, Badlion, etc.).
#[cfg(target_os = "windows")]
pub fn list_game_clients() -> Result<Vec<GameClientInfo>, String> {
    let cands = collect_game_candidates(ClientPrefer::Auto);
    let mut seen = std::collections::HashSet::new();
    let mut out: Vec<GameClientInfo> = Vec::new();
    for cand in cands {
        if !seen.insert(cand.pid) {
            continue;
        }
        out.push(GameClientInfo {
            pid: cand.pid,
            name: cand.name,
            kind: cand.kind,
            title: cand.title,
        });
    }
    Ok(out)
}

#[cfg(not(target_os = "windows"))]
pub fn list_game_clients() -> Result<Vec<GameClientInfo>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
fn find_game_process(prefer: ClientPrefer) -> Result<(OwnedProcess, ResolvedTarget), String> {
    let cands = collect_game_candidates(prefer);

    let best = cands.first().ok_or_else(|| match prefer {
        ClientPrefer::Badlion => {
            "Badlion was not found. Open Badlion 1.8.9 and try again.".to_string()
        }
        ClientPrefer::Lunar => {
            "Lunar was not found. Start the game in Lunar, not just its home screen.".to_string()
        }
        ClientPrefer::CmClient => {
            "CMCLIENT was not found. Open CMCLIENT 1.8.9 and try again.".to_string()
        }
        ClientPrefer::CheatBreaker => {
            "CheatBreaker was not found. Open CheatBreaker 1.8.9 and try again.".to_string()
        }
        ClientPrefer::Vanilla => {
            "Vanilla Minecraft was not found. Open the 1.8.9 game and try again.".to_string()
        }
        ClientPrefer::Forge => {
            "Forge was not found. Open Minecraft Forge 1.8.9 and try again.".to_string()
        }
        ClientPrefer::Auto => {
            "No Minecraft client was found. Open the game and try again.".to_string()
        }
    })?;

    let process = OwnedProcess::from_pid(best.pid)
        .map_err(|err| format!("Failed to open process PID {}: {}", best.pid, err))?;

    Ok((
        process,
        ResolvedTarget {
            pid: best.pid,
            name: best.name.clone(),
            kind: best.kind.clone(),
        },
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_injection_target(_target: &str) -> Result<(u32, ResolvedTarget), String> {
    Err("Process injection not supported on this platform".to_string())
}

/// Classic CreateRemoteThread + LoadLibraryA (same path as inject-badlion.ps1).
#[cfg(target_os = "windows")]
fn classic_load_library_inject(pid: u32, dll_path: &Path) -> Result<(), String> {
    use std::ffi::CString;

    use windows_sys::Win32::{
        Foundation::{CloseHandle, FALSE, WAIT_OBJECT_0},
        System::{
            Diagnostics::Debug::WriteProcessMemory,
            LibraryLoader::{GetModuleHandleA, GetProcAddress},
            Memory::{
                VirtualAllocEx, VirtualFreeEx, MEM_COMMIT, MEM_RELEASE, MEM_RESERVE, PAGE_READWRITE,
            },
            Threading::{CreateRemoteThread, OpenProcess, WaitForSingleObject, PROCESS_ALL_ACCESS},
        },
    };

    let path_str = dll_path
        .canonicalize()
        .unwrap_or_else(|_| dll_path.to_path_buf())
        .to_string_lossy()
        .to_string();
    // Windows LoadLibraryA needs normal path, not \\?\
    let path_str = path_str
        .strip_prefix(r"\\?\")
        .unwrap_or(&path_str)
        .to_string();
    let c_path = CString::new(path_str.clone())
        .map_err(|e| format!("Invalid DLL path for LoadLibraryA: {e}"))?;
    let bytes = c_path.as_bytes_with_nul();

    unsafe {
        let hp = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
        if hp.is_null() {
            return Err(format!(
                "OpenProcess failed pid={pid} err={}",
                std::io::Error::last_os_error()
            ));
        }

        let remote = VirtualAllocEx(
            hp,
            std::ptr::null(),
            bytes.len(),
            MEM_COMMIT | MEM_RESERVE,
            PAGE_READWRITE,
        );
        if remote.is_null() {
            CloseHandle(hp);
            return Err(format!(
                "VirtualAllocEx failed: {}",
                std::io::Error::last_os_error()
            ));
        }

        let mut written = 0usize;
        let ok = WriteProcessMemory(
            hp,
            remote,
            bytes.as_ptr() as *const _,
            bytes.len(),
            &mut written,
        );
        if ok == 0 {
            VirtualFreeEx(hp, remote, 0, MEM_RELEASE);
            CloseHandle(hp);
            return Err(format!(
                "WriteProcessMemory failed: {}",
                std::io::Error::last_os_error()
            ));
        }

        let k32 = GetModuleHandleA(c"kernel32.dll".as_ptr().cast());
        if k32.is_null() {
            VirtualFreeEx(hp, remote, 0, MEM_RELEASE);
            CloseHandle(hp);
            return Err("GetModuleHandleA(kernel32) failed".to_string());
        }
        let load_lib = GetProcAddress(k32, c"LoadLibraryA".as_ptr().cast());
        if load_lib.is_none() {
            VirtualFreeEx(hp, remote, 0, MEM_RELEASE);
            CloseHandle(hp);
            return Err("GetProcAddress(LoadLibraryA) failed".to_string());
        }
        let load_lib = load_lib.unwrap();

        let thread = CreateRemoteThread(
            hp,
            std::ptr::null(),
            0,
            Some(std::mem::transmute::<
                unsafe extern "system" fn() -> isize,
                unsafe extern "system" fn(*mut std::ffi::c_void) -> u32,
            >(load_lib)),
            remote,
            0,
            std::ptr::null_mut(),
        );
        if thread.is_null() {
            VirtualFreeEx(hp, remote, 0, MEM_RELEASE);
            CloseHandle(hp);
            return Err(format!(
                "CreateRemoteThread failed: {}",
                std::io::Error::last_os_error()
            ));
        }

        let wait = WaitForSingleObject(thread, 30_000);
        CloseHandle(thread);
        VirtualFreeEx(hp, remote, 0, MEM_RELEASE);
        CloseHandle(hp);

        if wait != WAIT_OBJECT_0 {
            return Err(format!(
                "WaitForSingleObject failed/timeout ({wait}) for LoadLibraryA path={path_str}"
            ));
        }
    }

    Ok(())
}

/// Perform DLL injection
#[cfg(target_os = "windows")]
pub fn inject_dll(
    process: OwnedProcess,
    dll_path: &PathBuf,
    method: InjectionMethod,
) -> Result<(), String> {
    use dll_syringe::process::Process;

    // Validate architecture
    #[cfg(target_os = "windows")]
    validate_dll_architecture(dll_path, &process)?;

    // Set access control for UWP compatibility
    #[cfg(target_os = "windows")]
    {
        let _ = set_access_control(dll_path, "S-1-15-2-1");
    }

    let pid = process.pid().map(|p| p.get()).unwrap_or(0);

    match method {
        InjectionMethod::ManualMap => crate::manual_map::manual_map_inject(&process, dll_path),
        InjectionMethod::ThreadHijack => {
            crate::thread_hijack::thread_hijack_inject(&process, dll_path)
        }
        InjectionMethod::Reflective => crate::reflective::reflective_inject(&process, dll_path),
        InjectionMethod::Standard => {
            // Prefer classic LoadLibraryA (proved OK on Badlion via inject-badlion.ps1),
            // then fall back to dll-syringe.
            match classic_load_library_inject(pid, dll_path) {
                Ok(()) => Ok(()),
                Err(classic_err) => {
                    let syringe = Syringe::for_process(process);
                    syringe.inject(dll_path).map(|_| ()).map_err(|err| {
                        format!("Inject failed pid={pid}. classic=[{classic_err}] syringe=[{err}]")
                    })
                }
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn inject_dll(
    _process: u32,
    _dll_path: &PathBuf,
    _method: InjectionMethod,
) -> Result<(), String> {
    Err("DLL injection not supported on this platform".to_string())
}

#[cfg(all(test, target_os = "windows"))]
mod startup_tests {
    use super::*;

    fn lunar(pid: u32, started_at: u64, title: &str) -> GameCand {
        GameCand {
            pid,
            started_at,
            name: "javaw.exe".into(),
            kind: "lunar".into(),
            title: title.into(),
            score: 0,
        }
    }

    #[test]
    fn an_existing_lunar_jvm_is_skipped_even_without_a_window() {
        let old = lunar(36648, 100, "");
        let excluded = HashSet::from([old.identity()]);
        let candidates = [old, lunar(40000, 200, "")];
        assert_eq!(
            next_lunar_candidate(&candidates, &excluded).unwrap().pid,
            40000
        );
    }

    #[test]
    fn an_attempted_instance_is_never_injected_twice_but_a_reused_pid_can_start() {
        let attempted = lunar(36648, 100, "");
        let excluded = HashSet::from([attempted.identity()]);
        assert!(next_lunar_candidate(&[attempted], &excluded).is_none());
        let restarted = [lunar(36648, 200, "")];
        assert_eq!(
            next_lunar_candidate(&restarted, &excluded)
                .unwrap()
                .started_at,
            200
        );
    }

    #[test]
    fn initialized_games_and_other_clients_are_not_startup_targets() {
        let mut forge = lunar(30000, 200, "");
        forge.kind = "forge".into();
        let candidates = [lunar(36648, 200, "Lunar Client 1.8.9"), forge];
        assert!(next_lunar_candidate(&candidates, &HashSet::new()).is_none());
    }
}
