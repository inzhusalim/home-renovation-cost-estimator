import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, Armchair, Bath, Bookmark, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, CookingPot, Diamond, FileCheck2, Hammer, History, House, Info, Layers3, Lightbulb, Mail, MapPin, Plus, Printer, RotateCcw, Ruler, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { ADDONS, DEFAULT_CONFIG, MODEL_VERSION, REGIONS, ROOMS, TIERS, calculate, clampArea, factorLabel, money, number, readConfig, readHistory, summaryText, type AddonId, type Config, type SavedEstimate } from './estimate';

const roomIcons = { kitchen: CookingPot, bath: Bath, living: Armchair, basement: Layers3, home: House };
const addonIcons = { permits: FileCheck2, cabinetry: Layers3, demolition: Hammer, smart: Zap };
type ModalKind = 'history' | 'save' | 'share' | 'guide' | 'assumptions' | null;
type Contact = { name: string; email: string; zip: string; contractor: string };

function Dialog({ title, children, onClose, drawer = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input, button')?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return <div className={`overlay ${drawer ? 'drawer-overlay' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className={`dialog ${drawer ? 'drawer' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
      <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>
      {children}
    </div>
  </div>;
}

function SectionLabel({ step, title, children }: { step: string; title: string; children?: ReactNode }) {
  return <div className="section-label"><div className="flex items-center gap-2.5"><span className="step-number">{step}</span><h3>{title}</h3></div>{children}</div>;
}

export default function App() {
  const [config, setConfig] = useState<Config>(readConfig);
  const [history, setHistory] = useState<SavedEstimate[]>(readHistory);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [areaInput, setAreaInput] = useState(String(config.sqft));
  const [projectName, setProjectName] = useState('');
  const [activeCost, setActiveCost] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({ name: '', email: '', zip: '', contractor: '' });
  const [draftReady, setDraftReady] = useState(false);
  const result = useMemo(() => calculate(config), [config]);
  const activeItem = result.items.find(x => x.id === activeCost);
  const areaStyle = { '--range-progress': `${(config.sqft - 100) / 2900 * 100}%` } as CSSProperties;

  useEffect(() => { try { localStorage.setItem('reno.current.v1', JSON.stringify(config)); setStorageAvailable(true); } catch { setStorageAvailable(false); } }, [config]);
  useEffect(() => { setAreaInput(String(config.sqft)); }, [config.sqft]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 4500); return () => window.clearTimeout(timer); }, [toast]);

  function toggleAddon(id: AddonId) { setConfig(previous => ({ ...previous, addons: { ...previous.addons, [id]: !previous.addons[id] } })); }
  function persistHistory(next: SavedEstimate[]) {
    setHistory(next);
    try { localStorage.setItem('reno.history.v1', JSON.stringify(next)); setStorageAvailable(true); return true; }
    catch { setStorageAvailable(false); return false; }
  }
  function saveEstimate(event: FormEvent) {
    event.preventDefault();
    const saved: SavedEstimate = { id: crypto.randomUUID(), name: projectName.trim() || `${result.room.name} renovation`, createdAt: new Date().toISOString(), config: structuredClone(config), total: result.total, low: result.low, high: result.high, modelVersion: MODEL_VERSION };
    const persisted = persistHistory([saved, ...history].slice(0, 50));
    setModal(null);
    setToast(persisted ? 'Estimate saved. Find it in Saved estimates.' : 'Saved for this session. Browser storage is unavailable.');
  }
  function restoreEstimate(saved: SavedEstimate) { setConfig(structuredClone(saved.config)); setActiveCost(null); setModal(null); setToast(`${saved.name} loaded.`); }
  function downloadSummary() {
    const blob = new Blob([summaryText(config, contact.name ? contact : undefined)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `reno-${config.room}-estimate.txt`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const draftUrl = `mailto:${encodeURIComponent(contact.contractor.trim())}?subject=${encodeURIComponent(`${contact.name}'s ${result.room.name.toLowerCase()} renovation estimate`)}&body=${encodeURIComponent(`Hi,\n\nI'd like to discuss this renovation project. Here is my preliminary, itemized estimate.\n\n${summaryText(config, contact)}\n\nPlease let me know your availability and any adjustments to the scope.\n\nThank you,\n${contact.name}`)}`;

  return <>
    <div className="site-shell" inert={modal !== null}>
      <header className="header print-hide">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Reno home" onClick={event => event.preventDefault()}><span className="brand-mark"><House size={21} strokeWidth={2} /></span>reno<span className="brand-period">.</span></a>
          <nav aria-label="Main navigation" className="main-nav">
            <button className="nav-link active" aria-current="page"><SlidersHorizontal size={15} />Cost estimator</button>
            <button className="nav-link" onClick={() => setModal('history')}><Bookmark size={15} />Saved estimates{history.length > 0 && <span className="nav-count">{history.length}</span>}</button>
            <button className="nav-link" onClick={() => setModal('guide')}>How it works<ChevronRight size={13} /></button>
          </nav>
          <div className="header-end"><span className="header-country"><span aria-hidden="true">🇺🇸</span> Built for US homes</span><button className="icon-button help-button" aria-label="Estimator help" onClick={() => setModal('guide')}><CircleHelp size={19} /></button></div>
        </div>
      </header>

      <main className="main-container print-hide">
        <div className="intro">
          <div><div className="eyebrow"><span className="eyebrow-line" />A LITTLE PLANNING. A LOT OF POSSIBILITY.</div><h1>Your dream home.<br className="mobile-break" /> A clearer budget.</h1><p>Explore the possibilities. Get a real-time estimate. Renovate with confidence.</p></div>
          <div className="intro-note"><span className="intro-note-icon"><ShieldCheck size={21} /></span><div>Good decisions start here.<span>Transparent estimates. No surprises.</span></div></div>
        </div>

        <div className="workspace-grid">
          <div className="config-column">
            <section className="card project-card" aria-labelledby="project-heading">
              <div className="card-heading"><div><h2 id="project-heading">Let’s build your project</h2><p>A few details. A budget that fits your vision.</p></div><span className="card-heading-icon"><SlidersHorizontal size={19} /></span></div>

              <div className="project-section room-section">
                <SectionLabel step="01" title="What space are you renovating?" />
                <div className="room-options" role="group" aria-label="Room selection">
                  {ROOMS.map(room => { const Icon = roomIcons[room.id]; return <button key={room.id} className={`room-option ${config.room === room.id ? 'selected' : ''}`} aria-pressed={config.room === room.id} onClick={() => setConfig(previous => ({ ...previous, room: room.id }))}><Icon size={25} strokeWidth={1.6} /><span>{room.name}</span>{config.room === room.id && <span className="room-check"><Check size={10} strokeWidth={3} /></span>}</button>; })}
                </div>
              </div>

              <div className="project-section area-section">
                <SectionLabel step="02" title="How much room to reimagine?"><span className="subtle-label">Square footage</span></SectionLabel>
                <div className="area-control"><div className="area-copy"><Ruler size={18} /><span>Approximate project area</span></div><div className="area-field"><input aria-label="Project square footage" type="number" min="100" max="3000" step="1" value={areaInput} onChange={event => { const value = event.target.value; setAreaInput(value); if (value && Number(value) >= 100 && Number(value) <= 3000) setConfig(previous => ({ ...previous, sqft: Math.round(Number(value)) })); }} onBlur={() => { const next = clampArea(areaInput ? Number(areaInput) : config.sqft); setConfig(previous => ({ ...previous, sqft: next })); setAreaInput(String(next)); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>sq ft</span></div></div>
                <input className="area-slider" aria-label="Square footage slider" type="range" min="100" max="3000" step="10" value={config.sqft} style={areaStyle} onChange={event => setConfig(previous => ({ ...previous, sqft: Number(event.target.value) }))} />
                <div className="range-labels"><span>100 sq ft</span><span>3,000 sq ft</span></div>
              </div>

              <div className="project-section tier-section">
                <SectionLabel step="03" title="Find your finishing touch" />
                <div className="tier-options" role="group" aria-label="Finish quality tier">
                  {TIERS.map((tier, index) => { const Icon = [House, Sparkles, Diamond][index]; return <button key={tier.id} className={`tier-option ${config.tier === tier.id ? 'selected' : ''}`} aria-pressed={config.tier === tier.id} onClick={() => setConfig(previous => ({ ...previous, tier: tier.id }))}>{tier.id === 'standard' && <span className="popular-label">THE SWEET SPOT</span>}<div className="tier-top"><Icon size={19} strokeWidth={1.6} /><span className="radio-circle">{config.tier === tier.id && <span />}</span></div><strong>{tier.name}</strong><span className="tier-description">{tier.label}</span></button>; })}
                </div>
              </div>

              <div className="project-section extras-section">
                <SectionLabel step="+" title="The little extras"><span className="subtle-label">Optional add-ons</span></SectionLabel>
                <div className="addon-options">
                  {ADDONS.map(addon => { const Icon = addonIcons[addon.id]; return <button key={addon.id} className={`addon-option ${config.addons[addon.id] ? 'enabled' : ''}`} role="switch" aria-checked={config.addons[addon.id]} aria-label={`${addon.name}, ${money(addon.cost)}`} onClick={() => toggleAddon(addon.id)}><Icon className="addon-icon" size={18} strokeWidth={1.65} /><span className="addon-copy"><strong>{addon.name}</strong><span>+ {money(addon.cost)}</span></span><span className="toggle" aria-hidden="true"><span>{config.addons[addon.id] && <Check size={9} strokeWidth={3} />}</span></span></button>; })}
                </div>
                <p className="addon-footnote"><Info size={12} />Add-on costs are included in the breakdown, so nothing is counted twice.</p>
              </div>
            </section>

            <section className="region-card" aria-labelledby="region-heading"><span className="region-icon"><MapPin size={20} /></span><div className="region-copy"><h3 id="region-heading">Location makes a difference</h3><p>Adjust your labor estimate to your local market.</p></div><div className="region-select"><label className="sr-only" htmlFor="region">Regional cost index</label><select id="region" value={config.region} onChange={event => setConfig(previous => ({ ...previous, region: event.target.value as Config['region'] }))}>{REGIONS.map(region => <option value={region.id} key={region.id}>{region.name} · {factorLabel(region.factor)}</option>)}</select><ChevronDown size={15} /></div></section>
          </div>

          <aside className="estimate-column" aria-label="Live renovation estimate">
            <section className="estimate-card">
              <div className="total-panel"><div className="total-top"><span><ClipboardList size={15} />YOUR ESTIMATED BUDGET</span><span className="live-badge"><span />Live</span></div><p className="estimate-project">{result.room.name} <span>·</span> {number(config.sqft)} sq ft <span>·</span> {result.tier.name}</p><div className={`estimate-range ${result.high >= 100000 ? 'range-large' : ''}`} aria-live="polite" aria-atomic="true"><span className="sr-only">Estimated range: </span>{money(result.low)}<span className="range-dash">–</span>{money(result.high)}</div><div className="estimate-subline"><span>Estimated range, including contingency</span><span>USD</span></div><div className="total-bottom"><span><Ruler size={13} />{money(Math.round(result.total / config.sqft))} / sq ft</span><span><MapPin size={12} />{result.region.name}</span></div><span className="total-decoration" aria-hidden="true" /></div>
              <div className="breakdown-panel"><div className="breakdown-heading"><h3>Every dollar, explained.</h3><button className="icon-button" aria-label="View calculation assumptions" onClick={() => setModal('assumptions')}><Info size={15} /></button></div>
                <div className="cost-bar" aria-label="Interactive cost distribution">{result.items.filter(item => item.value > 0).map(item => <button key={item.id} style={{ flexGrow: item.value, background: item.color }} className={activeCost === item.id ? 'bar-active' : ''} aria-label={`${item.label}: ${money(item.value)}, ${(item.value / result.total * 100).toFixed(1)} percent`} aria-pressed={activeCost === item.id} onClick={() => setActiveCost(previous => previous === item.id ? null : item.id)} title={`${item.label} · ${money(item.value)}`} />)}</div>
                <div className={`chart-hint ${activeItem ? 'has-active' : ''}`}>{activeItem ? <><span className="legend-dot" style={{ background: activeItem.color }} /><strong>{activeItem.label}</strong><span>{(activeItem.value / result.total * 100).toFixed(1)}% of your budget</span></> : <><span>Click a segment to explore your budget</span><ArrowRight size={12} /></>}</div>
                <div className="breakdown-items">{result.items.map(item => <button key={item.id} className={`breakdown-row ${activeCost === item.id ? 'row-active' : ''}`} onClick={() => setActiveCost(previous => previous === item.id ? null : item.id)} aria-pressed={activeCost === item.id}><span className="legend-dot" style={{ background: item.color }} /><span className="breakdown-copy"><span>{item.label}{item.id === 'overhead' && <small>18%</small>}{item.id === 'contingency' && <small>10%</small>}</span><span className="cost-description">{item.description}</span></span><strong>{money(item.value)}</strong></button>)}</div>
                <div className="planning-total"><span>Project planning total</span><strong>{money(result.total)}</strong></div>
                <div className="estimate-actions"><button className="button button-primary w-full" onClick={() => { setProjectName(`${result.room.name} renovation`); setModal('save'); }}><Bookmark size={16} />Save estimate<Plus size={16} className="ml-auto" /></button><button className="button button-outline w-full" onClick={() => window.print()}><Printer size={16} />Print / export summary<ArrowDownToLine size={15} className="ml-auto" /></button></div>
                <p className="browser-note"><ShieldCheck size={12} />{storageAvailable ? 'Your projects stay private in this browser.' : 'Browser storage is unavailable. Saves last for this session.'}</p>
              </div>
            </section>
            <button className="contractor-card" onClick={() => { setDraftReady(false); setModal('share'); }}><span className="contractor-icon"><Mail size={20} strokeWidth={1.6} /></span><span><strong>Make the next step easier.</strong><span>Send this estimate to my contractor</span></span><ArrowRight size={18} /></button>
          </aside>
        </div>

        <section className="inspiration-banner"><div className="inspiration-photo" role="img" aria-label="Renovated kitchen with white cabinets, marble surfaces, and warm wood accents" /><div className="inspiration-content"><span className="inspiration-eyebrow"><Lightbulb size={14} />A LITTLE RENOVATION WISDOM</span><h3>Leave a little room for the unexpected.</h3><p>Great projects start with a realistic plan. We’ve already included a 10% contingency<br className="desktop-break" /> in your estimate, so you can focus on making your space your own.</p></div><button className="learn-button" onClick={() => setModal('assumptions')}>Behind the numbers<ArrowUpRightIcon /></button></section>
        <div className="estimate-disclaimer"><Info size={14} /><p>A starting point for your plans, not a final quote. Estimates use illustrative planning rates. Actual costs depend on your home, scope, and contractor.<button onClick={() => setModal('assumptions')}>View assumptions</button></p></div>
      </main>
      <footer className="footer print-hide"><div className="footer-inner"><span className="footer-brand">reno<span>.</span></span><span>Thoughtful planning. Better spaces.</span><span className="footer-right">Made for the way you live.<span>USD · sq ft</span></span></div></footer>

      <section className="print-summary" aria-label="Printable estimate"><div className="print-brand">reno.</div><h1>Home Remodel & Renovation Cost Estimate</h1><p>Prepared {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p><div className="print-meta"><span>Project: <strong>{result.room.name}</strong></span><span>Area: <strong>{number(config.sqft)} sq ft</strong></span><span>Finish: <strong>{result.tier.name}</strong></span><span>Region: <strong>{result.region.name} · {factorLabel(result.region.factor)}</strong></span></div><div className="print-total">Estimated range: {money(result.low)} – {money(result.high)}</div><table><thead><tr><th>Cost category</th><th>Basis</th><th>Estimate</th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td>{item.label}</td><td>{item.description}</td><td>{money(item.value)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Project planning total</th><th>{money(result.total)}</th></tr></tfoot></table><h2>Selected add-ons</h2>{result.selectedAddons.length ? result.selectedAddons.map(addon => <p key={addon.id}>{addon.name} — {money(addon.cost)} (included in categories above)</p>) : <p>No add-ons selected.</p>}<h2>Calculation assumptions</h2><p>Base rates: {money(result.room.materialRate)} in materials + {money(result.room.laborRate)} in labor per sq ft. Finish multiplier: {factorLabel(result.tier.factor)}. Regional multiplier applies to base labor only. Add-ons are fixed allowances. Overhead and profit: 18% of direct costs. Contingency: 10% of direct costs plus overhead. Range: 90–108% of the planning total, rounded outward to $100.</p><p className="print-fine">This preliminary estimate uses illustrative planning rates and is not a contractor quote. Site conditions, structural work, sales taxes, appliances, and local permit fees may change the final cost. Confirm your scope and budget with a licensed local contractor.</p></section>
    </div>

    {modal === 'save' && <Dialog title="A plan worth keeping." onClose={() => setModal(null)}><p className="dialog-description">Save a snapshot of this project. You can pick up where you left off, or compare a different finish.</p><div className="modal-estimate"><span>{result.room.name} · {number(config.sqft)} sq ft · {result.tier.name}</span><strong>{money(result.low)} – {money(result.high)}</strong></div><form onSubmit={saveEstimate}><label className="form-label" htmlFor="project-name">Project name</label><input className="form-input" id="project-name" value={projectName} onChange={event => setProjectName(event.target.value)} autoComplete="off" maxLength={80} required /><button className="button button-primary w-full modal-submit" type="submit"><Bookmark size={17} />Save estimate</button></form><p className="dialog-footnote"><ShieldCheck size={13} />Saved locally in this browser. No account needed.</p></Dialog>}

    {modal === 'history' && <Dialog title="Your saved estimates" drawer onClose={() => setModal(null)}><p className="dialog-description">Good ideas, kept in one place. Load a project to keep planning.</p><div className="history-count"><History size={14} />{history.length} saved {history.length === 1 ? 'project' : 'projects'}<span>Stored in this browser</span></div><div className="history-list">{history.length ? history.map(saved => { const savedRoom = ROOMS.find(x => x.id === saved.config.room)!; const SavedIcon = roomIcons[saved.config.room]; return <article className="history-card" key={saved.id}><div className="history-card-top"><span className="history-icon"><SavedIcon size={21} /></span><div><h3>{saved.name}</h3><p>{new Date(saved.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div><button className="icon-button delete-button" aria-label={`Delete ${saved.name}`} onClick={() => { const persisted = persistHistory(history.filter(x => x.id !== saved.id)); setToast(persisted ? 'Estimate removed.' : 'Removed for this session. Browser storage is unavailable.'); }}><Trash2 size={16} /></button></div><p className="history-specs">{savedRoom.name} · {number(saved.config.sqft)} sq ft · {TIERS.find(x => x.id === saved.config.tier)?.name}</p><strong className="history-price">{money(saved.low)} – {money(saved.high)}</strong><button className="button button-outline w-full" onClick={() => restoreEstimate(saved)}>Load this estimate<ArrowRight size={15} /></button></article>; }) : <div className="empty-history"><span><Bookmark size={32} strokeWidth={1.3} /></span><h3>Your next chapter starts here.</h3><p>Configure a project and select “Save estimate” to keep it for later.</p><button className="button button-primary" onClick={() => setModal(null)}>Start planning<ArrowRight size={16} /></button></div>}</div><p className="drawer-footer"><Info size={13} />Save up to 50 projects. Clearing your browser data removes saved estimates.</p></Dialog>}

    {modal === 'share' && <Dialog title={draftReady ? 'Ready for the next conversation.' : 'Send to your contractor'} onClose={() => setModal(null)}>{draftReady ? <div className="share-success"><span className="success-icon"><CheckCircle2 size={30} /></span><p>Your itemized estimate is ready, {contact.name.split(' ')[0]}. Open the draft in your email app, review it, and send when you’re ready.</p><div className="modal-estimate"><span>{result.room.name} · {number(config.sqft)} sq ft</span><strong>{money(result.low)} – {money(result.high)}</strong></div><a className="button button-primary w-full" href={draftUrl}><Mail size={17} />Open email draft<ArrowRight size={17} /></a><button className="button button-outline w-full mt-3" onClick={downloadSummary}><ArrowDownToLine size={16} />Download itemized summary</button><p className="dialog-footnote">Your email app handles delivery. Nothing has been sent yet.</p></div> : <><p className="dialog-description">Turn your plan into a conversation. We’ll prepare an itemized email draft for you to review and send.</p><div className="modal-estimate"><span>{result.room.name} · {number(config.sqft)} sq ft · {result.tier.name}</span><strong>{money(result.low)} – {money(result.high)}</strong></div><form onSubmit={event => { event.preventDefault(); setContact(previous => ({ ...previous, name: previous.name.trim(), email: previous.email.trim(), contractor: previous.contractor.trim(), zip: previous.zip.trim() })); setDraftReady(true); }}><label className="form-label" htmlFor="contact-name">Your name</label><input id="contact-name" className="form-input" placeholder="e.g. Alex Johnson" autoComplete="name" pattern={".*\\S.*"} title="Enter your name." minLength={2} maxLength={80} required value={contact.name} onChange={event => setContact(previous => ({ ...previous, name: event.target.value }))} /><div className="form-grid"><div><label className="form-label" htmlFor="contact-email">Email address</label><input id="contact-email" className="form-input" placeholder="alex@example.com" type="email" autoComplete="email" required maxLength={254} value={contact.email} onChange={event => setContact(previous => ({ ...previous, email: event.target.value }))} /></div><div><label className="form-label" htmlFor="contact-zip">US ZIP code</label><input id="contact-zip" className="form-input" placeholder="10001" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a 5-digit US ZIP code, optionally followed by a 4-digit extension." maxLength={10} required value={contact.zip} onChange={event => setContact(previous => ({ ...previous, zip: event.target.value }))} /></div></div><label className="form-label" htmlFor="contractor-email">Contractor’s email <span>(optional)</span></label><input id="contractor-email" className="form-input" type="email" placeholder="Add now, or choose in your email app" maxLength={254} value={contact.contractor} onChange={event => setContact(previous => ({ ...previous, contractor: event.target.value }))} /><button className="button button-primary w-full modal-submit" type="submit"><Mail size={17} />Create email draft<ArrowRight size={17} /></button></form><p className="dialog-footnote"><ShieldCheck size={13} />Your details are used only to prepare this draft.</p></>}</Dialog>}

    {(modal === 'guide' || modal === 'assumptions') && <Dialog title={modal === 'guide' ? 'A clearer path to your remodel.' : 'Behind the numbers'} onClose={() => setModal(null)}>{modal === 'guide' ? <><p className="dialog-description">Reno helps homeowners and contractors start with the same picture of the project.</p><div className="guide-steps"><div><span>01</span><div><h3>Make it yours</h3><p>Select your space, area, finish, and extras. Choose the regional labor index closest to your market.</p></div></div><div><span>02</span><div><h3>See the whole budget</h3><p>Explore materials, labor, permits, overhead, and contingency. Click any segment of the cost bar for its share.</p></div></div><div><span>03</span><div><h3>Take the next step</h3><p>Save your estimate, print a PDF using your browser, or prepare an email draft for your contractor.</p></div></div></div><button className="button button-primary w-full" onClick={() => setModal(null)}>Let’s plan your project<ArrowRight size={16} /></button></> : <><p className="dialog-description">A transparent planning model, with every allowance visible. These are illustrative rates, rather than live market quotes.</p><div className="assumption-grid"><div><span>Materials / sq ft</span><strong>{money(result.room.materialRate)}</strong></div><div><span>Base labor / sq ft</span><strong>{money(result.room.laborRate)}</strong></div><div><span>Finish multiplier</span><strong>{factorLabel(result.tier.factor)}</strong></div><div><span>Regional labor index</span><strong>{factorLabel(result.region.factor)}</strong></div></div><div className="assumptions-copy"><h3>How your budget is calculated</h3><p>Materials = area × material rate × finish multiplier, plus cabinetry if selected. Labor = area × labor rate × finish multiplier × regional index, plus demolition and smart wiring if selected.</p><p>Add-ons use the fixed national allowances shown in the configurator. Permit handling is shown separately. The regional index adjusts base labor only.</p><p><strong>Overhead & profit:</strong> 18% of materials, labor, and permit handling. <strong>Contingency:</strong> 10% of that subtotal plus overhead.</p><p><strong>Your range:</strong> 90–108% of the planning total, rounded outward to the nearest $100. This is a planning allowance, not a statistical confidence interval.</p><h3>Confirm the details locally</h3><p>Structural changes, site conditions, appliances, sales taxes, and actual municipal permit fees are outside the base model. Custom cabinetry is an upgrade allowance on top of the base finish package. Review inclusions and obtain local contractor quotes before committing.</p></div><button className="button button-outline w-full" onClick={() => { setConfig(structuredClone(DEFAULT_CONFIG)); setActiveCost(null); setModal(null); setToast('Project reset to the starting estimate.'); }}><RotateCcw size={15} />Reset to the starting estimate</button></>}</Dialog>}
    {toast && <div className="toast print-hide" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </>;
}

function ArrowUpRightIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
