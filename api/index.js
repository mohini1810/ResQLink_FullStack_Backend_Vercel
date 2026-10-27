import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json({ limit: "1mb" }));

let cached = globalThis.__resqlinkMongo || { conn: null, promise: null };
async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  if (!cached.promise) cached.promise = mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false }).then(m => m);
  cached.conn = await cached.promise;
  globalThis.__resqlinkMongo = cached;
  return cached.conn;
}
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["PATIENT", "AMBULANCE", "HOSPITAL", "ADMIN"], default: "PATIENT" }
}, { timestamps: true });
const incidentSchema = new mongoose.Schema({
  incidentId: { type: String, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, required: true, maxlength: 100 },
  phone: { type: String, required: true, maxlength: 30 },
  age: { type: String, default: "" }, blood: { type: String, default: "Unknown" },
  conditions: { type: String, default: "", maxlength: 1000 },
  type: { type: String, required: true, maxlength: 100 },
  location: { type: String, required: true, maxlength: 500 },
  coords: { type: [Number], default: [12.965, 77.61] },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
  injured: { type: Number, default: 1, min: 1 }, description: { type: String, default: "", maxlength: 3000 },
  injuries: { type: String, default: "" }, road: { type: String, default: "" }, weather: { type: String, default: "" },
  rating: { score: Number, level: String }, status: { type: String, default: "EN ROUTE" }, stage: { type: Number, default: 3, min: 0, max: 8 },
  ambulance: { type: mongoose.Schema.Types.Mixed, default: null }, hospital: { type: mongoose.Schema.Types.Mixed, default: null },
  events: [{ label: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
const User = mongoose.models.ResQLinkUser || mongoose.model("ResQLinkUser", userSchema);
const Incident = mongoose.models.ResQLinkIncident || mongoose.model("ResQLinkIncident", incidentSchema);
const stages = ["Emergency reported", "Location detected", "Severity assessed", "Ambulance assigned", "Ambulance arrived", "Patient picked up", "Hospital notified", "Patient arrived", "Emergency resolved"];
const demoAmbulances = [
  { unit: "AMB-101", vehicle: "KA-01-AE-4417", driver: "Ravi Kulkarni", type: "Advanced Life Support", area: "Indiranagar", eta: "6 min", status: "Available", coords: [12.9718,77.6412] },
  { unit: "AMB-102", vehicle: "KA-05-BC-9021", driver: "Sneha Rao", type: "Trauma Unit", area: "Koramangala", eta: "9 min", status: "Available", coords: [12.9352,77.6245] }
];
const demoHospitals = [
  { name: "CityCare Hospital", area: "Indiranagar", distance: "4.2 km", eta: "9 min", beds: "18/50", icu: "4/12", capacity: "High", specialties: ["Trauma","Neuro","Cardiac"], coords: [12.9784,77.6408] },
  { name: "St. Marian Medical Centre", area: "Koramangala", distance: "6.1 km", eta: "13 min", beds: "25/80", icu: "2/20", capacity: "Medium", specialties: ["Trauma","Ortho"], coords: [12.9352,77.6245] }
];
function normalizedPath(req) { return req.path.startsWith("/api/") ? req.path.slice(4) : req.path; }
function tokenAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please sign in to continue." });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: "Session expired. Please sign in again." }); }
}
function allowRoles(...roles) { return (req,res,next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: "You do not have permission for this action." }); }
app.get(["/api/health", "/health"], async (_req,res) => {
  try { await connectDB(); res.json({ ok: true, service: "ResQLink API", database: "connected" }); }
  catch (e) { res.status(503).json({ ok: false, service: "ResQLink API", database: "not connected", message: process.env.NODE_ENV === "production" ? "Database is not configured or unavailable." : e.message }); }
});
app.post(["/api/auth/register", "/auth/register"], async (req,res) => {
  try {
    await connectDB();
    const { name, email, password, role = "PATIENT" } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (!["PATIENT","AMBULANCE","HOSPITAL","ADMIN"].includes(role)) return res.status(400).json({ message: "Invalid role." });
    // Public registration must not allow self-assigned admin access.
    if (role === "ADMIN") return res.status(403).json({ message: "Admin accounts must be provisioned securely by an administrator." });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await User.create({ name: name.trim(), email, role, passwordHash: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { console.error("register", e); res.status(500).json({ message: "Could not create account." }); }
});
app.post(["/api/auth/login", "/auth/login"], async (req,res) => {
  try {
    await connectDB(); const { email, password, role } = req.body || {};
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
    if (role && user.role !== role) return res.status(403).json({ message: "Choose the role associated with your account." });
    const token = jwt.sign({ sub: user._id.toString(), role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { console.error("login", e); res.status(500).json({ message: "Could not sign in." }); }
});
app.get(["/api/auth/me", "/auth/me"], tokenAuth, async (req,res) => {
  try { await connectDB(); const user = await User.findById(req.user.sub).select("name email role"); if (!user) return res.status(404).json({ message: "Account not found." }); res.json({ user: { id:user._id, name:user.name, email:user.email, role:user.role } }); }
  catch { res.status(500).json({ message: "Could not load account." }); }
});
app.get(["/api/incidents", "/incidents"], async (req,res) => {
  try { await connectDB(); const limit = Math.min(Number(req.query.limit) || 100, 200); const docs = await Incident.find().sort({ createdAt: -1 }).limit(limit).lean(); res.json(docs.map(d=>({...d, id:d.incidentId, reported:new Date(d.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}))); }
  catch (e) { console.error("list incidents", e); res.status(500).json({ message: "Could not load incidents." }); }
});
app.post(["/api/incidents", "/incidents"], async (req,res) => {
  try {
    await connectDB(); const b = req.body || {};
    if (!b.name?.trim() || !b.phone?.trim() || !b.type?.trim() || !b.location?.trim()) return res.status(400).json({ message: "Patient name, contact, emergency type and location are required." });
    const count = await Incident.countDocuments(); const incidentId = `RQ-${new Date().getFullYear()}-${String(10452 + count).padStart(5,"0")}`;
    const ambulance = b.ambulance || demoAmbulances[0]; const hospital = b.hospital || demoHospitals[0];
    const doc = await Incident.create({ incidentId, name:b.name, phone:b.phone, age:b.age || "", blood:b.blood || "Unknown", conditions:b.conditions || "", type:b.type, location:b.location, coords:Array.isArray(b.coords) ? b.coords : [12.965,77.61], severity:["LOW","MEDIUM","HIGH","CRITICAL"].includes(b.severity)?b.severity:"MEDIUM", injured:Math.max(1,Number(b.injured)||1), description:b.description||"", injuries:b.injuries||"", road:b.road||"", weather:b.weather||"", rating:b.rating||{}, status:"EN ROUTE", stage:3, ambulance, hospital, events:stages.slice(0,4).map(label=>({label,at:new Date()})) });
    res.status(201).json({...doc.toObject(), id:doc.incidentId, reported:new Date(doc.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});
  } catch (e) { console.error("create incident", e); res.status(500).json({ message: "Could not save emergency report." }); }
});
app.patch(["/api/incidents/:id/status", "/incidents/:id/status"], tokenAuth, async (req,res) => {
  try {
    await connectDB(); const nextStage = Number(req.body?.stage);
    if (!Number.isInteger(nextStage) || nextStage < 0 || nextStage > 8) return res.status(400).json({ message: "Stage must be between 0 and 8." });
    if (req.user.role !== "ADMIN" && req.user.role !== "AMBULANCE" && req.user.role !== "HOSPITAL") return res.status(403).json({ message: "Only responder portals can update case status." });
    const status = nextStage >= 8 ? "RESOLVED" : nextStage >= 5 ? "PATIENT ON BOARD" : nextStage >= 3 ? "EN ROUTE" : "REPORTED";
    const doc = await Incident.findOneAndUpdate({ incidentId:req.params.id }, { $set:{ stage:nextStage, status }, $push:{ events:{ label:stages[nextStage], at:new Date() } } }, { new:true });
    if (!doc) return res.status(404).json({ message: "Incident not found." });
    res.json({...doc.toObject(), id:doc.incidentId});
  } catch (e) { console.error("update status", e); res.status(500).json({ message: "Could not update incident status." }); }
});
app.get(["/api/hospitals", "/hospitals"], (_req,res) => res.json(demoHospitals));
app.get(["/api/ambulances", "/ambulances"], (_req,res) => res.json(demoAmbulances));
app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({ message:"Unexpected server error." }); });
export default app;
