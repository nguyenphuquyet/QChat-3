use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const MAX_TEXT_BYTES: u64 = 8 * 1024 * 1024;
const MAX_TREE_ENTRIES: usize = 8_000;
const MAX_TREE_DEPTH: usize = 24;

const IGNORED_DIRECTORIES: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".next",
    ".turbo",
    ".dart_tool",
    "target",
    "__pycache__",
    ".idea",
    ".gradle",
    "Pods",
];

const IGNORED_FILES: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini"];

#[derive(Default)]
struct DevState {
    child: Mutex<Option<Child>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CliInfo {
    ready: bool,
    node_path: Option<String>,
    node_version: Option<String>,
    cli_path: Option<String>,
    cli_version: Option<String>,
    workspace: Option<String>,
    platform: String,
    arch: String,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CliOutput {
    code: i32,
    stdout: String,
    stderr: String,
    duration_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    relative: String,
    is_dir: bool,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Artifact {
    path: String,
    name: String,
    size: u64,
    modified_ms: Option<u64>,
}

/// Cheap "has this file changed on disk?" probe used by the studio to pick up
/// edits made outside the app (another editor, a CLI run, git checkout...).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileStamp {
    path: String,
    exists: bool,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevLog {
    stream: String,
    line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevExit {
    code: i32,
}

fn command_for(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn node_binary_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn probe_node(program: &Path) -> Option<String> {
    let output = command_for(&program.to_string_lossy()).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        None
    } else {
        Some(version)
    }
}

fn find_node(explicit: &str, app: &AppHandle) -> Option<PathBuf> {
    let trimmed = explicit.trim();
    if !trimmed.is_empty() {
        let candidate = PathBuf::from(trimmed);
        if candidate.is_file() && probe_node(&candidate).is_some() {
            return Some(candidate);
        }
    }

    if let Ok(value) = std::env::var("QCHAT_NODE") {
        let candidate = PathBuf::from(value);
        if candidate.is_file() && probe_node(&candidate).is_some() {
            return Some(candidate);
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("node").join(node_binary_name()),
            resource_dir.join("node").join("bin").join("node"),
            resource_dir
                .join("resources")
                .join("node")
                .join(node_binary_name()),
            resource_dir
                .join("resources")
                .join("node")
                .join("bin")
                .join("node"),
            resource_dir.join(node_binary_name()),
            resource_dir.join("resources").join(node_binary_name()),
        ];
        for candidate in candidates {
            if candidate.is_file() && probe_node(&candidate).is_some() {
                return Some(candidate);
            }
        }
    }

    // Ancestor folders can hold a portable Node next to the workspace.
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.extend(parent.ancestors().map(Path::to_path_buf));
        }
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    roots.extend(Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().map(Path::to_path_buf));

    for root in roots {
        for relative in [
            PathBuf::from("node").join(node_binary_name()),
            PathBuf::from("resources").join("node").join(node_binary_name()),
            PathBuf::from("apps")
                .join("miniapp-ide")
                .join("resources")
                .join("node")
                .join(node_binary_name()),
        ] {
            let candidate = root.join(relative);
            if candidate.is_file() && probe_node(&candidate).is_some() {
                return Some(candidate);
            }
        }
    }

    if probe_node(Path::new("node")).is_some() {
        return Some(PathBuf::from("node"));
    }

    None
}

fn find_cli(explicit: &str, app: &AppHandle) -> Option<PathBuf> {
    let trimmed = explicit.trim();
    if !trimmed.is_empty() {
        let candidate = PathBuf::from(trimmed);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Ok(value) = std::env::var("QCHAT_CLI") {
        let candidate = PathBuf::from(value);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    let mut roots: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.join("qapp"));
        roots.push(resource_dir.join("resources").join("qapp"));
        roots.push(resource_dir);
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.extend(parent.ancestors().map(Path::to_path_buf));
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        roots.extend(cwd.ancestors().map(Path::to_path_buf));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    roots.push(manifest_dir.clone());
    roots.extend(manifest_dir.ancestors().map(Path::to_path_buf));

    for root in roots {
        for relative in [
            "cli.js",
            "qapp/cli.js",
            "packages/miniapp-framework/dist/cli.js",
            "apps/miniapp-ide/resources/qapp/cli.js",
            "resources/qapp/cli.js",
        ] {
            let candidate = root.join(relative);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn find_workspace(cli: &Path) -> Option<PathBuf> {
    for ancestor in cli.ancestors() {
        if ancestor
            .join("packages")
            .join("miniapp-framework")
            .join("package.json")
            .is_file()
        {
            return Some(ancestor.to_path_buf());
        }
    }
    for ancestor in cli.ancestors() {
        if ancestor.join("package.json").is_file() && ancestor.join("apps").is_dir() {
            return Some(ancestor.to_path_buf());
        }
    }
    None
}

fn cli_version(node: &Path, cli: &Path) -> Result<String, String> {
    let output = command_for(&node.to_string_lossy())
        .arg(cli)
        .arg("version")
        .output()
        .map_err(|error| format!("Could not start the QChat CLI: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(if stdout.is_empty() { "unknown".into() } else { stdout })
    } else {
        Err(if stderr.is_empty() {
            format!("`qapp version` exited with code {}", output.status.code().unwrap_or(-1))
        } else {
            stderr
        })
    }
}

fn detect_blocking(app: &AppHandle, node: &str, cli: &str) -> CliInfo {
    let platform = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let node_path = find_node(node, app);
    let Some(node_path) = node_path else {
        return CliInfo {
            ready: false,
            node_path: None,
            node_version: None,
            cli_path: None,
            cli_version: None,
            workspace: None,
            platform,
            arch,
            error: Some(
                "Node.js was not found. Install Node 20 or newer, or set its path in Studio settings."
                    .into(),
            ),
        };
    };

    let node_version = probe_node(&node_path);

    let cli_path = find_cli(cli, app);
    let Some(cli_path) = cli_path else {
        return CliInfo {
            ready: false,
            node_path: Some(node_path.to_string_lossy().to_string()),
            node_version,
            cli_path: None,
            cli_version: None,
            workspace: None,
            platform,
            arch,
            error: Some(
                "The QChat CLI was not found. Build packages/miniapp-framework, or set the CLI path in Studio settings."
                    .into(),
            ),
        };
    };

    let workspace = find_workspace(&cli_path).map(|path| path.to_string_lossy().to_string());

    match cli_version(&node_path, &cli_path) {
        Ok(version) => CliInfo {
            ready: true,
            node_path: Some(node_path.to_string_lossy().to_string()),
            node_version,
            cli_path: Some(cli_path.to_string_lossy().to_string()),
            cli_version: Some(version),
            workspace,
            platform,
            arch,
            error: None,
        },
        Err(error) => CliInfo {
            ready: false,
            node_path: Some(node_path.to_string_lossy().to_string()),
            node_version,
            cli_path: Some(cli_path.to_string_lossy().to_string()),
            cli_version: None,
            workspace,
            platform,
            arch,
            error: Some(error),
        },
    }
}

fn run_cli_blocking(
    app: &AppHandle,
    args: &[String],
    cwd: &str,
    node: &str,
    cli: &str,
) -> Result<CliOutput, String> {
    if args.is_empty() {
        return Err("No CLI arguments were provided.".into());
    }

    let node_path = find_node(node, app).ok_or_else(|| {
        "Node.js was not found. Install Node 20 or newer, or set its path in Studio settings."
            .to_string()
    })?;
    let cli_path = find_cli(cli, app).ok_or_else(|| {
        "The QChat CLI was not found. Build packages/miniapp-framework, or set the CLI path in Studio settings."
            .to_string()
    })?;

    let started = Instant::now();
    let mut command = command_for(&node_path.to_string_lossy());
    command.arg(&cli_path).args(args);

    if !cwd.trim().is_empty() {
        // Spawning with a missing working directory fails with an opaque OS error
        // (ERROR_DIRECTORY / os error 267 on Windows), so report it clearly.
        let cwd_path = PathBuf::from(cwd);
        if !cwd_path.is_dir() {
            return Err(format!("The working directory does not exist: {cwd}"));
        }
        command.current_dir(cwd_path);
    }

    let output = command
        .output()
        .map_err(|error| format!("Could not run the QChat CLI: {error}"))?;

    Ok(CliOutput {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

fn modified_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|delta| delta.as_millis() as u64)
}

fn collect_tree(root: &Path, dir: &Path, out: &mut Vec<FsEntry>, depth: usize) {
    if depth > MAX_TREE_DEPTH || out.len() >= MAX_TREE_ENTRIES {
        return;
    }

    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    let mut children: Vec<fs::DirEntry> = read_dir.filter_map(Result::ok).collect();
    children.sort_by_key(|entry| {
        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|meta| meta.is_dir()).unwrap_or(false);
        (!is_dir, entry.file_name().to_string_lossy().to_lowercase())
    });

    for child in children {
        if out.len() >= MAX_TREE_ENTRIES {
            return;
        }

        let name = child.file_name().to_string_lossy().to_string();
        let path = child.path();
        let Ok(metadata) = child.metadata() else {
            continue;
        };
        let is_dir = metadata.is_dir();

        if is_dir && IGNORED_DIRECTORIES.contains(&name.as_str()) {
            continue;
        }
        if !is_dir && IGNORED_FILES.contains(&name.as_str()) {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        out.push(FsEntry {
            name,
            path: path.to_string_lossy().to_string(),
            relative,
            is_dir,
            size: if is_dir { 0 } else { metadata.len() },
            modified_ms: modified_ms(&metadata),
        });

        if is_dir {
            collect_tree(root, &path, out, depth + 1);
        }
    }
}

fn stop_dev_inner(state: &DevState) {
    let child = {
        let mut guard = state.child.lock().unwrap();
        guard.take()
    };

    if let Some(mut child) = child {
        #[cfg(windows)]
        {
            let pid = child.id().to_string();
            let _ = command_for("taskkill")
                .args(["/PID", &pid, "/T", "/F"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[tauri::command]
async fn detect_cli(app: AppHandle, node: String, cli: String) -> Result<CliInfo, String> {
    tauri::async_runtime::spawn_blocking(move || detect_blocking(&app, &node, &cli))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn run_cli(
    app: AppHandle,
    args: Vec<String>,
    cwd: String,
    node: String,
    cli: String,
) -> Result<CliOutput, String> {
    tauri::async_runtime::spawn_blocking(move || run_cli_blocking(&app, &args, &cwd, &node, &cli))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn start_dev(
    app: AppHandle,
    state: State<'_, DevState>,
    cwd: String,
    node: String,
    cli: String,
) -> Result<u32, String> {
    if cwd.trim().is_empty() {
        return Err("Open a project before starting the dev watcher.".into());
    }

    stop_dev_inner(&state);

    let node_path = find_node(&node, &app).ok_or_else(|| {
        "Node.js was not found. Install Node 20 or newer, or set its path in Studio settings."
            .to_string()
    })?;
    let cli_path = find_cli(&cli, &app).ok_or_else(|| {
        "The QChat CLI was not found. Build packages/miniapp-framework, or set the CLI path in Studio settings."
            .to_string()
    })?;

    let mut command = command_for(&node_path.to_string_lossy());
    command
        .arg(&cli_path)
        .arg("dev")
        .arg("--dir")
        .arg(&cwd)
        .current_dir(&cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start the dev watcher: {error}"))?;

    let pid = child.id();

    if let Some(stdout) = child.stdout.take() {
        let handle = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let _ = handle.emit(
                    "qapp-dev-log",
                    DevLog {
                        stream: "stdout".into(),
                        line,
                    },
                );
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let handle = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = handle.emit(
                    "qapp-dev-log",
                    DevLog {
                        stream: "stderr".into(),
                        line,
                    },
                );
            }
        });
    }

    {
        let mut guard = state.child.lock().unwrap();
        *guard = Some(child);
    }

    let handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(350));
        let state = handle.state::<DevState>();
        let mut guard = state.child.lock().unwrap();
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(status)) => {
                    let code = status.code().unwrap_or(-1);
                    *guard = None;
                    drop(guard);
                    let _ = handle.emit("qapp-dev-exit", DevExit { code });
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    *guard = None;
                    drop(guard);
                    let _ = handle.emit("qapp-dev-exit", DevExit { code: -1 });
                    break;
                }
            },
            None => break,
        }
    });

    Ok(pid)
}

#[tauri::command]
fn stop_dev(state: State<'_, DevState>) -> Result<(), String> {
    stop_dev_inner(&state);
    Ok(())
}

#[tauri::command]
fn list_tree(root: String) -> Result<Vec<FsEntry>, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("{root} is not a folder"));
    }

    let mut entries = Vec::new();
    collect_tree(&path, &path, &mut entries, 0);
    Ok(entries)
}

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

fn fnv1a(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash ^= u64::from(*byte);
        *hash = hash.wrapping_mul(FNV_PRIME);
    }
}

fn file_stamp(path: &str) -> FileStamp {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => FileStamp {
            path: path.to_string(),
            exists: true,
            size: metadata.len(),
            modified_ms: modified_ms(&metadata),
        },
        _ => FileStamp {
            path: path.to_string(),
            exists: false,
            size: 0,
            modified_ms: None,
        },
    }
}

/// Size + modification time for a batch of files. The studio polls this while a
/// project is open so edits made outside the app are picked up in near real
/// time (and so an unsaved tab can be flagged as conflicting instead of being
/// overwritten).
#[tauri::command]
fn file_stamps(paths: Vec<String>) -> Vec<FileStamp> {
    paths.iter().map(|path| file_stamp(path)).collect()
}

/// Folds every entry name (plus the directory/file bit) of a folder tree into a
/// hash, so the studio can tell whether files were added, removed or renamed
/// without shipping the whole listing over IPC on every poll.
fn fold_structure(root: &Path, dir: &Path, hash: &mut u64, count: &mut usize, depth: usize) {
    if depth > MAX_TREE_DEPTH || *count >= MAX_TREE_ENTRIES {
        return;
    }

    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    let mut children: Vec<fs::DirEntry> = read_dir.filter_map(Result::ok).collect();
    children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());

    for child in children {
        if *count >= MAX_TREE_ENTRIES {
            return;
        }

        let name = child.file_name().to_string_lossy().to_string();
        let Ok(file_type) = child.file_type() else {
            continue;
        };
        let is_dir = file_type.is_dir();

        if is_dir && IGNORED_DIRECTORIES.contains(&name.as_str()) {
            continue;
        }
        if !is_dir && IGNORED_FILES.contains(&name.as_str()) {
            continue;
        }

        *count += 1;
        let path = child.path();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        fnv1a(hash, relative.as_bytes());
        fnv1a(hash, if is_dir { b"d" } else { b"f" });

        if is_dir {
            fold_structure(root, &path, hash, count, depth + 1);
        }
    }
}

#[tauri::command]
fn tree_signature(root: String) -> Result<String, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("{root} is not a folder"));
    }

    let mut hash = FNV_OFFSET;
    let mut count = 0usize;
    fold_structure(&path, &path, &mut hash, &mut count, 0);
    // Hex, so the 64 bit hash survives the JSON number round-trip in JS.
    Ok(format!("{hash:016x}"))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let file = PathBuf::from(&path);
    let metadata = fs::metadata(&file).map_err(|error| format!("Cannot read {path}: {error}"))?;

    if !metadata.is_file() {
        return Err(format!("{path} is not a file"));
    }
    if metadata.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "{path} is larger than {} MB and cannot be opened in the editor",
            MAX_TEXT_BYTES / 1024 / 1024
        ));
    }

    let bytes = fs::read(&file).map_err(|error| format!("Cannot read {path}: {error}"))?;
    let probe = &bytes[..bytes.len().min(8 * 1024)];
    if probe.contains(&0) {
        return Err(format!("{path} looks like a binary file"));
    }

    let mut text = String::from_utf8_lossy(&bytes).to_string();
    if text.starts_with('\u{feff}') {
        text.remove(0);
    }
    Ok(text)
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    if let Some(parent) = file.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
        }
    }
    fs::write(&file, contents).map_err(|error| format!("Cannot write {path}: {error}"))
}

