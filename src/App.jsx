import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Activity, Ambulance, ArrowRight, Bell, Check, CheckCircle2, Clock3, Cross,
  Hospital, LocateFixed, MapPin, Menu, Navigation, Phone, ShieldCheck, Siren,
  Stethoscope, X, BrainCircuit, LayoutDashboard, Paperclip, MessageSquare,
  FileText, Users, AlertTriangle, LogOut, ChevronRight
} from "lucide-react";

const initialHospitals = [
  { name: "CityCare Hospital", area: "Indiranagar", distance: "4.2 km", eta: "9 min", beds: "18/50", icu: "4/12", capacity: "High", specialties: ["Trauma", "Neuro", "Cardiac"], coords: [12.9784, 77.6408] },
  { name: "St. Marian Medical Centre", area: "Koramangala", distance: "6.1 km", eta: "13 min", beds: "25/80", icu: "2/20", capacity: "Medium", specialties: ["Trauma", "Ortho"], coords: [12.9352, 77.6245] },
  { name: "Northline Multispeciality", area: "Hebbal", distance: "8.7 km", eta: "18 min", beds: "41/120", icu: "9/24", capacity: "High", specialties: ["Cardiac", "Burns", "Trauma"], coords: [13.0358, 77.5970] },
  { name: "Lakeview General Hospital", area: "Jayanagar", distance: "11.4 km", eta: "24 min", beds: "6/60", icu: "1/10", capacity: "Low", specialties: ["General", "Ortho"], coords: [12.9250, 77.5838] }
];
const initialAmbulances = [
  { unit: "AMB-101", vehicle: "KA-01-AE-4417", driver: "Ravi Kulkarni", type: "Advanced Life Support", area: "Indiranagar", eta: "6 min", status: "Available", coords: [12.9718, 77.6412] },
  { unit: "AMB-102", vehicle: "KA-05-BC-9021", driver: "Sneha Rao", type: "Trauma Unit", area: "Koramangala", eta: "9 min", status: "Available", coords: [12.9352, 77.6245] },
  { unit: "AMB-103", vehicle: "KA-03-KD-1180", driver: "Imran Sheikh", type: "Basic Life Support", area: "Whitefield", eta: "8 min", status: "Busy", coords: [12.9698, 77.7500] },
  { unit: "AMB-104", vehicle: "KA-09-PL-3356", driver: "Meera Nair", type: "Advanced Life Support", area: "Jayanagar", eta: "14 min", status: "Available", coords: [12.9250, 77.5838] },
  { unit: "AMB-105", vehicle: "KA-02-XT-7742", driver: "Arun Prasad", type: "Basic Life Support", area: "Hebbal", eta: "19 min", status: "Offline", coords: [13.0358, 77.5970] }
];
const timelineSteps = ["Emergency reported", "Location detected", "Severity assessed", "Ambulance assigned", "Ambulance arrived", "Patient picked up", "Hospital notified", "Patient arrived", "Emergency resolved"];
const makeIcon = (emoji, color) => L.divIcon({ className: "map-marker-wrap", html: `<div class="map-marker ${color}">${emoji}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
const incidentIcon = makeIcon("!", "marker-red");
const ambulanceIcon = makeIcon("＋", "marker-blue");
const hospitalIcon = makeIcon("H", "marker-green");

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [["Home", "/"], ["How It Works", "/how-it-works"], ["Emergency", "/emergency"], ["Hospitals", "/hospitals"], ["Ambulances", "/ambulances"], ["About", "/about"], ["Contact", "/contact"]];
  return <header className="topbar">
    <div className="nav-inner">
      <Link to="/" className="brand" onClick={() => setMenuOpen(false)}><span className="brand-mark"><Cross size={17} strokeWidth={3}/><Activity size={17}/></span><span>ResQ<span className="brand-red">Link</span></span></Link>
      <button className="mobile-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button>
      <nav className={menuOpen ? "nav-links open" : "nav-links"}>{nav.map(([label, path]) => <NavLink key={path} to={path} end={path === "/"} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}</nav>
      <div className="nav-actions"><Link className="login-link" to="/login">Login</Link><Link className="btn btn-outline btn-small" to="/register">Register</Link><Link className="btn btn-danger btn-small" to="/emergency"><Siren size={17}/> Emergency SOS</Link></div>
    </div>
  </header>;
}
function Footer() {
  return <footer className="footer"><div className="footer-grid"><div><Link to="/" className="brand footer-brand"><span className="brand-mark"><Cross size={17}/><Activity size={17}/></span><span>ResQ<span className="brand-red">Link</span></span></Link><p>Connecting Every Second to Safety. An academic prototype coordinating emergency reports, ambulances and hospitals in one system.</p></div><div><h4>PLATFORM</h4><Link to="/about">About</Link><Link to="/how-it-works">How It Works</Link><Link to="/emergency">Emergency</Link><Link to="/contact">Contact</Link></div><div><h4>PORTALS</h4><Link to="/login">Patient portal</Link><Link to="/login">Ambulance portal</Link><Link to="/login">Hospital portal</Link><Link to="/login">Admin command center</Link></div></div><div className="footer-note">ResQLink is an academic prototype, not a real emergency service. In a real emergency, call your local emergency number.</div></footer>;
}
function PageShell({ children, footer = true }) { return <><Header/><main>{children}</main>{footer && <Footer/>}</>; }
function SectionTitle({ title, subtitle, children }) { return <div className="section-title"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{children}</div>; }

function DemoMap({ incident, ambulance, hospital, moving = false }) {
  const [position, setPosition] = useState(ambulance || [12.9718, 77.6412]);
  const [tick, setTick] = useState(0);
  const target = incident || [12.9650, 77.6100];
  const destination = hospital?.coords || [12.9784, 77.6408];
  useEffect(() => {
    setPosition(ambulance || [12.9718, 77.6412]);
  }, [ambulance?.[0], ambulance?.[1]]);
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => {
      setTick(t => {
        const next = (t + 1) % 7;
        setPosition(prev => {
          const goal = next < 4 ? target : destination;
          return [prev[0] + (goal[0] - prev[0]) * 0.22, prev[1] + (goal[1] - prev[1]) * 0.22];
        });
        return next;
      });
    }, 3500);
    return () => clearInterval(id);
  }, [moving, target[0], target[1], destination[0], destination[1]]);
  const route = useMemo(() => [position, [(position[0]+target[0])/2 + 0.002, (position[1]+target[1])/2], target], [position, target[0], target[1]]);
  return <div className="map-box">
    <MapContainer center={target} zoom={12} scrollWheelZoom={false} className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Marker position={target} icon={incidentIcon}><Popup>Emergency location</Popup></Marker>
      <Marker position={position} icon={ambulanceIcon}><Popup>Ambulance · {moving ? "Demo movement" : "Last known position"}</Popup></Marker>
      <Marker position={destination} icon={hospitalIcon}><Popup>{hospital?.name || "Recommended hospital"}</Popup></Marker>
      <Polyline positions={route} pathOptions={{ color: "#2864f0", weight: 5, opacity: .85, dashArray: "10 9" }}/>
    </MapContainer>
    <div className="map-legend"><span><i className="dot red-dot"/> Emergency</span><span><i className="dot blue-dot"/> Ambulance</span><span><i className="dot green-dot"/> Hospital</span></div>
    {moving && <span className="map-demo-tag"><span className="live-pulse"/> DEMO TRACKING</span>}
  </div>;
}
function Home({ startSOS }) {
  return <PageShell><section className="hero container"><div className="hero-copy"><span className="eyebrow"><Activity size={16}/> DETECT. RESPOND. RESCUE.</span><h1>When Every Second Matters, <span>ResQLink</span> Connects You to Help.</h1><p>An intelligent emergency-response platform connecting accident victims, ambulances and hospitals through one coordinated system.</p><div className="hero-actions"><button className="btn btn-danger btn-large" onClick={startSOS}><Siren/> Report Emergency</button><Link className="btn btn-white btn-large" to="/how-it-works">Explore ResQLink <ArrowRight size={18}/></Link></div><div className="prototype-note"><ShieldCheck size={17}/> Academic prototype — not a replacement for real emergency services.</div></div><div className="hero-visual"><div className="fake-map"><div className="map-road road-a"/><div className="map-road road-b"/><div className="map-road road-c"/><span className="map-pin pin-accident">!</span><span className="map-label label-accident">Accident</span><span className="map-pin pin-ambulance">＋</span><span className="map-label label-ambulance">Ambulance</span><span className="map-pin pin-hospital">H</span><span className="map-label label-hospital">CityCare Hospital</span><div className="map-route route-one"/><div className="map-route route-two"/><div className="map-info"><strong><i className="dot red-dot"/> EMERGENCY DETECTED</strong><div><span>Ambulance</span><b>Nearest found</b></div><div><span>ETA</span><b className="blue-text">6 min</b></div><div><span>Hospital</span><b className="green-text">Notified</b></div></div><span className="map-demo-tag">DEMO MAP VIEW</span></div></div></section>
    <section className="section section-soft"><div className="container"><SectionTitle title="From Emergency to Care — One Connected Journey" subtitle="Every reported emergency follows the same auditable five-stage path."/><div className="steps-grid">{[["01","Detect","Accident detected or emergency reported."],["02","Locate","Precise location is identified."],["03","Respond","Nearest suitable ambulance is alerted."],["04","Prepare","Best-matched hospital receives an incoming-patient alert."],["05","Rescue","Patient reaches hospital and the emergency record is completed."]].map(s=><article className="step-card" key={s[0]}><b className="step-number">{s[0]}</b><h3>{s[1]}</h3><p>{s[2]}</p></article>)}</div></div></section>
    <section className="section container"><SectionTitle title="Everything Emergency Response Needs"/><div className="feature-grid">{[[Siren,"Smart Accident Detection","Report accidents instantly and optionally analyse accident images with AI assistance."],[MapPin,"Real-Time Location","Capture the accident location and display it on an interactive map view."],[Ambulance,"Smart Ambulance Dispatch","Find and recommend the most suitable available ambulance for the case."],[Hospital,"Intelligent Hospital Matching","Rank hospitals by distance, ETA, capacity and emergency requirements."],[BrainCircuit,"AI-Powered Assistance","Severity estimation and recommendations as decision support for responders."],[LayoutDashboard,"Centralised Command Center","Administrators monitor every live emergency from a single dashboard."]].map(([Icon,title,desc])=><article className="feature-card" key={title}><span className="feature-icon"><Icon size={25}/></span><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
    <section className="container"><div className="cta-panel"><h2>Try the full demo workflow</h2><p>Report an emergency, watch the dispatch engine pick an ambulance and hospital, then follow it across every portal.</p><div className="hero-actions centered"><button className="btn btn-danger btn-large" onClick={startSOS}><Siren size={18}/> Start SOS demo</button><Link className="btn btn-dark-outline btn-large" to="/portal/admin">Open command center</Link></div></div></section></PageShell>;
}
function HowItWorks() {
  return <PageShell><section className="section container"><SectionTitle title="How ResQLink Works" subtitle="One emergency record travels through patient, ambulance, hospital and admin portals — with a timestamped timeline at every stage."/><div className="two-col"><article className="panel"><h2>What happens when SOS is pressed</h2>{["Ask for location permission","Capture GPS, time, patient info, emergency type, injured count, optional image and description","Create an emergency ID (e.g. RQ-2026-10452)","Determine severity","Find available ambulances","Recommend the best ambulance","Recommend the best hospital","Notify the ambulance","Notify the hospital","Share updates with emergency contact"].map((x,i)=><div className="number-row" key={x}><span>{i+1}</span><p>{x}</p></div>)}</article><article className="panel"><h2>Emergency timeline</h2><p className="muted">Every event carries a timestamp.</p><Timeline current={4}/></article></div></section></PageShell>;
}
function Timeline({ current = 0, times = {} }) {
  return <div className="timeline">{timelineSteps.map((s,i)=><div className={`timeline-item ${i <= current ? "complete" : ""}`} key={s}><span className="timeline-check">{i <= current ? <Check size={14}/> : ""}</span><strong>{s}</strong><time>{times[i] || (i <= current ? "Just now" : "—")}</time></div>)}</div>;
}
function EmergencyList({ incidents, startSOS }) {
  return <PageShell><section className="section container"><SectionTitle title="Emergency Reports" subtitle="Every emergency in the system, from first report through hospital admission."><button className="btn btn-danger" onClick={startSOS}>Report an emergency</button></SectionTitle>{incidents.length === 0 ? <div className="empty-state"><Siren size={36}/><h3>No emergency reports yet</h3><p>Start a demo SOS to create your first incident record.</p><button className="btn btn-danger" onClick={startSOS}>Report an emergency</button></div> : <div className="incident-grid">{incidents.map(item=><article className="panel incident-card" key={item.id}><div className="incident-top"><code>{item.id}</code><span className={`pill ${item.severity.toLowerCase()}`}>{item.severity}</span><span className="pill pill-blue">{item.status}</span></div><h3>{item.type}</h3><p className="muted">{item.location} · {item.injured} injured · reported {item.reported}</p><Timeline current={item.stage}/><Link className="text-link" to={`/track/${item.id}`}>View tracking <ArrowRight size={16}/></Link></article>)}</div>}</section></PageShell>;
}
function SOSForm({ onSubmit }) {
  const [form, setForm] = useState({ name:"", phone:"", age:"", blood:"Unknown", conditions:"", type:"Road accident", location:"", severity:"HIGH", injured:"1", description:"", injuries:"Minor cuts / discomfort", road:"Dry / clear", weather:"Clear" });
  const [coords, setCoords] = useState(null);
  const [rating, setRating] = useState(null);
  const [error, setError] = useState("");
  const update = e => setForm({...form, [e.target.name]:e.target.value});
  const getLocation = () => {
    if (!navigator.geolocation) { setError("Location is not available in this browser. Enter a location manually."); return; }
    navigator.geolocation.getCurrentPosition(pos => { setCoords([pos.coords.latitude,pos.coords.longitude]); setForm(f=>({...f,location:`GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`})); setError(""); }, () => setError("Location permission was denied. Please enter the location manually."));
  };
  const assess = () => {
    let score = Number(form.injured || 1) * 12 + (form.severity==="CRITICAL"?55:form.severity==="HIGH"?32:form.severity==="MEDIUM"?18:5);
    if (/fire|smoke|unconscious|bleed/i.test(form.description+" "+form.injuries)) score += 18;
    score = Math.min(100, score);
    setRating({score, level:score>=75?"CRITICAL":score>=50?"HIGH":score>=30?"MEDIUM":"LOW"});
  };
  const submit = e => { e.preventDefault(); if(!form.location.trim() && !coords){setError("Enter a location or use your current location.");return;} onSubmit({...form, coords, rating:rating || {score:22,level:form.severity}, hospital:initialHospitals[0], ambulance:initialAmbulances[0]}); };
  return <PageShell><section className="form-page"><div className="form-heading"><h1><Siren className="red-text"/> Report an Emergency</h1><p>Academic prototype — in a real emergency call your local emergency number.</p></div><form className="panel sos-form" onSubmit={submit}><div className="form-section-label">PATIENT DETAILS</div><div className="form-grid two"><Field label="Patient name" name="name" value={form.name} onChange={update} required/><Field label="Contact number" name="phone" value={form.phone} onChange={update} required type="tel"/><Field label="Age" name="age" value={form.age} onChange={update} type="number"/><label className="field"><span>Blood group</span><select name="blood" value={form.blood} onChange={update}>{["Unknown","A+","A-","B+","B-","AB+","AB-","O+","O-"].map(x=><option key={x}>{x}</option>)}</select></label><Field label="Known conditions / allergies" name="conditions" value={form.conditions} onChange={update} placeholder="Diabetic, on blood thinners..." className="full"/></div><div className="form-section-label with-line">INCIDENT</div><div className="form-grid"><label className="field full"><span>Emergency type</span><select name="type" value={form.type} onChange={update}>{["Road accident","Cardiac emergency","Medical emergency","Fire / burn injury","Fall / fracture","Other"].map(x=><option key={x}>{x}</option>)}</select></label><Field label="Location" name="location" value={form.location} onChange={update} placeholder="Street, landmark or area" className="full"/><div className="full"><button type="button" className="btn btn-outline" onClick={getLocation}><LocateFixed size={17}/> Use my current location</button>{coords&&<span className="location-confirm">GPS location captured</span>}</div><div className="field full"><span>Severity</span><div className="severity-options">{["LOW","MEDIUM","HIGH","CRITICAL"].map(s=><button type="button" className={form.severity===s?`severity-choice selected ${s.toLowerCase()}`:"severity-choice"} onClick={()=>setForm({...form,severity:s})} key={s}>{s}</button>)}</div></div><Field label="People injured" name="injured" value={form.injured} onChange={update} type="number" className="narrow" min="1" required/><label className="field full"><span>Description</span><textarea name="description" value={form.description} onChange={update} rows="3"/></label><Field label="Visible injuries" name="injuries" value={form.injuries} onChange={update}/><label className="field"><span>Road condition</span><select name="road" value={form.road} onChange={update}>{["Dry / clear","Wet","Damaged","Blocked","Unknown"].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Weather</span><select name="weather" value={form.weather} onChange={update}>{["Clear","Rain","Fog","Storm","Unknown"].map(x=><option key={x}>{x}</option>)}</select></label></div><div className="ai-panel"><div className="ai-head"><div><b><BrainCircuit size={17}/> AI SEVERITY ASSESSMENT</b><p>Decision support based on the incident details above.</p></div><button type="button" className="btn btn-outline" onClick={assess}>Use AI rating</button></div><div className="score-row"><strong>{rating?.score ?? 22}<small>/100</small></strong><span>Recommended: {rating?.level || "LOW"} · Demo decision support only</span></div></div>{error&&<p className="form-error">{error}</p>}<button className="btn btn-danger btn-submit" type="submit"><Siren size={18}/> Send SOS</button><p className="form-disclaimer"><ShieldCheck size={15}/> Demo only. This form does not contact real emergency services.</p></form></section></PageShell>;
}
function Field({label,name,value,onChange,placeholder="",type="text",required=false,className="",...props}) { return <label className={`field ${className}`}><span>{label}</span><input name={name} value={value} onChange={onChange} placeholder={placeholder} type={type} required={required} {...props}/></label>; }

function Tracking({ incidents, setIncidents }) {
  const { pathname } = useLocation();
  const id = pathname.split("/").pop();
  const incident = incidents.find(x=>x.id===id) || incidents[0];
  const [currentStage,setCurrentStage] = useState(incident?.stage ?? 3);
  useEffect(()=>{ if(incident) setCurrentStage(incident.stage); },[incident?.id]);
  if(!incident) return <PageShell><section className="section container"><div className="empty-state"><MapPin size={40}/><h2>No active incident to track</h2><p>Submit a demo SOS first to view its tracking screen.</p><Link className="btn btn-danger" to="/emergency">Report emergency</Link></div></section></PageShell>;
  const advance = async () => {
    const next = Math.min(8,currentStage+1);
    const token = localStorage.getItem("resqlinkToken");
    if (!token) { window.alert("Sign in with an ambulance, hospital or admin account to update incident status."); return; }
    try {
      const response = await fetch(`/api/incidents/${incident.id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body:JSON.stringify({stage:next}) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Status update failed");
      setCurrentStage(next); setIncidents(old=>old.map(x=>x.id===incident.id?{...x,...payload,id:incident.id}:x));
    } catch (error) { window.alert(error.message || "Could not update status."); }
  };
  const eta = Math.max(0, 6 - Math.max(0,currentStage-3)*2);
  return <PageShell><section className="section container tracking-page"><div className="tracking-heading"><div><span className="eyebrow"><span className="live-pulse"/> EMERGENCY TRACKING</span><h1>Rescue in progress</h1><p className="muted">Incident <code>{incident.id}</code> · {incident.type} · {incident.location}</p></div><span className={`pill ${incident.severity.toLowerCase()}`}>{incident.severity} PRIORITY</span></div><div className="tracking-stats"><div className="stat-card"><span className="stat-icon"><Ambulance/></span><div><small>Assigned ambulance</small><strong>{incident.ambulance?.unit || "AMB-101"}</strong><span>{incident.ambulance?.driver || "Demo driver"}</span></div></div><div className="stat-card"><span className="stat-icon"><Clock3/></span><div><small>Estimated arrival</small><strong>{currentStage>=4?"Arrived":`${eta} min`}</strong><span>{currentStage>=4?"Ambulance at scene":"Demo estimate"}</span></div></div><div className="stat-card"><span className="stat-icon"><Hospital/></span><div><small>Receiving hospital</small><strong>{incident.hospital?.name || "CityCare Hospital"}</strong><span>{incident.hospital?.area || "Indiranagar"}</span></div></div></div><div className="tracking-grid"><article className="panel tracking-map-panel"><div className="panel-heading"><div><h2>Ambulance location</h2><p>Map updates are simulated in this demo. Live GPS needs a connected ambulance device.</p></div><span className="pill pill-blue"><Navigation size={13}/> {currentStage>=4?"At scene":"En route"}</span></div><DemoMap incident={incident.coords || [12.9650,77.6100]} ambulance={incident.ambulance?.coords} hospital={incident.hospital} moving={currentStage<8}/><div className="map-under-row"><span><i className="dot blue-dot"/> {incident.ambulance?.unit || "AMB-101"} · {incident.ambulance?.vehicle || "Demo vehicle"}</span><span>ETA: {currentStage>=4?"Arrived":`${eta} min`}</span></div></article><article className="panel tracking-timeline-panel"><div className="panel-heading"><div><h2>Rescue timeline</h2><p>Follow each milestone as the incident progresses.</p></div></div><Timeline current={currentStage}/><button className="btn btn-outline btn-block" onClick={advance} disabled={currentStage>=8}>{currentStage>=8?"Emergency resolved":"Advance demo status"} <ChevronRight size={17}/></button><p className="small muted">Use the button to simulate updates from ambulance and hospital portals.</p></article></div><div className="panel incident-detail"><h2>Incident details</h2><div className="detail-grid"><div><small>Patient</small><strong>{incident.name}</strong></div><div><small>Contact</small><strong>{incident.phone}</strong></div><div><small>People injured</small><strong>{incident.injured}</strong></div><div><small>Location</small><strong>{incident.location}</strong></div><div><small>Assigned driver</small><strong>{incident.ambulance?.driver || "Demo driver"}</strong></div><div><small>Hospital</small><strong>{incident.hospital?.name || "CityCare Hospital"}</strong></div></div></div></section></PageShell>;
}
function Hospitals() { return <PageShell><section className="section container"><SectionTitle title="Partner Hospitals" subtitle="Capacity data drives hospital matching for every emergency."/><div className="hospital-grid">{initialHospitals.map(h=><article className="panel hospital-card" key={h.name}><h3>{h.name}</h3><p className="muted">{h.area} · {h.distance} · ETA {h.eta}</p><div className="metric-row"><span>Beds</span><strong>{h.beds}</strong></div><div className="metric-row"><span>ICU</span><strong>{h.icu}</strong></div><div className="metric-row"><span>Emergency capacity</span><strong>{h.capacity}</strong></div><div className="tag-list">{h.specialties.map(t=><span className="tag" key={t}>{t}</span>)}</div></article>)}</div></section></PageShell>; }
function Ambulances() { return <PageShell><section className="section container"><SectionTitle title="Ambulance Fleet" subtitle="Availability, unit type and ETA feed the dispatch scoring engine."/><div className="table-wrap"><table><thead><tr>{["Unit","Vehicle","Driver","Type","Area","ETA","Status"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{initialAmbulances.map(a=><tr key={a.unit}><td><code>{a.unit}</code></td><td>{a.vehicle}</td><td>{a.driver}</td><td>{a.type}</td><td>{a.area}</td><td>{a.eta}</td><td><span className={`pill ${a.status==="Available"?"pill-green":a.status==="Busy"?"pill-blue":"pill-muted"}`}>{a.status}</span></td></tr>)}</tbody></table></div></section></PageShell>; }
function About() { return <PageShell><section className="section container narrow-container"><SectionTitle title="About ResQLink" subtitle="Emergency response loses time in coordination: who is nearest, which hospital can actually take the patient, and who has been told what. ResQLink puts that coordination into one shared record."/><article className="panel"><h2>Safety boundaries</h2><ul className="plain-list"><li>ResQLink is an academic prototype, not a real emergency service.</li><li>AI output is an AI-assisted recommendation, never a medical diagnosis.</li><li>The system does not guarantee ambulance arrival or hospital admission.</li><li>Demo data is used wherever live telemetry or a trained model is unavailable.</li></ul></article><article className="panel"><h2>Modules</h2><div className="module-grid">{[["Emergency core","SOS capture, severity, status machine and timeline."],["Dispatch engine","Ambulance and hospital scoring and assignment."],["Portals","Patient, ambulance, hospital and admin dashboards."],["Analytics & AI","Hotspots, response times and severity models."]].map(([a,b])=><div className="module-box" key={a}><h3>{a}</h3><p>{b}</p></div>)}</div></article></section></PageShell>; }
function Contact() { const [sent,setSent]=useState(false); return <PageShell><section className="form-page contact-page"><SectionTitle title="Contact" subtitle="This form is part of the prototype — it does not reach emergency services. For a real emergency use your local emergency number."/><form className="panel" onSubmit={e=>{e.preventDefault();setSent(true)}}><Field label="Name" name="name" required/><Field label="Email" name="email" type="email" required/><label className="field"><span>Message</span><textarea rows="5" required/></label><button className="btn btn-primary btn-submit">Send message</button>{sent&&<p className="success-message"><CheckCircle2 size={17}/> Demo message submitted locally.</p>}</form></section></PageShell>; }
function AuthPage({ register=false }) { const [role,setRole]=useState("PATIENT"); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const nav=useNavigate(); return <PageShell><section className="auth-page"><div className="auth-heading"><h1>{register?"Create an account":"Login"}</h1><p>{register?"Create a secure account — your account is stored in MongoDB.":"Sign in with your registered account to open its portal."}</p></div><form className="panel auth-card" onSubmit={async e=>{e.preventDefault();setMessage("");try{const response=await fetch(register?"/api/auth/register":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,password,role})});const data=await response.json();if(!response.ok)throw new Error(data.message||"Request failed");localStorage.setItem("resqlinkToken",data.token);localStorage.setItem("resqlinkUser",JSON.stringify(data.user));setMessage(register?"Account created. Opening your portal…":"Signed in. Opening your portal…");setTimeout(()=>nav(data.user.role==="ADMIN"?"/portal/admin":data.user.role==="HOSPITAL"?"/portal/hospital":data.user.role==="AMBULANCE"?"/portal/ambulance":"/portal/patient"),350)}catch(err){setMessage(err.message||"Could not connect to the backend.")}}}>{register&&<Field label="Full name" name="name" value={name} onChange={e=>setName(e.target.value)} required/>}<Field label="Email" name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><Field label="Password" name="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/><label className="field"><span>Role</span><select value={role} onChange={e=>setRole(e.target.value)}>{["PATIENT","AMBULANCE","HOSPITAL","ADMIN"].map(x=><option key={x}>{x}</option>)}</select></label><button className="btn btn-primary btn-submit">{register?"Create account":"Sign in"}</button>{message&&<p className="success-message">{message}</p>}<p className="auth-switch">{register?"Already registered?":"No account?"} <Link to={register?"/login":"/register"}>{register?"Login":"Register"}</Link></p><p className="small muted">Use a strong password. Never use real patient data in an unreviewed prototype.</p></form></section></PageShell>; }
function Portal({ incidents, role }) { const user=JSON.parse(localStorage.getItem("resqlinkUser")||'{"name":"Demo user","role":"PATIENT"}'); const title=role==="admin"?"Admin command center":role==="hospital"?"Hospital portal":role==="ambulance"?"Ambulance portal":"Patient portal"; return <PageShell><section className="section container"><div className="portal-heading"><div><span className="eyebrow">RESQLINK PORTAL</span><h1>{title}</h1><p className="muted">Welcome, {user.name||"Demo user"}. This is a prototype portal view.</p></div><button className="btn btn-outline" onClick={()=>{localStorage.removeItem("resqlinkUser");localStorage.removeItem("resqlinkToken");window.location.href="/login"}}><LogOut size={16}/> Sign out</button></div><div className="portal-stats"><div className="stat-card"><span className="stat-icon"><Siren/></span><div><small>Total incidents</small><strong>{incidents.length}</strong></div></div><div className="stat-card"><span className="stat-icon"><Ambulance/></span><div><small>Available ambulances</small><strong>{initialAmbulances.filter(a=>a.status==="Available").length}</strong></div></div><div className="stat-card"><span className="stat-icon"><Hospital/></span><div><small>Partner hospitals</small><strong>{initialHospitals.length}</strong></div></div></div><div className="panel"><div className="panel-heading"><div><h2>Incident overview</h2><p>Open a case to view its status and map tracking.</p></div><Link className="btn btn-danger" to="/emergency">New SOS</Link></div>{incidents.length===0?<p className="muted">No incidents yet.</p>:incidents.map(i=><div className="portal-incident" key={i.id}><div><strong>{i.id} · {i.type}</strong><p className="muted">{i.location} · {i.status}</p></div><Link className="btn btn-outline btn-small" to={`/track/${i.id}`}>Track case</Link></div>)}</div></section></PageShell>; }

