use std::path::Path;
use std::process::Command;

fn node_path() -> String {
  Command::new("which")
    .arg("node")
    .output()
    .ok()
    .map(|found| String::from_utf8_lossy(&found.stdout).trim().to_string())
    .filter(|path| !path.is_empty())
    .unwrap_or_else(|| "node".to_string())
}

fn monitor_script() -> String {
  let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../langgraph/dist/monitor.js");
  script.canonicalize().unwrap_or(script).to_string_lossy().to_string()
}

fn main() {
  println!("cargo:rustc-env=IBID_NODE={}", node_path());
  println!("cargo:rustc-env=IBID_MONITOR_SCRIPT={}", monitor_script());
  tauri_build::build()
}
