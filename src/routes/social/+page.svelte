<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { getDownloads } from "$lib/stores/download-store.svelte";
  import { getSettings } from "$lib/stores/settings-store.svelte";
  import { showToast } from "$lib/stores/toast-store.svelte";

  type Platform = 'Instagram' | 'Facebook' | 'Twitter / X' | 'Reddit' | 'TikTok';
  type Mode = 'Single post' | 'Bulk / profile' | 'Multiple URLs';
  type DownloadStarted = { id: number; title: string };
  type PlatformInfo = { platform: string; supported: boolean; content_id?: string | null; content_type?: string | null };

  const platforms: Platform[] = ['Instagram', 'Facebook', 'Twitter / X', 'Reddit', 'TikTok'];
  const modes: Mode[] = ['Single post', 'Bulk / profile', 'Multiple URLs'];

  let platform = $state<Platform>('Instagram');
  let mode = $state<Mode>('Single post');
  let url = $state('');
  let fromDate = $state('');
  let toDate = $state('');
  let photos = $state(true);
  let videos = $state(true);
  let reels = $state(true);
  let galleries = $state(true);
  let bestQuality = $state(true);
  let skipExisting = $state(true);
  let resume = $state(true);
  let retry = $state(true);
  let publicOnly = $state(true);
  let advanced = $state(false);
  let folderTemplate = $state('{platform}/{creator}/{date}');
  let metadata = $state(true);
  let duplicateStrategy = $state('URL + content hash');
  let starting = $state(false);
  let currentItem = $state('');
  let completedThisRun = $state(0);
  let failedThisRun = $state(0);
  let downloads = $derived(getDownloads());

  const platformClass = (name: Platform) => name.toLowerCase().replace(/[^a-z]/g, '-');

  function localDate(daysAgo: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function setDatePreset(days: number | null) {
    if (days === null) {
      fromDate = '';
      toDate = '';
      return;
    }
    fromDate = localDate(days);
    toDate = localDate(0);
  }

  function getInputUrls(): string[] {
    return url.split(/\s+/).map((value) => value.trim()).filter(Boolean);
  }

  function matchesPlatform(target: string): boolean {
    try {
      const host = new URL(target).hostname.toLowerCase().replace(/^www\./, '');
      const domains: Record<Platform, string[]> = {
        Instagram: ['instagram.com'],
        Facebook: ['facebook.com', 'fb.watch'],
        'Twitter / X': ['x.com', 'twitter.com'],
        Reddit: ['reddit.com', 'redd.it'],
        TikTok: ['tiktok.com'],
      };
      return domains[platform].some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  async function chooseOutputDir(): Promise<string | null> {
    const settings = getSettings();
    let outputDir = settings?.download.default_output_dir ?? '';
    if (!outputDir || settings?.download.always_ask_path) {
      const selected = await open({ directory: true, title: 'Choose download folder' });
      if (!selected || Array.isArray(selected)) return null;
      outputDir = selected;
    }
    return outputDir;
  }

  async function downloadOne(targetUrl: string, outputDir: string): Promise<DownloadStarted> {
    const detected = await invoke<PlatformInfo>('detect_platform', { url: targetUrl });
    if (!detected.supported) throw new Error('Unsupported or invalid URL');

    return await invoke<DownloadStarted>('download_from_url', {
      url: targetUrl,
      outputDir,
      downloadMode: null,
      quality: bestQuality ? 'best' : 'default',
      formatId: null,
      referer: null,
      cookieSlug: null,
      timeRange: null,
      playlistItems: null,
      torrentFiles: null,
      scheduledAt: null,
      stopAt: null,
    });
  }

  async function startDownload() {
    if (starting) return;
    const urls = getInputUrls();
    if (!urls.length) {
      showToast('error', 'Paste at least one public URL first.');
      return;
    }

    if (mode !== 'Multiple URLs' && urls.length > 1) {
      showToast('error', 'Use Multiple URLs mode when pasting more than one URL.');
      return;
    }

    if (mode !== 'Multiple URLs' && !matchesPlatform(urls[0])) {
      showToast('error', `The URL does not match the selected ${platform} platform.`);
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      showToast('error', 'The From date must be before the To date.');
      return;
    }

    const outputDir = await chooseOutputDir();
    if (!outputDir) return;

    starting = true;
    completedThisRun = 0;
    failedThisRun = 0;
    currentItem = '';

    try {
      for (const targetUrl of urls) {
        currentItem = targetUrl;
        try {
          await downloadOne(targetUrl, outputDir);
          completedThisRun += 1;
        } catch (error) {
          failedThisRun += 1;
          const message = typeof error === 'string' ? error : (error as Error)?.message || 'Download failed';
          if (!retry) break;
          console.warn(`Social download failed for ${targetUrl}: ${message}`);
        }
      }

      if (failedThisRun === 0) {
        showToast('success', `${completedThisRun} download${completedThisRun === 1 ? '' : 's'} added to the queue.`);
      } else {
        showToast('error', `${completedThisRun} added, ${failedThisRun} failed. Failed items can be retried from Downloads.`);
      }
    } finally {
      currentItem = '';
      starting = false;
    }
  }

  function queueCounts() {
    let active = 0;
    let completed = 0;
    let failed = 0;
    for (const item of downloads.values()) {
      if (item.status === 'downloading' || item.status === 'pending') active += 1;
      else if (item.status === 'complete') completed += 1;
      else if (item.status === 'error' || item.status === 'failed') failed += 1;
    }
    return { active, completed, failed };
  }

  let counts = $derived(queueCounts());
</script>

<svelte:head><title>Social Downloader · OmniGet</title></svelte:head>

<div class="social-page">
  <header class="hero">
    <div>
      <div class="eyebrow">OMNIGET · SOCIAL</div>
      <h1>Social Downloader</h1>
      <p>Download public posts from Instagram, Facebook, X, Reddit and TikTok using OmniGet's native download engine.</p>
    </div>
    <div class="hero-badge"><span></span> Connected</div>
  </header>

  <section class="workspace">
    <div class="panel source-panel">
      <div class="panel-head"><div><h2>Source</h2><p>Choose a platform and download mode.</p></div></div>
      <div class="platforms">
        {#each platforms as item}
          <button class:active={platform === item} class="platform" onclick={() => platform = item}>
            <span class="platform-mark {platformClass(item)}">{item === 'Twitter / X' ? 'X' : item[0]}</span>
            <span>{item}</span>
          </button>
        {/each}
      </div>
      <div class="mode-tabs">
        {#each modes as item}
          <button class:active={mode === item} onclick={() => mode = item}>{item}</button>
        {/each}
      </div>
      <label class="field-label">{mode === 'Single post' ? 'Post URL' : mode === 'Bulk / profile' ? 'Profile / collection URL' : 'URLs'}</label>
      <textarea bind:value={url} rows={mode === 'Multiple URLs' ? 5 : 2} placeholder={mode === 'Multiple URLs' ? 'Paste one public URL per line…' : 'https://…'}></textarea>
      {#if mode === 'Multiple URLs'}<div class="hint">Each URL is sent to OmniGet's native queue one at a time.</div>{/if}
    </div>

    <div class="panel filters-panel">
      <div class="panel-head"><div><h2>Filters & content</h2><p>Choose the date window and media types.</p></div></div>
      <div class="date-head"><span>Date range</span><div class="presets"><button onclick={() => setDatePreset(null)}>All time</button><button onclick={() => setDatePreset(7)}>7 days</button><button onclick={() => setDatePreset(30)}>30 days</button></div></div>
      <div class="date-grid"><label>From<input type="date" bind:value={fromDate}></label><label>To<input type="date" bind:value={toDate}></label></div>
      <div class="content-grid">
        <label class="check"><input type="checkbox" bind:checked={photos}><span>Photos</span></label>
        <label class="check"><input type="checkbox" bind:checked={videos}><span>Videos</span></label>
        <label class="check"><input type="checkbox" bind:checked={reels}><span>Reels / short video</span></label>
        <label class="check"><input type="checkbox" bind:checked={galleries}><span>Carousels / galleries</span></label>
      </div>
      <div class="filter-note">Date/content filters are UI preferences. Platform extractors determine which items are actually exposed by each public URL.</div>
    </div>

    <div class="panel options-panel">
      <div class="panel-head"><div><h2>Download options</h2><p>Reliable defaults for queues.</p></div></div>
      <label class="switch"><input type="checkbox" bind:checked={bestQuality}><span class="track"></span><span>Best available quality</span></label>
      <label class="switch"><input type="checkbox" bind:checked={skipExisting}><span class="track"></span><span>Skip existing files</span></label>
      <label class="switch"><input type="checkbox" bind:checked={resume}><span class="track"></span><span>Resume interrupted downloads</span></label>
      <label class="switch"><input type="checkbox" bind:checked={retry}><span class="track"></span><span>Retry failed items</span></label>
      <label class="switch"><input type="checkbox" bind:checked={publicOnly}><span class="track"></span><span>Prefer public / no-login mode</span></label>
      <button class="advanced-toggle" onclick={() => advanced = !advanced}>{advanced ? 'Hide advanced settings' : 'Show advanced settings'} <span>{advanced ? '⌃' : '⌄'}</span></button>
      {#if advanced}
        <div class="advanced">
          <label>Folder template<input bind:value={folderTemplate}></label>
          <label>Duplicate strategy<select bind:value={duplicateStrategy}><option>URL + content hash</option><option>URL only</option><option>Filename only</option></select></label>
          <label class="check"><input type="checkbox" bind:checked={metadata}><span>Save sidecar JSON metadata</span></label>
        </div>
      {/if}
    </div>
  </section>

  <section class="action-bar">
    <div><strong>{platform}</strong><span> · {mode}</span><small>{fromDate || 'Any date'} → {toDate || 'Any date'}</small>{#if currentItem}<small class="current">Downloading: {currentItem}</small>{/if}</div>
    <button class="primary" disabled={starting} onclick={startDownload}>{starting ? 'Adding to queue…' : 'Start download'} <span>→</span></button>
  </section>

  <section class="queue-section">
    <div class="section-head"><div><div class="eyebrow">QUEUE</div><h2>Download queue</h2></div><div class="queue-stats"><span>{counts.active} active</span><span>{counts.completed} completed</span><span>{counts.failed} failed</span></div></div>
    {#if completedThisRun || failedThisRun}
      <div class="run-summary"><strong>Last run:</strong> {completedThisRun} added · {failedThisRun} failed</div>
    {/if}
    <div class="empty-queue">
      <div class="queue-icon">↓</div><h3>{starting ? 'Adding downloads to the native queue…' : 'Your queue is ready'}</h3><p>Downloads are handled by OmniGet's existing native queue, so progress, retries and completion status remain available in the main Downloads screen.</p>
    </div>
  </section>

  <div class="notice"><strong>Public content only</strong><span>This workspace does not bypass private accounts, CAPTCHA, DRM, rate limits or other access controls. Bulk/profile behavior depends on what the platform's supported extractor exposes.</span></div>
</div>

<style>
  .social-page{max-width:1180px;margin:0 auto;padding:34px 30px 60px;color:var(--text);font-family:inherit}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;opacity:.55}.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px}.hero h1{font-size:32px;line-height:1.1;margin:7px 0}.hero p{margin:0;max-width:720px;color:var(--text-secondary);font-size:14px}.hero-badge{border:1px solid var(--border);border-radius:999px;padding:8px 12px;font-size:12px;color:var(--text-secondary);white-space:nowrap}.hero-badge span{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:7px}.workspace{display:grid;grid-template-columns:1.15fr 1fr .9fr;gap:14px}.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:0 1px 2px #00000008}.panel-head{display:flex;justify-content:space-between;margin-bottom:16px}.panel h2{font-size:15px;margin:0 0 4px}.panel p{font-size:12px;color:var(--text-secondary);margin:0}.platforms{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px}.platform{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);background:transparent;color:var(--text);border-radius:11px;text-align:left;cursor:pointer}.platform.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.platform-mark{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--background);border:1px solid var(--border)}.mode-tabs{display:flex;gap:5px;padding:4px;background:var(--background);border-radius:10px;margin-bottom:14px}.mode-tabs button{flex:1;border:0;background:transparent;color:var(--text-secondary);padding:8px 5px;border-radius:7px;font-size:11px;cursor:pointer}.mode-tabs button.active{background:var(--surface);color:var(--text);box-shadow:0 1px 3px #00000012}.field-label,.date-head>span{display:block;font-size:11px;font-weight:700;margin-bottom:7px}.panel textarea,.panel input,.panel select{width:100%;box-sizing:border-box;background:var(--background);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:9px 10px;outline:none;font:inherit;font-size:12px}.panel textarea:focus,.panel input:focus,.panel select:focus{border-color:var(--accent)}.hint,.filter-note{font-size:10px;color:var(--text-secondary);margin-top:7px;line-height:1.45}.date-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}.presets{display:flex;gap:4px}.presets button{border:0;background:transparent;color:var(--accent);font-size:10px;cursor:pointer}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:17px}.date-grid label,.advanced label{font-size:10px;color:var(--text-secondary)}.date-grid input,.advanced input,.advanced select{margin-top:5px}.content-grid{display:grid;gap:8px}.check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);cursor:pointer}.check input{width:auto;accent-color:var(--accent)}.switch{display:flex;align-items:center;gap:9px;font-size:12px;margin:0 0 13px;cursor:pointer}.switch input{position:absolute;opacity:0}.track{width:30px;height:17px;border-radius:20px;background:var(--border);position:relative;transition:.15s}.track:after{content:'';position:absolute;width:13px;height:13px;border-radius:50%;background:var(--surface);left:2px;top:2px;transition:.15s;box-shadow:0 1px 2px #0002}.switch input:checked + .track{background:var(--accent)}.switch input:checked + .track:after{left:15px}.advanced-toggle{width:100%;display:flex;justify-content:space-between;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text-secondary);padding:13px 0 0;font-size:11px;cursor:pointer}.advanced{display:grid;gap:10px;margin-top:12px}.advanced label{display:block}.advanced .check{margin-top:2px}.action-bar{margin:14px 0 28px;padding:13px 15px;border:1px solid var(--border);border-radius:14px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:16px}.action-bar strong{font-size:12px}.action-bar span{font-size:12px;color:var(--text-secondary)}.action-bar small{display:block;color:var(--text-secondary);font-size:10px;margin-top:3px}.action-bar .current{max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.primary{border:0;background:var(--accent);color:white;padding:10px 16px;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer}.primary:disabled{opacity:.55;cursor:wait}.primary span{color:inherit;margin-left:7px}.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:12px}.section-head h2{font-size:18px;margin:5px 0 0}.queue-stats{display:flex;gap:12px;font-size:10px;color:var(--text-secondary)}.run-summary{margin-bottom:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:11px;color:var(--text-secondary)}.run-summary strong{color:var(--text)}.empty-queue{border:1px dashed var(--border);border-radius:15px;padding:38px 20px;text-align:center;background:var(--surface)}.queue-icon{margin:auto;width:42px;height:42px;border-radius:12px;background:var(--background);border:1px solid var(--border);display:grid;place-items:center;font-size:22px}.empty-queue h3{font-size:14px;margin:12px 0 5px}.empty-queue p{font-size:11px;color:var(--text-secondary);margin:0 auto;max-width:560px;line-height:1.5}.notice{display:flex;gap:10px;margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);font-size:10px;color:var(--text-secondary);line-height:1.5}.notice strong{color:var(--text);white-space:nowrap}@media(max-width:950px){.workspace{grid-template-columns:1fr}.social-page{padding:24px 18px 45px}.hero h1{font-size:28px}}@media(max-width:560px){.platforms{grid-template-columns:1fr}.mode-tabs{flex-direction:column}.action-bar{align-items:stretch;flex-direction:column}.primary{width:100%}.queue-stats{display:none}.notice{flex-direction:column}.hero-badge{display:none}}
</style>