export default function App() {
  const [incidents,setIncidents] = useState([]);
  const nav=useNavigate();
  useEffect(()=>{let active=true;fetch("/api/incidents").then(r=>r.json()).then(data=>{if(active&&Array.isArray(data))setIncidents(data)}).catch(()=>{});return()=>{active=false}},[]);
  const startSOS=()=>nav("/emergency");
  const submitSOS=async data=>{
    try {
      const response=await fetch("/api/incidents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.message||"Could not save emergency.");
      setIncidents(old=>[payload,...old.filter(x=>x.id!==payload.id)]); nav(`/track/${payload.id}`);
    } catch(error) { window.alert(`${error.message||"Could not save emergency."} Check your backend and MongoDB connection.`); }
  };
  return <Routes>
    <Route path="/" element={<Home startSOS={startSOS}/>}/>
    <Route path="/how-it-works" element={<HowItWorks/>}/>
    <Route path="/emergency" element={<SOSForm onSubmit={submitSOS}/>}/>
    <Route path="/track/:id" element={<Tracking incidents={incidents} setIncidents={setIncidents}/>}/>
    <Route path="/hospitals" element={<Hospitals/>}/>
    <Route path="/ambulances" element={<Ambulances/>}/>
    <Route path="/about" element={<About/>}/>
    <Route path="/contact" element={<Contact/>}/>
    <Route path="/login" element={<AuthPage/>}/>
    <Route path="/register" element={<AuthPage register/>}/>
    <Route path="/portal/patient" element={<Portal incidents={incidents} role="patient"/>}/>
    <Route path="/portal/ambulance" element={<Portal incidents={incidents} role="ambulance"/>}/>
    <Route path="/portal/hospital" element={<Portal incidents={incidents} role="hospital"/>}/>
    <Route path="/portal/admin" element={<Portal incidents={incidents} role="admin"/>}/>
    <Route path="*" element={<PageShell><section className="section container empty-state"><h1>Page not found</h1><Link className="btn btn-primary" to="/">Back home</Link></section></PageShell>}/>
  </Routes>;
}