#[tauri::command]
fn ensure_directory(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("No directory path was provided.".into());
    }
    fs::create_dir_all(&path).map_err(|error| format!("Cannot create {path}: {error}"))
}

#[tauri::command]
fn create_entry(path: String, directory: bool) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if target.exists() {
        return Err(format!("{path} already exists"));
    }

    if directory {
        fs::create_dir_all(&target).map_err(|error| format!("Cannot create {path}: {error}"))
    } else {
        if let Some(parent) = target.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
            }
        }
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map(|_| ())
            .map_err(|error| format!("Cannot create {path}: {error}"))
    }
}

#[tauri::command]
fn rename_entry(path: String, next: String) -> Result<(), String> {
    let source = PathBuf::from(&path);
    let target = PathBuf::from(&next);

    if !source.exists() {
        return Err(format!("{path} does not exist"));
    }
    if target.exists() {
        return Err(format!("{next} already exists"));
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
    }

    fs::rename(&source, &target).map_err(|error| format!("Cannot rename {path}: {error}"))
}

#[tauri::command]
fn delete_entry(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if !target.exists() {
        return Ok(());
    }
    if target.parent().is_none() {
        return Err("Refusing to delete a filesystem root".into());
    }

    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|error| format!("Cannot delete {path}: {error}"))
    } else {
        fs::remove_file(&target).map_err(|error| format!("Cannot delete {path}: {error}"))
    }
}

