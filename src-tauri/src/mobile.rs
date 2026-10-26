use std::path::PathBuf;

use tauri::{Manager, Runtime};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use omniget_core::models::media::{DownloadOptions, DownloadResult};
use omniget_core::models::progress::ProgressUpdate;
use omniget_core::platforms::{InstagramDownloader, Platform, PlatformDownloader, RedditDownloader, TikTokDownloader, TwitterDownloader};

#[derive(Clone, serde::Serialize)]
pub struct MobileDownloadStarted {
    pub id: u64,
    pub title: String,
}

#[derive(Clone, serde::Serialize)]
pub struct MobilePlatformInfo {
    pub platform: String,
    pub supported: bool,
    pub content_id: Option<String>,
    pub content_type: Option<String>,
}

fn platform_downloader(platform: &Platform) -> Option<Box<dyn PlatformDownloader>> {
    match platform {
        Platform::Instagram => Some(Box::new(InstagramDownloader::new())),
        Platform::TikTok => Some(Box::new(TikTokDownloader::new())),
        Platform::Twitter => Some(Box::new(TwitterDownloader::new())),
        Platform::Reddit => Some(Box::new(RedditDownloader::new())),
        _ => None,
    }
}

fn content_type_from_info(info: &omniget_core::models::media::MediaInfo) -> String {
    format!("{:?}", info.media_type).to_lowercase()
}

#[tauri::command]
pub async fn detect_platform(url: String) -> Result<MobilePlatformInfo, String> {
    let platform = Platform::from_url(&url);
    Ok(match platform {
        Some(platform) => MobilePlatformInfo {
            platform: platform.to_string(),
            supported: platform_downloader(&platform).is_some(),
            content_id: None,
            content_type: None,
        },
        None => MobilePlatformInfo {
            platform: "unknown".to_string(),
            supported: false,
            content_id: None,
            content_type: None,
        },
    })
}

fn default_download_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .video_dir()
        .map(|p| p.join("OmniGet"))
        .map_err(|e| format!("Unable to resolve Android download directory: {e}"))
}

#[tauri::command]
pub async fn download_from_url<R: Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    output_dir: String,
    download_mode: Option<String>,
    quality: Option<String>,
    format_id: Option<String>,
    referer: Option<String>,
    cookie_slug: Option<String>,
    time_range: Option<String>,
    playlist_items: Option<String>,
    torrent_files: Option<Vec<usize>>,
    scheduled_at: Option<u64>,
    stop_at: Option<u64>,
) -> Result<MobileDownloadStarted, String> {
    let _ = (cookie_slug, time_range, playlist_items, torrent_files, scheduled_at, stop_at);

    let platform = Platform::from_url(&url).ok_or_else(|| "Unsupported or invalid URL".to_string())?;
    let downloader = platform_downloader(&platform).ok_or_else(|| {
        if platform == Platform::Other("facebook".to_string()) {
            "Facebook support is being prepared for the Android-native downloader".to_string()
        } else {
            format!("{} is not available in the Android-native downloader yet", platform)
        }
    })?;

    let mut output = if output_dir.trim().is_empty() {
        default_download_dir(&app)?
    } else {
        PathBuf::from(output_dir)
    };
    if output.to_string_lossy().starts_with("content://") {
        output = default_download_dir(&app)?;
    }
    output.push(platform.to_string());
    std::fs::create_dir_all(&output).map_err(|e| format!("Unable to create download folder: {e}"))?;

    let info = downloader
        .get_media_info(&url)
        .await
        .map_err(|e| format!("Could not read public media: {e}"))?;

    let title = info.title.clone();
    let cancel = CancellationToken::new();
    let (progress_tx, mut progress_rx) = mpsc::channel::<ProgressUpdate>(32);
    let app_for_progress = app.clone();
    let progress_id = crate::mobile::next_download_id();

    tauri::async_runtime::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            use tauri::Emitter;
            let _ = app_for_progress.emit(
                "mobile-download-progress",
                serde_json::json!({
                    "id": progress_id,
                    "percent": progress.percent,
                    "downloaded_bytes": progress.downloaded_bytes,
                    "total_bytes": progress.total_bytes,
                    "speed_bytes_per_sec": progress.speed_bytes_per_sec,
                }),
            );
        }
    });

    let opts = DownloadOptions {
        quality,
        output_dir: output,
        filename_template: None,
        download_subtitles: false,
        include_auto_subtitles: false,
        download_mode,
        audio_format: None,
        format_id,
        referer,
        extra_headers: None,
        page_url: Some(url.clone()),
        user_agent: None,
        cancel_token: cancel,
        concurrent_fragments: 4,
        ytdlp_path: None,
        torrent_listen_port: None,
        torrent_id_slot: None,
        custom_ytdlp_args: None,
        torrent_files: None,
        torrent_auto_trackers: false,
        torrent_upnp: false,
    };

    tauri::async_runtime::spawn(async move {
        let result: anyhow::Result<DownloadResult> = downloader.download(&info, &opts, progress_tx).await;
        use tauri::Emitter;
        match result {
            Ok(done) => {
                let _ = app.emit(
                    "mobile-download-complete",
                    serde_json::json!({
                        "id": progress_id,
                        "success": true,
                        "path": done.file_path.to_string_lossy(),
                        "size_bytes": done.file_size_bytes,
                    }),
                );
            }
            Err(error) => {
                let _ = app.emit(
                    "mobile-download-complete",
                    serde_json::json!({
                        "id": progress_id,
                        "success": false,
                        "error": error.to_string(),
                    }),
                );
            }
        }
    });

    let _ = content_type_from_info(&info);
    Ok(MobileDownloadStarted { id: progress_id, title })
}

fn next_download_id() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT_ID: AtomicU64 = AtomicU64::new(1);
    NEXT_ID.fetch_add(1, Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_android_supported_social_platforms() {
        for (url, expected) in [
            ("https://www.instagram.com/p/abc/", "instagram"),
            ("https://www.tiktok.com/@user/video/123", "tiktok"),
            ("https://x.com/user/status/123", "twitter"),
            ("https://www.reddit.com/r/test/comments/abc/post/", "reddit"),
        ] {
            let platform = Platform::from_url(url).expect("platform should be detected");
            assert_eq!(platform.to_string(), expected);
            assert!(platform_downloader(&platform).is_some());
        }
    }
}
