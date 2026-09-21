use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const PIP_LABEL: &str = "helicon-browser-pip";

#[tauri::command]
pub async fn browser_pip_open(app: AppHandle, pip_url: String) -> Result<(), String> {
    if app.get_webview_window(PIP_LABEL).is_some() {
        return Ok(());
    }
    let parsed = Url::parse(&pip_url).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, PIP_LABEL, WebviewUrl::External(parsed))
        .title("Browser preview")
        .inner_size(480.0, 300.0)
        .resizable(true)
        .always_on_top(true)
        .decorations(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn browser_pip_close(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(PIP_LABEL) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn snap_shot_capture(app: AppHandle) -> Result<String, String> {
    let dir = app.path().temp_dir().map_err(|e| e.to_string())?;
    let path: PathBuf = dir.join(format!("helicon-snap-{}.png", std::process::id()));
    let status = if cfg!(target_os = "macos") {
        Command::new("screencapture")
            .args(["-x", "-t", "png", path.to_string_lossy().as_ref()])
            .status()
    } else if cfg!(target_os = "linux") {
        Command::new("grim")
            .arg(path.to_string_lossy().as_ref())
            .status()
    } else if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | Out-Null; $bmp = New-Object Drawing.Bitmap ([System.Windows.Forms.SystemInformation]::VirtualScreen.Width), ([System.Windows.Forms.SystemInformation]::VirtualScreen.Height); $gfx = [Drawing.Graphics]::FromImage($bmp); $gfx.CopyFromScreen([System.Windows.Forms.SystemInformation]::VirtualScreen.Left, [System.Windows.Forms.SystemInformation]::VirtualScreen.Top, 0, 0, $bmp.Size); $bmp.Save('{}');",
                    path.to_string_lossy().replace('\'', "''")
                ),
            ])
            .status()
    } else {
        return Err("OS snapshot is not supported on this platform.".into());
    };
    match status {
        Ok(s) if s.success() => {}
        _ => return Err("Could not capture the screen. Install grim on Linux or use the desktop build.".into()),
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    Ok(STANDARD.encode(bytes))
}
