#[cfg(target_os = "linux")]
fn install_linux_desktop_icon() {
  use std::fs;
  use std::io::Write;
  use std::path::PathBuf;
  use std::process::Command;

  let Some(home) = std::env::var_os("HOME") else {
    return;
  };
  let home = PathBuf::from(home);
  let icon_id = "com.stremo.app";
  let hicolor = home.join(".local/share/icons/hicolor");
  let apps = home.join(".local/share/applications");

  let copies: &[(&str, &[u8])] = &[
    ("32x32", include_bytes!("../icons/32x32.png")),
    ("64x64", include_bytes!("../icons/64x64.png")),
    ("128x128", include_bytes!("../icons/128x128.png")),
    ("256x256", include_bytes!("../icons/icon.png")),
    ("512x512", include_bytes!("../icons/icon.png")),
  ];

  for (size, bytes) in copies {
    let dir = hicolor.join(format!("{size}/apps"));
    if fs::create_dir_all(&dir).is_err() {
      continue;
    }
    let path = dir.join(format!("{icon_id}.png"));
    let _ = fs::write(path, bytes);
  }

  let pixmaps = home.join(".local/share/pixmaps");
  if fs::create_dir_all(&pixmaps).is_ok() {
    let _ = fs::write(pixmaps.join(format!("{icon_id}.png")), include_bytes!("../icons/icon.png"));
  }

  if fs::create_dir_all(&apps).is_err() {
    return;
  }

  let exec = std::env::current_exe()
    .ok()
    .and_then(|p| p.into_os_string().into_string().ok())
    .unwrap_or_else(|| "stremo".into());

  let desktop = format!(
    "[Desktop Entry]\n\
     Type=Application\n\
     Name=Stremo\n\
     Comment=Stremo live workspace screens\n\
     Exec=\"{exec}\"\n\
     Icon={icon_id}\n\
     Terminal=false\n\
     Categories=Office;Utility;\n\
     StartupWMClass=com.stremo.app\n\
     StartupNotify=true\n"
  );

  if let Ok(mut file) = fs::File::create(apps.join(format!("{icon_id}.desktop"))) {
    let _ = file.write_all(desktop.as_bytes());
  }

  let _ = Command::new("update-desktop-database").arg(&apps).output();
  let _ = Command::new("gtk-update-icon-cache")
    .args(["-f", "-t"])
    .arg(&hicolor)
    .output();
}

// WebKitGTK ships WebRTC disabled by default, so RTCPeerConnection is missing
// from the webview until these settings are flipped on.
#[cfg(target_os = "linux")]
fn enable_webview_webrtc(window: &tauri::WebviewWindow) {
  use webkit2gtk::glib::object::ObjectExt;
  use webkit2gtk::WebViewExt;

  let _ = window.with_webview(|webview| {
    let Some(settings) = WebViewExt::settings(&webview.inner()) else {
      return;
    };
    for name in ["enable-webrtc", "enable-media-stream", "enable-mediasource"] {
      if settings.find_property(name).is_some() {
        settings.set_property(name, true);
      }
    }
  });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(desktop)]
      {
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        app.handle().plugin(tauri_plugin_process::init())?;
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      use tauri::Manager;
      if let Some(window) = app.get_webview_window("main") {
        if let Some(icon) = app.default_window_icon().cloned() {
          let _ = window.set_icon(icon);
        }
        #[cfg(target_os = "linux")]
        enable_webview_webrtc(&window);
      }

      #[cfg(target_os = "linux")]
      install_linux_desktop_icon();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
