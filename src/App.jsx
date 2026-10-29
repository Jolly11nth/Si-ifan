import { useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Check, ChevronDown,
  Clapperboard, Clock3, Film, ImagePlus, MapPin, Play, Plus, Sparkles,
  Upload, WandSparkles, X, Zap
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const templates = [
  { id: 'cinematic', name: 'Cinematic', note: 'Film-like camera movement', icon: Film },
  { id: 'ugc', name: 'Human story', note: 'Natural, candid moments', icon: AudioLines },
  { id: 'product', name: 'Product ad', note: 'Polished commercial look', icon: Sparkles },
  { id: 'travel', name: 'Travel diary', note: 'Atmospheric and immersive', icon: MapPin },
];

const examplePrompts = [
  'A woman walks slowly toward the camera, catches the afternoon light, and smiles naturally.',
  'Gentle wind moves through the scene. The camera makes a slow cinematic push-in with realistic motion.',
  'A premium product reveal with soft reflections, subtle camera movement, and natural shadows.',
];

export default function App() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [template, setTemplate] = useState('cinematic');
  const [scene, setScene] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [duration, setDuration] = useState('5');
  const [quality, setQuality] = useState('720p');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function handleImage(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Image must be 3 MB or smaller.');
      return;
    }
    setError('');
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
  }

  async function generate() {
    if (!image) {
      setError('Upload a reference image to get started.');
      return;
    }
    if (!prompt.trim()) {
      setError('Add a prompt describing the motion and feeling you want.');
      return;
    }
    setBusy(true);
    setError('');
    setResultUrl('');
    setStatus('Preparing your creative brief…');
    const form = new FormData();
    form.append('image', image);
    form.append('template', template);
    form.append('scene', scene);
    form.append('prompt', prompt);
    form.append('aspect_ratio', aspect);
    form.append('duration', duration);
    form.append('quality', quality);
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || 'Video generation is not configured yet. Add a provider API key to the server environment.');
      if (data.video_url) {
        setResultUrl(data.video_url);
        setStatus('Your video is ready');
      } else if (data.task_id) {
        setStatus('Generation started. Waiting for the render…');
        let completed = false;
        for (let i = 0; i < 90; i++) {
          await new Promise(resolve => setTimeout(resolve, 4000));
          const poll = await fetch(`${API_BASE_URL}/api/generate/${encodeURIComponent(data.task_id)}`);
          const task = await poll.json().catch(() => ({}));
          if (!poll.ok) throw new Error(task.detail || 'Could not check generation status.');
          if (task.status === 'SUCCEEDED' || task.status === 'COMPLETED') {
            setResultUrl(task.video_url || task.output?.[0] || '');
            setStatus('Your video is ready');
            completed = true;
            break;
          }
          if (task.status === 'FAILED' || ['CANCELED', 'CANCELLED'].includes(task.status)) {
            throw new Error(task.error || 'The video provider could not complete this generation. Try a different prompt.');
          }
          setStatus('Rendering your video… ' + Math.min(99, Math.round(((i + 1) / 90) * 100)) + '%');
        }
        if (!completed) throw new Error('This render is taking longer than expected. Check back later or try again.');
      } else {
        throw new Error('The generation service returned an unexpected response.');
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Si'ifan Studio home">
          <span className="brand-mark"><Clapperboard size={20} strokeWidth={2.3} /></span>
          <span className="brand-name">si'ifan<span>studio</span></span>
        </a>
        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <div className="workspace-copy"><strong>Personal workspace</strong><span>Creator plan</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          <a className="nav-item active" href="#create"><WandSparkles size={18} /> Create video <span className="nav-dot" /></a>
          <a className="nav-item muted" href="#projects" onClick={e => e.preventDefault()}><Film size={18} /> My projects <span className="soon">Soon</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="credits-card">
            <div className="credits-top"><span className="credit-icon"><Zap size={15} /></span><span>Generation credits</span></div>
            <div className="credits-value">Demo mode <span>· API required</span></div>
            <div className="credits-track"><span /></div>
            <p>Connect a video provider to render and save your creations.</p>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">S</div><div className="profile-copy"><strong>Studio creator</strong><span>Free workspace</span></div><ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <main className="main-area" id="create">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Create video</strong></div>
          <div className="topbar-right"><span className="status-pill"><span className="status-dot" /> AI studio</span><button className="help-button" title="Help">?</button></div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><Sparkles size={14} /> IMAGE TO VIDEO</div>
              <h1>Make your idea <span>feel real.</span></h1>
              <p>Start with an image. Describe the moment. Let Si'ifan bring it to life.</p>
            </div>
            <div className="heading-badge"><span className="badge-orb"><Sparkles size={16} /></span><div><strong>Made for realism</strong><span>Natural motion, human moments</span></div></div>
          </section>

          <div className="creator-layout">
            <section className="form-column">
              <div className="section-card upload-card">
                <div className="card-heading"><div className="step-number">01</div><div><h2>Start with an image</h2><p>Choose the image you want to animate.</p></div><span className="optional-tag">Required</span></div>
                {imageUrl ? (
                  <div className="uploaded-preview">
                    <img src={imageUrl} alt="Uploaded reference" />
                    <div className="uploaded-overlay"><span><Check size={14} /> Image added</span><button onClick={() => { setImage(null); setImageUrl(''); }} aria-label="Remove image"><X size={16} /></button></div>
                  </div>
                ) : (
                  <button className="upload-zone" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleImage(e.dataTransfer.files?.[0]); }}>
                    <span className="upload-icon"><ImagePlus size={23} /></span>
                    <strong>Drop your image here, or <span>browse</span></strong>
                    <small>PNG, JPG or WebP · Up to 3 MB</small>
                    <span className="upload-button"><Upload size={15} /> Upload image</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => handleImage(e.target.files?.[0])} />
              </div>

              <div className="section-card">
                <div className="card-heading"><div className="step-number">02</div><div><h2>Choose a video style</h2><p>Pick a starting point for the visual language.</p></div></div>
                <div className="template-grid">
                  {templates.map(item => {
                    const Icon = item.icon;
                    return <button key={item.id} className={'template-option ' + (template === item.id ? 'selected' : '')} onClick={() => setTemplate(item.id)}>
                      <span className={'template-art art-' + item.id}><Icon size={20} /></span>
                      <span className="template-text"><strong>{item.name}</strong><small>{item.note}</small></span>
                      <span className="radio-mark">{template === item.id && <span />}</span>
                    </button>;
                  })}
                </div>
              </div>

              <div className="section-card">
                <div className="card-heading"><div className="step-number">03</div><div><h2>Set the scene</h2><p>Give the moment a place, atmosphere, and feeling.</p></div></div>
                <label className="field-label" htmlFor="scene">Location or scene <span>Optional</span></label>
                <div className="input-with-icon"><MapPin size={17} /><input id="scene" value={scene} onChange={e => setScene(e.target.value)} placeholder="e.g. Lagos rooftop at golden hour" maxLength={180} /></div>
                <label className="field-label prompt-label" htmlFor="prompt">Describe your video <span className="required-label">Required</span></label>
                <textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe what happens, how the subject moves, the camera motion, lighting, and mood…" rows={5} maxLength={1200} />
                <div className="prompt-footer"><button className="prompt-helper" onClick={() => setPrompt(examplePrompts[Math.floor(Math.random() * examplePrompts.length)])}><Sparkles size={14} /> Inspire me</button><span>{prompt.length}/1200</span></div>
                <div className="prompt-tip"><Sparkles size={14} /><span><strong>Pro tip:</strong> Describe small, believable movements and a clear camera action for a more natural result.</span></div>
              </div>

              <div className="section-card settings-card">
                <div className="card-heading"><div className="step-number">04</div><div><h2>Output settings</h2><p>Fine-tune the format for your platform.</p></div></div>
                <div className="settings-grid">
                  <div><label className="field-label">Aspect ratio</label><div className="segmented-control"><button className={aspect === '9:16' ? 'chosen' : ''} onClick={() => setAspect('9:16')}><span className="ratio-portrait" /> 9:16</button><button className={aspect === '16:9' ? 'chosen' : ''} onClick={() => setAspect('16:9')}><span className="ratio-landscape" /> 16:9</button><button className={aspect === '1:1' ? 'chosen' : ''} onClick={() => setAspect('1:1')}><span className="ratio-square" /> 1:1</button></div></div>
                  <div><label className="field-label" htmlFor="duration">Duration</label><div className="select-wrap"><Clock3 size={16} /><select id="duration" value={duration} onChange={e => setDuration(e.target.value)}><option value="5">5 seconds</option><option value="10">10 seconds</option></select><ChevronDown size={15} /></div></div>
                  <div className="quality-field"><label className="field-label" htmlFor="quality">Resolution</label><div className="select-wrap"><Film size={16} /><select id="quality" value={quality} onChange={e => setQuality(e.target.value)}><option value="720p">720p · HD</option></select><ChevronDown size={15} /></div></div>
                </div>
              </div>

              {error && <div className="error-message" role="alert"><X size={16} /><span>{error}</span></div>}
              <button className="generate-button" onClick={generate} disabled={busy}>
                {busy ? <span className="spinner" /> : <Sparkles size={18} />}
                {busy ? 'Creating your video…' : 'Generate video'}
                {!busy && <ArrowRight size={18} />}
              </button>
              <p className="generation-note">AI generations may take a few minutes. Only upload media you have permission to use.</p>
            </section>

            <aside className="preview-column">
              <div className="preview-header"><div><h2>Live preview</h2><p>Your creative direction, at a glance.</p></div><span className="preview-live"><span /> LIVE</span></div>
              <div className={'preview-stage ratio-' + aspect.replace(':', '-')}>
                {resultUrl ? (
                  <video className="result-video" src={resultUrl} controls playsInline />
                ) : imageUrl ? (
                  <><img className="preview-image" src={imageUrl} alt="Preview of source image" /><div className="preview-image-shade" /><div className="preview-caption"><span className="caption-kicker"><Sparkles size={13} /> YOUR SOURCE IMAGE</span><strong>{scene || 'Your scene, brought to life'}</strong><p>{prompt || 'Add a prompt to describe the movement and mood.'}</p></div></>
                ) : (
                  <div className="empty-preview">
                    <div className="preview-glow glow-one" /><div className="preview-glow glow-two" />
                    <div className="preview-placeholder-art"><div className="placeholder-sun" /><div className="placeholder-hill hill-one" /><div className="placeholder-hill hill-two" /><div className="placeholder-person"><span /></div><div className="placeholder-ground" /></div>
                    <div className="empty-preview-copy"><span className="empty-icon"><Play size={17} fill="currentColor" /></span><strong>Your next scene starts here</strong><span>Upload an image to see your preview</span></div>
                  </div>
                )}
                {busy && <div className="rendering-overlay"><div className="rendering-ring"><Sparkles size={20} /></div><strong>Bringing your scene to life</strong><span>{status}</span><div className="rendering-progress"><span /></div></div>}
                {resultUrl && !busy && <div className="result-label"><Check size={14} /> GENERATION COMPLETE</div>}
              </div>
              <div className="preview-meta">
                <div className="meta-item"><span>STYLE</span><strong>{templates.find(t => t.id === template)?.name}</strong></div>
                <div className="meta-item"><span>FORMAT</span><strong>{aspect}</strong></div>
                <div className="meta-item"><span>LENGTH</span><strong>{duration}s</strong></div>
              </div>
              {resultUrl ? <a className="download-button" href={resultUrl} target="_blank" rel="noreferrer"><ArrowDownToLine size={16} /> Open or download video</a> : <div className="preview-hint"><div className="hint-icon"><WandSparkles size={17} /></div><div><strong>Realism is in the details</strong><p>Natural body language, consistent lighting, subtle camera movement, and specific scene details help create more believable results.</p></div></div>}
              <div className="privacy-note"><span className="privacy-check"><Check size={13} /></span><span><strong>Your creative work matters.</strong><br />Use consented images and keep API credentials on the server.</span></div>
            </aside>
          </div>
          <footer className="page-footer"><span>© 2026 Si'ifan Studio</span><span>Made for creators who care about the details <Sparkles size={13} /></span></footer>
        </div>
      </main>
    </div>
  );
}