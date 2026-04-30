use std::sync::Mutex;
use tauri::State;
use tauri::http::Response;

#[derive(Default, serde::Serialize)]
struct AppStateData {
    file_path: Option<String>,
    is_dirty: bool,
    view_mode: String,
}

struct AppState(Mutex<AppStateData>);

#[tauri::command]
fn open_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut st = state.0.lock().unwrap();
    st.file_path = Some(path);
    st.is_dirty = false;
    Ok(content)
}

#[tauri::command]
fn save_file(path: String, content: String, state: State<'_, AppState>) -> Result<(), String> {
    // Atomic save: write to a .tmp file then rename
    let temp_path = format!("{}.tmp", path);
    std::fs::write(&temp_path, content).map_err(|e| e.to_string())?;
    std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;
    
    let mut st = state.0.lock().unwrap();
    st.file_path = Some(path);
    st.is_dirty = false;
    Ok(())
}

#[tauri::command]
fn watch_file(_path: String) -> Result<(), String> {
    // File watching placeholder
    Ok(())
}

#[tauri::command]
fn sync_state(is_dirty: bool, view_mode: String, state: State<'_, AppState>) {
    let mut st = state.0.lock().unwrap();
    st.is_dirty = is_dirty;
    st.view_mode = view_mode;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(AppStateData {
            file_path: None,
            is_dirty: false,
            view_mode: "editor".to_string(),
        })))
        .register_uri_scheme_protocol("kuro-asset", |_app, request| {
            let uri = request.uri().to_string();
            let path_str = uri.replace("kuro-asset://localhost", "").replace("kuro-asset://", "");
            let path_str = percent_encoding::percent_decode(path_str.as_bytes()).decode_utf8_lossy().to_string();

            let path_str = if cfg!(windows) && path_str.starts_with('/') && path_str.chars().nth(2) == Some(':') {
                path_str[1..].to_string()
            } else {
                path_str
            };

            let path = std::path::PathBuf::from(&path_str);
            match std::fs::read(&path) {
                Ok(data) => {
                    let mime_type = mime_guess::from_path(&path).first_or_octet_stream().as_ref().to_string();
                    Response::builder()
                        .header("Content-Type", mime_type)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(data)
                        .unwrap()
                }
                Err(_) => Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file, watch_file, sync_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