#[tauri::command]
fn list_artifacts(project: String) -> Result<Vec<Artifact>, String> {
    let dist = PathBuf::from(&project).join("dist");
    let mut artifacts = Vec::new();

    let Ok(read_dir) = fs::read_dir(&dist) else {
        return Ok(artifacts);
    };

    for entry in read_dir.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.to_lowercase().ends_with(".japp") {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        artifacts.push(Artifact {
            path: path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
            modified_ms: modified_ms(&metadata),
        });
    }

    artifacts.sort_by(|left, right| right.modified_ms.cmp(&left.modified_ms));
    Ok(artifacts)
}

/// Keeps the frameless shell looking native on Windows 11: the window has no
/// decorations, so DWM would otherwise draw a square silhouette with a white
/// 1px frame. The app paints its own title bar, so only the outline is adjusted.
#[cfg(windows)]
fn apply_window_chrome(window: &tauri::WebviewWindow) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use std::ffi::c_void;

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            attribute: u32,
            value: *const c_void,
            size: u32,
        ) -> i32;
    }

    let Ok(handle) = window.window_handle() else {
        return;
    };
    let RawWindowHandle::Win32(win32) = handle.as_raw() else {
        return;
    };
    let hwnd = win32.hwnd.get() as *mut c_void;

    // DWMWA_WINDOW_CORNER_PREFERENCE (33) with DWMWCP_ROUND (2).
    let rounded: u32 = 2;
    // DWMWA_BORDER_COLOR (34) with COLORREF(0x00BBGGRR) for #07090d.
    let background: u32 = 0x000D_0907;

    unsafe {
        DwmSetWindowAttribute(hwnd, 33, &rounded as *const u32 as *const c_void, 4);
        DwmSetWindowAttribute(hwnd, 34, &background as *const u32 as *const c_void, 4);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                apply_window_chrome(&window);
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DevState::default())
        .invoke_handler(tauri::generate_handler![
            detect_cli,
            run_cli,
            start_dev,
            stop_dev,
            list_tree,
            tree_signature,
            file_stamps,
            read_text_file,
            write_text_file,
            ensure_directory,
            create_entry,
            rename_entry,
            delete_entry,
            list_artifacts
        ])
        .run(tauri::generate_context!())
        .expect("error while running QChat Mini App Studio");
}
