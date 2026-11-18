use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent};

const TRAY: &str = "limits";
const MAIN_WINDOW: &str = "main";

struct MonitorService(Mutex<Option<Child>>);

#[tauri::command]
fn show_limits(app: AppHandle, text: String) -> Result<(), String> {
  let tray = app.tray_by_id(TRAY).ok_or("The menu bar item is missing.")?;
  tray.set_tooltip(Some(text)).map_err(|error| error.to_string())
}

fn start_monitor_service() -> Option<Child> {
  Command::new(env!("IBID_NODE")).arg(env!("IBID_MONITOR_SCRIPT")).spawn().ok()
}

fn stop_monitor_service(app: &AppHandle) {
  if let Ok(mut service) = app.state::<MonitorService>().0.lock() {
    if let Some(mut child) = service.take() {
      let _ = child.kill();
    }
  }
}

fn bring_forward(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

fn add_menu_bar_item(app: &tauri::App) -> tauri::Result<()> {
  let mut tray = TrayIconBuilder::with_id(TRAY).tooltip("ibid").on_tray_icon_event(|tray, event| {
    if let TrayIconEvent::Click { .. } = event {
      bring_forward(tray.app_handle());
    }
  });
  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }
  tray.build(app).map(|_| ())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(MonitorService(Mutex::new(start_monitor_service())))
    .invoke_handler(tauri::generate_handler![show_limits])
    .setup(|app| Ok(add_menu_bar_item(app)?))
    .build(tauri::generate_context!())
    .expect("the application could not start")
    .run(|app, event| {
      if let RunEvent::Exit = event {
        stop_monitor_service(app);
      }
    });
}
