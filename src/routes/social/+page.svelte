<script lang="ts">
  type Platform = 'Instagram' | 'Facebook' | 'Twitter / X' | 'Reddit' | 'TikTok';
  type Mode = 'Single post' | 'Bulk / profile' | 'Multiple URLs';

  const platforms: Platform[] = ['Instagram', 'Facebook', 'Twitter / X', 'Reddit', 'TikTok'];
  const modes: Mode[] = ['Single post', 'Bulk / profile', 'Multiple URLs'];

  let platform: Platform = 'Instagram';
  let mode: Mode = 'Single post';
  let url = '';
  let fromDate = '';
  let toDate = '';
  let photos = true;
  let videos = true;
  let reels = true;
  let galleries = true;
  let bestQuality = true;
  let skipExisting = true;
  let resume = true;
  let retry = true;
  let publicOnly = true;
  let advanced = false;
  let folderTemplate = '{platform}/{creator}/{date}';
  let metadata = true;
  let duplicateStrategy = 'URL + content hash';

  const platformClass = (name: Platform) => name.toLowerCase().replace(/[^a-z]/g, '-');
</script>

<svelte:head><title>Social Downloader · OmniGet</title></svelte:head>

<div class="social-page">
  <header class="hero">
    <div>
      <div class="eyebrow">OMNIGET · SOCIAL</div>
      <h1>Social Downloader</h1>
      <p>Download public posts from Instagram, Facebook, X, Reddit and TikTok with one focused workspace.</p>
    </div>
    <div class="hero-badge"><span></span> UI preview</div>
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
      <textarea bind:value={url} rows={mode === 'Multiple URLs' ? 5 : 2} placeholder={mode === 'Multiple URLs' ? 'Paste one URL per line…' : 'https://…'}></textarea>
      {#if mode === 'Multiple URLs'}<div class="hint">Paste multiple public URLs, one per line.</div>{/if}
    </div>

    <div class="panel filters-panel">
      <div class="panel-head"><div><h2>Filters & content</h2><p>Control what gets added to the queue.</p></div></div>
      <div class="date-head"><span>Date range</span><div class="presets"><button onclick={() => {fromDate='';toDate=''}}>All time</button><button onclick={() => {fromDate='';toDate=''}}>7 days</button><button onclick={() => {fromDate='';toDate=''}}>30 days</button></div></div>
      <div class="date-grid"><label>From<input type="date" bind:value={fromDate}></label><label>To<input type="date" bind:value={toDate}></label></div>
      <div class="content-grid">
        <label class="check"><input type="checkbox" bind:checked={photos}><span>Photos</span></label>
        <label class="check"><input type="checkbox" bind:checked={videos}><span>Videos</span></label>
        <label class="check"><input type="checkbox" bind:checked={reels}><span>Reels / short video</span></label>
        <label class="check"><input type="checkbox" bind:checked={galleries}><span>Carousels / galleries</span></label>
      </div>
    </div>

    <div class="panel options-panel">
      <div class="panel-head"><div><h2>Download options</h2><p>Reliable defaults for large queues.</p></div></div>
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
    <div><strong>{platform}</strong><span> · {mode}</span><small>{fromDate || 'Any date'} → {toDate || 'Any date'}</small></div>
    <button class="primary" onclick={() => {}}>Start download <span>→</span></button>
  </section>

  <section class="queue-section">
    <div class="section-head"><div><div class="eyebrow">QUEUE</div><h2>Download queue</h2></div><div class="queue-stats"><span>0 active</span><span>0 completed</span><span>0 failed</span></div></div>
    <div class="empty-queue">
      <div class="queue-icon">↓</div><h3>Your queue is ready</h3><p>Add a URL above to preview downloads here. Progress, retries and duplicate handling will be connected in the next phase.</p>
    </div>
  </section>

  <div class="notice"><strong>Public content only</strong><span>This UI is designed for content you are allowed to access. The downloader will not bypass private accounts, CAPTCHA, DRM, rate limits or other access controls. Platform availability can vary.</span></div>
</div>

<style>
  .social-page{max-width:1180px;margin:0 auto;padding:34px 30px 60px;color:var(--text);font-family:inherit}
  .hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;opacity:.55}.hero h1{font-size:32px;line-height:1.1;margin:7px 0}.hero p{margin:0;max-width:680px;color:var(--text-secondary);font-size:14px}.hero-badge{border:1px solid var(--border);border-radius:999px;padding:8px 12px;font-size:12px;color:var(--text-secondary);white-space:nowrap}.hero-badge span{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:7px}
  .workspace{display:grid;grid-template-columns:1.15fr 1fr .9fr;gap:14px}.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:0 1px 2px #00000008}.panel-head{display:flex;justify-content:space-between;margin-bottom:16px}.panel h2{font-size:15px;margin:0 0 4px}.panel p{font-size:12px;color:var(--text-secondary);margin:0}.platforms{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px}.platform{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid var(--border);background:transparent;color:var(--text);border-radius:11px;text-align:left;cursor:pointer}.platform.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.platform-mark{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--background);border:1px solid var(--border)}
  .mode-tabs{display:flex;gap:5px;padding:4px;background:var(--background);border-radius:10px;margin-bottom:14px}.mode-tabs button{flex:1;border:0;background:transparent;color:var(--text-secondary);padding:8px 5px;border-radius:7px;font-size:11px;cursor:pointer}.mode-tabs button.active{background:var(--surface);color:var(--text);box-shadow:0 1px 3px #00000012}.field-label,.date-head>span{display:block;font-size:11px;font-weight:700;margin-bottom:7px}.panel textarea,.panel input,.panel select{width:100%;box-sizing:border-box;background:var(--background);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:9px 10px;outline:none;font:inherit;font-size:12px}.panel textarea:focus,.panel input:focus,.panel select:focus{border-color:var(--accent)}.hint{font-size:10px;color:var(--text-secondary);margin-top:6px}
  .date-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}.presets{display:flex;gap:4px}.presets button{border:0;background:transparent;color:var(--accent);font-size:10px;cursor:pointer}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:17px}.date-grid label,.advanced label{font-size:10px;color:var(--text-secondary)}.date-grid input,.advanced input,.advanced select{margin-top:5px}.content-grid{display:grid;gap:8px}.check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);cursor:pointer}.check input{width:auto;accent-color:var(--accent)}
  .switch{display:flex;align-items:center;gap:9px;font-size:12px;margin:0 0 13px;cursor:pointer}.switch input{position:absolute;opacity:0}.track{width:30px;height:17px;border-radius:20px;background:var(--border);position:relative;transition:.15s}.track:after{content:'';position:absolute;width:13px;height:13px;border-radius:50%;background:var(--surface);left:2px;top:2px;transition:.15s;box-shadow:0 1px 2px #0002}.switch input:checked + .track{background:var(--accent)}.switch input:checked + .track:after{left:15px}.advanced-toggle{width:100%;display:flex;justify-content:space-between;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text-secondary);padding:13px 0 0;font-size:11px;cursor:pointer}.advanced{display:grid;gap:10px;margin-top:12px}.advanced label{display:block}.advanced .check{margin-top:2px}
  .action-bar{margin:14px 0 28px;padding:13px 15px;border:1px solid var(--border);border-radius:14px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:16px}.action-bar strong{font-size:12px}.action-bar span{font-size:12px;color:var(--text-secondary)}.action-bar small{display:block;color:var(--text-secondary);font-size:10px;margin-top:3px}.primary{border:0;background:var(--accent);color:white;padding:10px 16px;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer}.primary span{color:inherit;margin-left:7px}
  .section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:12px}.section-head h2{font-size:18px;margin:5px 0 0}.queue-stats{display:flex;gap:12px;font-size:10px;color:var(--text-secondary)}.empty-queue{border:1px dashed var(--border);border-radius:15px;padding:38px 20px;text-align:center;background:var(--surface)}.queue-icon{margin:auto;width:42px;height:42px;border-radius:12px;background:var(--background);border:1px solid var(--border);display:grid;place-items:center;font-size:22px}.empty-queue h3{font-size:14px;margin:12px 0 5px}.empty-queue p{font-size:11px;color:var(--text-secondary);margin:0 auto;max-width:510px;line-height:1.5}.notice{display:flex;gap:10px;margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);font-size:10px;color:var(--text-secondary);line-height:1.5}.notice strong{color:var(--text);white-space:nowrap}
  @media(max-width:950px){.workspace{grid-template-columns:1fr}.social-page{padding:24px 18px 45px}.hero{align-items:flex-start}.hero h1{font-size:28px}.options-panel{min-height:auto}}
  @media(max-width:560px){.platforms{grid-template-columns:1fr}.mode-tabs{flex-direction:column}.action-bar{align-items:stretch;flex-direction:column}.primary{width:100%}.queue-stats{display:none}.notice{flex-direction:column}.hero-badge{display:none}}
</style>