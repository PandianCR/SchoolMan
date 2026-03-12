import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// GOOGLE SHEETS CONFIG - Update these values after setup
// ============================================================
const SHEET_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyFaRFGIdNALewdfePt8XNSwoygzIxyR6pOkOwXIZAwol3wBN6sh7zz_ppZ0bBE_p8/exec://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  // Replace YOUR_DEPLOYMENT_ID with your Apps Script deployment ID
};

// ============================================================
// THEME & CONSTANTS
// ============================================================
const THEME = {
  primary: "#1a3c5e",
  secondary: "#2d6a9f",
  accent: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  bg: "#f0f4f8",
  card: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
};

const ROLES = ["Admin", "Staff", "Report", "Dashboard"];
const REGIONS = ["South", "East", "North", "West"];
const POSITIONS = ["Head Teacher", "Teacher"];


// All system modules and their permission types
const ALL_MODULES = [
  { key: "dashboard",     label: "Dashboard",       group: "Main" },
  { key: "attendance",    label: "Attendance",       group: "Main" },
  { key: "company",       label: "Company",          group: "Masters" },
  { key: "users",         label: "Users",            group: "Masters" },
  { key: "roles",         label: "Roles",            group: "Masters" },
  { key: "rolepermissions",label: "Role Permissions",group: "Masters" },
  { key: "teachers",      label: "Teachers",         group: "Masters" },
  { key: "classes",       label: "Classes",          group: "Masters" },
  { key: "students",      label: "Students",         group: "Masters" },
  { key: "locations",     label: "Locations",        group: "Masters" },
  { key: "payments",      label: "Payments",         group: "Masters" },
  { key: "reports",       label: "Reports",          group: "Tools" },
  { key: "changepassword",label: "Change Password",  group: "Tools" },
];
const PERM_TYPES = ["view", "add", "edit", "delete", "export"];

// Default permissions per role
const DEFAULT_PERMISSIONS = {
  Admin: ALL_MODULES.reduce((acc, m) => {
    acc[m.key] = { view: true, add: true, edit: true, delete: true, export: true };
    return acc;
  }, {}),
  Staff: ALL_MODULES.reduce((acc, m) => {
    const isAdmin = ["users","roles","rolepermissions","company"].includes(m.key);
    acc[m.key] = { view: !isAdmin, add: !isAdmin, edit: !isAdmin, delete: false, export: true };
    return acc;
  }, {}),
  Report: ALL_MODULES.reduce((acc, m) => {
    acc[m.key] = { view: ["dashboard","reports","changepassword","attendance"].includes(m.key), add: false, edit: false, delete: false, export: ["reports"].includes(m.key) };
    return acc;
  }, {}),
  Dashboard: ALL_MODULES.reduce((acc, m) => {
    acc[m.key] = { view: m.key === "dashboard" || m.key === "changepassword", add: false, edit: false, delete: false, export: false };
    return acc;
  }, {}),
};

// ============================================================
// GOOGLE SHEETS API LAYER
// ============================================================
const api = {
  async call(action, data = {}) {
    try {
      const params = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(data).map(([k,v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])) });
      const res = await fetch(`${SHEET_CONFIG.SCRIPT_URL}?${params}`);
      return await res.json();
    } catch (e) {
      console.error("API Error:", e);
      return { success: false, error: e.message };
    }
  },
  async get(sheet) { return this.call("get", { sheet }); },
  async add(sheet, row) { return this.call("add", { sheet, row }); },
  async update(sheet, id, row) { return this.call("update", { sheet, id, row }); },
  async remove(sheet, id) { return this.call("delete", { sheet, id }); },
  async login(userid, password) { return this.call("login", { userid, password }); },
  async changePassword(userid, oldPassword, newPassword) { return this.call("changePassword", { userid, oldPassword, newPassword }); },
};

// ============================================================
// LOCAL STORAGE / DEMO DATA (for offline / demo mode)
// ============================================================
const DEMO_MODE = true; // Set to false when Google Sheets is configured

const initLocalData = () => {
  const defaults = {
    company: [{ id: 1, name: "Bright Future Academy", logo: "", updated: new Date().toISOString() }],
    users: [
      { id: 1, userid: "admin", name: "Administrator", email: "admin@school.com", role: "Admin", active: true, password: "admin123" },
      { id: 2, userid: "staff1", name: "John Staff", email: "staff@school.com", role: "Staff", active: true, password: "staff123" },
    ],
    roles: ROLES.map((r, i) => ({ id: i + 1, name: r })),
    teachers: [
      { id: 1, teacherid: "T001", name: "Mary Johnson", classname: "Grade 1A", email: "mary@school.com", contact: "+1234567890", picture: "", position: "Head Teacher", joineddate: "2020-01-15", active: true },
      { id: 2, teacherid: "T002", name: "Peter Smith", classname: "Grade 2B", email: "peter@school.com", contact: "+0987654321", picture: "", position: "Teacher", joineddate: "2021-03-01", active: true },
    ],
    classes: [
      { id: 1, classid: "C001", classname: "Grade 1A" },
      { id: 2, classid: "C002", classname: "Grade 1B" },
      { id: 3, classid: "C003", classname: "Grade 2A" },
      { id: 4, classid: "C004", classname: "Grade 2B" },
    ],
    students: [
      { id: 1, studentid: "S001", name: "Alice Brown", nin: "NIN001", dob: "2015-04-12", gender: "Female", parent1: "Bob Brown", parent2: "Carol Brown", contact: "+1112223333", email: "alice@parent.com", locationid: 1, classid: 1, transport: "Yes", joineddate: "2022-09-01", active: true },
      { id: 2, studentid: "S002", name: "Tom Davis",   nin: "NIN002", dob: "2014-09-25", gender: "Male",   parent1: "Mike Davis",  parent2: "Sue Davis",   contact: "+4445556666", email: "tom@parent.com",   locationid: 2, classid: 1, transport: "No",  joineddate: "2022-09-01", active: true },
      { id: 3, studentid: "S003", name: "Emma Wilson", nin: "NIN003", dob: "2016-01-07", gender: "Female", parent1: "James Wilson",parent2: "Kate Wilson", contact: "+7778889999", email: "emma@parent.com", locationid: 1, classid: 2, transport: "Yes", joineddate: "2023-01-10", active: true },
    ],
    locations: [
      { id: 1, locationid: "L001", name: "Downtown", region: "North" },
      { id: 2, locationid: "L002", name: "Westside", region: "West" },
      { id: 3, locationid: "L003", name: "Eastpark", region: "East" },
    ],
    payments: [
      { id: 1, paymentdate: "2024-01-15", teacherid: 1, amount: 5000, paid: "Yes" },
      { id: 2, paymentdate: "2024-01-15", teacherid: 2, amount: 4500, paid: "No" },
    ],
    attendance: [
      { id: 1, attendancedate: "2024-01-20", classid: 1, studentid: 1, status: "Present" },
      { id: 2, attendancedate: "2024-01-20", classid: 1, studentid: 2, status: "Absent" },
    ],
    rolepermissions: ROLES.map((role, i) => ({
      id: i + 1,
      role,
      permissions: JSON.stringify(DEFAULT_PERMISSIONS[role] || {}),
    })),
  };
  Object.entries(defaults).forEach(([key, val]) => {
    if (!localStorage.getItem(`school_${key}`)) {
      localStorage.setItem(`school_${key}`, JSON.stringify(val));
    }
  });
};

const localDB = {
  get: (table) => JSON.parse(localStorage.getItem(`school_${table}`) || "[]"),
  set: (table, data) => localStorage.setItem(`school_${table}`, JSON.stringify(data)),
  add: (table, item) => {
    const data = localDB.get(table);
    const newItem = { ...item, id: Date.now() };
    data.push(newItem);
    localDB.set(table, data);
    return newItem;
  },
  update: (table, id, item) => {
    const data = localDB.get(table).map(r => r.id === id ? { ...r, ...item } : r);
    localDB.set(table, data);
  },
  remove: (table, id) => {
    const data = localDB.get(table).filter(r => r.id !== id);
    localDB.set(table, data);
  },
};

// ============================================================
// PERMISSION HELPERS
// ============================================================
const getPermissions = (role) => {
  const stored = localDB.get("rolepermissions");
  const rec = stored.find(r => r.role === role);
  if (!rec) return DEFAULT_PERMISSIONS[role] || {};
  try { return typeof rec.permissions === "string" ? JSON.parse(rec.permissions) : rec.permissions; }
  catch { return DEFAULT_PERMISSIONS[role] || {}; }
};

const hasPerm = (role, module, action) => {
  if (role === "Admin") return true; // Admin always has full access
  const perms = getPermissions(role);
  return !!(perms[module]?.[action]);
};
// ============================================================
const exportToCSV = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
};

const exportToPDF = (title, data, columns) => {
  const printWindow = window.open("", "_blank");
  const tableRows = data.map(row => `<tr>${columns.map(col => `<td>${row[col.key] ?? ""}</td>`).join("")}</tr>`).join("");
  printWindow.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h2 { color: #1a3c5e; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th { background: #1a3c5e; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
      td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .meta { color: #64748b; font-size: 11px; margin-bottom: 10px; }
    </style></head>
    <body>
      <h2>${title}</h2>
      <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      <table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${tableRows}</tbody></table>
    </body></html>`);
  printWindow.document.close();
  printWindow.print();
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "";

// ============================================================
// REUSABLE UI COMPONENTS
// ============================================================
const Modal = ({ title, onClose, children, size = "md" }) => {
  const sizes = { sm: "400px", md: "600px", lg: "800px", xl: "1000px" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: sizes[size], maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e2e8f0", background: THEME.primary, borderRadius: "12px 12px 0 0" }}>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
};

const FormField = ({ label, required, children, error }) => (
  <div style={{ marginBottom: "16px" }}>
    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: THEME.text }}>
      {label}{required && <span style={{ color: THEME.danger }}>*</span>}
    </label>
    {children}
    {error && <p style={{ color: THEME.danger, fontSize: "12px", margin: "4px 0 0" }}>{error}</p>}
  </div>
);

const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const selectStyle = { ...inputStyle, background: "#fff" };

const Input = (props) => <input style={inputStyle} {...props} />;
const Select = ({ children, ...props }) => <select style={selectStyle} {...props}>{children}</select>;

const Btn = ({ children, variant = "primary", size = "md", onClick, disabled, style: sx = {} }) => {
  const variants = {
    primary: { background: THEME.primary, color: "#fff", border: "none" },
    secondary: { background: "#e2e8f0", color: THEME.text, border: "none" },
    danger: { background: THEME.danger, color: "#fff", border: "none" },
    success: { background: THEME.success, color: "#fff", border: "none" },
    warning: { background: THEME.accent, color: "#fff", border: "none" },
    outline: { background: "transparent", color: THEME.primary, border: `1px solid ${THEME.primary}` },
  };
  const sizes = { sm: { padding: "6px 12px", fontSize: "12px" }, md: { padding: "9px 18px", fontSize: "14px" }, lg: { padding: "12px 24px", fontSize: "15px" } };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...variants[variant], ...sizes[size], borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px", opacity: disabled ? 0.6 : 1, transition: "all 0.2s", ...sx }}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = "blue" }) => {
  const colors = { blue: "#dbeafe:#1d4ed8", green: "#dcfce7:#166534", red: "#fee2e2:#991b1b", yellow: "#fef3c7:#92400e", gray: "#f1f5f9:#475569" };
  const [bg, text] = colors[color].split(":");
  return <span style={{ background: bg, color: text, padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>{children}</span>;
};

const Table = ({ columns, data, actions }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
      <thead>
        <tr style={{ background: THEME.primary }}>
          {columns.map(c => <th key={c.key} style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}>{c.label}</th>)}
          {actions && <th style={{ padding: "10px 14px", color: "#fff", fontSize: "12px", textAlign: "center" }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={columns.length + (actions ? 1 : 0)} style={{ padding: "40px", textAlign: "center", color: THEME.muted }}>No records found</td></tr>
        ) : data.map((row, i) => (
          <tr key={row.id || i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f8fafc"}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "-")}
              </td>
            ))}
            {actions && <td style={{ padding: "8px 14px", textAlign: "center", whiteSpace: "nowrap" }}>{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Alert = ({ type, message, onClose }) => {
  const colors = { success: [THEME.success, "#dcfce7"], error: [THEME.danger, "#fee2e2"], info: [THEME.secondary, "#dbeafe"] };
  const [text, bg] = colors[type] || colors.info;
  return message ? (
    <div style={{ background: bg, border: `1px solid ${text}`, color: text, borderRadius: "8px", padding: "10px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
      <span>{message}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", color: text, cursor: "pointer", fontSize: "16px" }}>×</button>}
    </div>
  ) : null;
};

const SearchBar = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search..."} style={{ ...inputStyle, width: "240px", paddingLeft: "36px", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "10px center" }} />
);

const ExportBar = ({ onExportCSV, onExportPDF }) => (
  <div style={{ display: "flex", gap: "8px" }}>
    <Btn variant="success" size="sm" onClick={onExportCSV}>📊 Excel/CSV</Btn>
    <Btn variant="danger" size="sm" onClick={onExportPDF}>📄 PDF</Btn>
  </div>
);

// ---- PAGINATION ----
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

const Pagination = ({ currentPage, totalPages, totalRecords, pageSize, onPageChange, onPageSizeChange }) => {
  if (totalRecords === 0) return null;

  const from = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to   = Math.min(currentPage * pageSize, totalRecords);

  // Build visible page numbers: always show first, last, current ±2
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pages.push(i);
    }
  }
  // Insert ellipsis markers
  const pageButtons = [];
  for (let idx = 0; idx < pages.length; idx++) {
    if (idx > 0 && pages[idx] - pages[idx - 1] > 1) {
      pageButtons.push("...");
    }
    pageButtons.push(pages[idx]);
  }

  const btnBase = { minWidth: 32, height: 32, borderRadius: 6, border: "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" };

  return (
    <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", background: "#fafbfc" }}>
      {/* Left: rows per page + record count */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: THEME.muted }}>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#fff", cursor: "pointer" }}>
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 13, color: THEME.muted }}>
          Showing <strong style={{ color: THEME.text }}>{from}–{to}</strong> of <strong style={{ color: THEME.text }}>{totalRecords}</strong> records
        </span>
      </div>

      {/* Right: page buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1}
          style={{ ...btnBase, background: currentPage === 1 ? "#f1f5f9" : "#fff", color: currentPage === 1 ? "#94a3b8" : THEME.primary, padding: "0 10px" }} title="First">«</button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
          style={{ ...btnBase, background: currentPage === 1 ? "#f1f5f9" : "#fff", color: currentPage === 1 ? "#94a3b8" : THEME.primary, padding: "0 10px" }} title="Previous">‹</button>

        {pageButtons.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} style={{ padding: "0 4px", color: THEME.muted, fontSize: 13 }}>…</span>
          ) : (
            <button key={p} onClick={() => onPageChange(p)}
              style={{ ...btnBase, background: p === currentPage ? THEME.primary : "#fff", color: p === currentPage ? "#fff" : THEME.text, borderColor: p === currentPage ? THEME.primary : "#e2e8f0", padding: "0 10px" }}>
              {p}
            </button>
          )
        )}

        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
          style={{ ...btnBase, background: currentPage === totalPages ? "#f1f5f9" : "#fff", color: currentPage === totalPages ? "#94a3b8" : THEME.primary, padding: "0 10px" }} title="Next">›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}
          style={{ ...btnBase, background: currentPage === totalPages ? "#f1f5f9" : "#fff", color: currentPage === totalPages ? "#94a3b8" : THEME.primary, padding: "0 10px" }} title="Last">»</button>
      </div>
    </div>
  );
};

// ============================================================
// PAGE COMPONENTS
// ============================================================

// --- LOGIN PAGE ---
const LoginPage = ({ onLogin }) => {
  const [form, setForm] = useState({ userid: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.userid || !form.password) { setError("Please enter userid and password"); return; }
    setLoading(true);
    if (DEMO_MODE) {
      const users = localDB.get("users");
      const user = users.find(u => u.userid === form.userid && u.password === form.password && u.active);
      if (user) { onLogin(user); }
      else setError("Invalid credentials or account inactive");
    } else {
      const res = await api.login(form.userid, form.password);
      if (res.success) onLogin(res.user);
      else setError(res.error || "Login failed");
    }
    setLoading(false);
  };

  const company = localDB.get("company")[0] || { name: "School Management System" };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.secondary} 50%, #1e5f8c 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: 80, height: 80, background: "rgba(255,255,255,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "36px", backdropFilter: "blur(10px)", border: "2px solid rgba(255,255,255,0.3)" }}>🏫</div>
          <h1 style={{ color: "#fff", margin: "0 0 4px", fontSize: "26px", fontWeight: 700 }}>{company.name}</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontSize: "14px" }}>School Management System</p>
        </div>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "36px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "20px", fontWeight: 700 }}>Sign In</h2>
          {error && <Alert type="error" message={error} onClose={() => setError("")} />}
          <FormField label="User ID" required>
            <Input placeholder="Enter your User ID" value={form.userid} onChange={e => setForm({ ...form, userid: e.target.value })} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </FormField>
          <FormField label="Password" required>
            <Input type="password" placeholder="Enter your password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </FormField>
          <Btn variant="primary" onClick={handleLogin} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
            {loading ? "Signing in..." : "Sign In →"}
          </Btn>
          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: THEME.muted }}>
            Demo: admin / admin123
          </p>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD ---
const Dashboard = ({ user }) => {
  const stats = [
    { label: "Total Students", value: localDB.get("students").filter(s => s.active).length, icon: "👨‍🎓", color: "#3b82f6", bg: "#dbeafe" },
    { label: "Total Teachers", value: localDB.get("teachers").filter(t => t.active).length, icon: "👩‍🏫", color: "#10b981", bg: "#dcfce7" },
    { label: "Classes", value: localDB.get("classes").length, icon: "🏫", color: "#f59e0b", bg: "#fef3c7" },
    { label: "Pending Payments", value: localDB.get("payments").filter(p => p.paid === "No").length, icon: "💰", color: "#ef4444", bg: "#fee2e2" },
  ];

  const recentAttendance = localDB.get("attendance").slice(-5).reverse();
  const classes = localDB.get("classes");
  const students = localDB.get("students");

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>📊 Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: 52, height: 52, background: s.bg, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "13px", color: THEME.muted }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: THEME.text }}>Recent Attendance</h3>
          {recentAttendance.length === 0 ? <p style={{ color: THEME.muted, fontSize: "14px" }}>No attendance records yet</p> :
            recentAttendance.map(a => {
              const cls = classes.find(c => c.id === a.classid);
              const stu = students.find(s => s.id === a.studentid);
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                  <span>{stu?.name || "Unknown"} — {cls?.classname || "Unknown"}</span>
                  <Badge color={a.status === "Present" ? "green" : "red"}>{a.status}</Badge>
                </div>
              );
            })}
        </div>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: THEME.text }}>Class Summary</h3>
          {classes.map(c => {
            const count = students.filter(s => s.active).length; // simplified
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                <span>{c.classname}</span>
                <span style={{ color: THEME.muted }}>Class ID: {c.classid}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- GENERIC CRUD PAGE ---
const CRUDPage = ({ title, icon, table, columns, formFields, defaultForm, searchKey = "name", userRole, moduleKey }) => {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [alert, setAlert] = useState(null);
  const [editId, setEditId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const canAdd    = hasPerm(userRole, moduleKey || table, "add");
  const canEdit   = hasPerm(userRole, moduleKey || table, "edit");
  const canDelete = hasPerm(userRole, moduleKey || table, "delete");
  const canExport = hasPerm(userRole, moduleKey || table, "export");

  useEffect(() => { setData(localDB.get(table)); }, [table]);

  // Reset to page 1 whenever search changes
  useEffect(() => { setPage(1); }, [search]);

  const filtered = data.filter(r => {
    const val = r[searchKey] || "";
    return val.toString().toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showAlert = (type, msg) => { setAlert({ type, msg }); setTimeout(() => setAlert(null), 3000); };

  const openAdd = () => { setForm(defaultForm); setEditId(null); setModal("form"); };
  const openEdit = (row) => { setForm({ ...row }); setEditId(row.id); setModal("form"); };
  const openDel = (row) => { setForm(row); setModal("delete"); };

  const handleSave = () => {
    if (editId) { localDB.update(table, editId, form); showAlert("success", "Record updated successfully"); }
    else { localDB.add(table, form); showAlert("success", "Record added successfully"); }
    setData(localDB.get(table));
    setModal(null);
  };

  const handleDelete = () => {
    localDB.remove(table, form.id);
    setData(localDB.get(table));
    setModal(null);
    showAlert("success", "Record deleted");
  };

  const exportCols = columns.map(c => ({ key: c.key, label: c.label }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, color: THEME.text, fontSize: "22px", fontWeight: 700 }}>{icon} {title}</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {canExport && <ExportBar onExportCSV={() => exportToCSV(filtered, title)} onExportPDF={() => exportToPDF(title, filtered, exportCols)} />}
          {canAdd && <Btn variant="primary" size="sm" onClick={openAdd}>+ Add New</Btn>}
        </div>
      </div>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar value={search} onChange={setSearch} />
          <span style={{ marginLeft: "auto", color: THEME.muted, fontSize: "13px" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
          </span>
        </div>
        <Table columns={columns} data={pageData} actions={(canEdit || canDelete) ? (row) => (
          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
            {canEdit   && <Btn variant="outline" size="sm" onClick={() => openEdit(row)}>✏️</Btn>}
            {canDelete && <Btn variant="danger"  size="sm" onClick={() => openDel(row)}>🗑️</Btn>}
          </div>
        ) : undefined} />
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalRecords={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {modal === "form" && (
        <Modal title={`${editId ? "Edit" : "Add"} ${title}`} onClose={() => setModal(null)} size="md">
          {formFields.map(field => (
            <FormField key={field.key} label={field.label} required={field.required}>
              {field.type === "select" ? (
                <Select value={form[field.key] || ""} onChange={e => setForm({ ...form, [field.key]: e.target.value })}>
                  <option value="">Select {field.label}</option>
                  {field.options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                </Select>
              ) : field.type === "checkbox" ? (
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form[field.key] === true || form[field.key] === "true"} onChange={e => setForm({ ...form, [field.key]: e.target.checked })} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: "14px" }}>Active</span>
                </label>
              ) : (
                <Input type={field.type || "text"} placeholder={field.placeholder || field.label} value={form[field.key] || ""} onChange={e => setForm({ ...form, [field.key]: e.target.value })} />
              )}
            </FormField>
          ))}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave}>💾 Save</Btn>
          </div>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Confirm Delete" onClose={() => setModal(null)} size="sm">
          <p style={{ color: THEME.text, marginBottom: "20px" }}>Are you sure you want to delete <strong>{form[searchKey]}</strong>? This action cannot be undone.</p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={handleDelete}>🗑️ Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// --- COMPANY SETTINGS ---
const CompanySettings = ({ userRole }) => {
  const [company, setCompany] = useState(localDB.get("company")[0] || { id: 1, name: "", logo: "" });
  const [alert, setAlert] = useState(null);
  const [logoPreview, setLogoPreview] = useState(company.logo || "");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoPreview(ev.target.result); setCompany({ ...company, logo: ev.target.result }); };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const list = localDB.get("company");
    if (list.length === 0) localDB.add("company", company);
    else {
      const updated = list.map(c => c.id === company.id ? company : c);
      localDB.set("company", updated);
    }
    setAlert({ type: "success", msg: "Company settings saved!" });
    setTimeout(() => setAlert(null), 3000);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>🏢 Company Settings</h2>
      {alert && <Alert type={alert.type} message={alert.msg} />}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", maxWidth: 500 }}>
        <FormField label="Company Logo">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {logoPreview && <img src={logoPreview} alt="Logo" style={{ width: 100, height: 100, objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: 8 }} />}
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ fontSize: "13px" }} />
          </div>
        </FormField>
        <FormField label="Company Name" required>
          <Input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} placeholder="Enter company/school name" />
        </FormField>
        {["Admin"].includes(userRole) && <Btn variant="primary" onClick={handleSave}>💾 Save Settings</Btn>}
      </div>
    </div>
  );
};

// --- ATTENDANCE MODULE ---
const AttendanceModule = ({ userRole }) => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass] = useState("");
  const [attendanceMap, setAttendanceMap] = useState({});
  const [saved, setSaved] = useState(false);
  const [alert, setAlert] = useState(null);

  const classes = localDB.get("classes");
  const allStudents = localDB.get("students").filter(s => s.active);
  const existingAttendance = localDB.get("attendance");

  useEffect(() => {
    if (date && selectedClass) {
      const existing = existingAttendance.filter(a => a.attendancedate === date && a.classid === parseInt(selectedClass));
      const map = {};
      existing.forEach(a => { map[a.studentid] = a.status; });
      setAttendanceMap(map);
      setSaved(existing.length > 0);
    }
  }, [date, selectedClass]);

  const students = selectedClass ? allStudents : [];

  const toggleAttendance = (studentId, status) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const selectAll = (status) => {
    const map = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendanceMap(map);
  };

  const handleSave = () => {
    if (!date || !selectedClass) { setAlert({ type: "error", msg: "Please select date and class" }); return; }
    const existing = localDB.get("attendance");
    const filtered = existing.filter(a => !(a.attendancedate === date && a.classid === parseInt(selectedClass)));
    students.forEach(s => {
      filtered.push({ id: Date.now() + Math.random(), attendancedate: date, classid: parseInt(selectedClass), studentid: s.id, status: attendanceMap[s.id] || "Absent" });
    });
    localDB.set("attendance", filtered);
    setSaved(true);
    setAlert({ type: "success", msg: "Attendance saved successfully!" });
    setTimeout(() => setAlert(null), 3000);
  };

  const presentCount = students.filter(s => attendanceMap[s.id] === "Present").length;
  const absentCount = students.filter(s => attendanceMap[s.id] !== "Present").length;

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>📋 Attendance</h2>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <FormField label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 180 }} />
          </FormField>
          <FormField label="Class">
            <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ width: 200 }}>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.classname}</option>)}
            </Select>
          </FormField>
          {selectedClass && students.length > 0 && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <Btn variant="success" size="sm" onClick={() => selectAll("Present")}>✓ Mark All Present</Btn>
              <Btn variant="danger" size="sm" onClick={() => selectAll("Absent")}>✗ Mark All Absent</Btn>
            </div>
          )}
        </div>
      </div>

      {selectedClass && students.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ background: "#dcfce7", borderRadius: 8, padding: "8px 16px", fontSize: 13 }}>
              <strong style={{ color: "#166534" }}>Present: {presentCount}</strong>
            </div>
            <div style={{ background: "#fee2e2", borderRadius: 8, padding: "8px 16px", fontSize: 13 }}>
              <strong style={{ color: "#991b1b" }}>Absent: {absentCount}</strong>
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: THEME.primary }}>
                  <th style={{ padding: "10px 16px", color: "#fff", textAlign: "left", fontWeight: 600, fontSize: 12 }}>#</th>
                  <th style={{ padding: "10px 16px", color: "#fff", textAlign: "left", fontWeight: 600, fontSize: 12 }}>Student Name</th>
                  <th style={{ padding: "10px 16px", color: "#fff", textAlign: "left", fontWeight: 600, fontSize: 12 }}>Student ID</th>
                  <th style={{ padding: "10px 16px", color: "#fff", textAlign: "center", fontWeight: 600, fontSize: 12 }}>Present</th>
                  <th style={{ padding: "10px 16px", color: "#fff", textAlign: "center", fontWeight: 600, fontSize: 12 }}>Absent</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const status = attendanceMap[s.id];
                  return (
                    <tr key={s.id} style={{ background: status === "Present" ? "#f0fdf4" : status === "Absent" ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "10px 16px", color: THEME.muted }}>{i + 1}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: "10px 16px", color: THEME.muted }}>{s.studentid}</td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <input type="checkbox" checked={status === "Present"} onChange={() => toggleAttendance(s.id, "Present")} style={{ width: 18, height: 18, cursor: "pointer", accentColor: THEME.success }} />
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                        <input type="checkbox" checked={status === "Absent"} onChange={() => toggleAttendance(s.id, "Absent")} style={{ width: 18, height: 18, cursor: "pointer", accentColor: THEME.danger }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
            <Btn variant="primary" onClick={handleSave}>💾 Save Attendance</Btn>
            {saved && <Badge color="green">✓ Saved for {date}</Badge>}
          </div>
        </>
      )}
      {selectedClass && students.length === 0 && <p style={{ color: THEME.muted }}>No active students found.</p>}
    </div>
  );
};

// --- CHANGE PASSWORD ---
const ChangePassword = ({ user }) => {
  const [form, setForm] = useState({ old: "", new1: "", new2: "" });
  const [alert, setAlert] = useState(null);

  const handleChange = () => {
    if (!form.old || !form.new1 || !form.new2) { setAlert({ type: "error", msg: "All fields required" }); return; }
    if (form.new1 !== form.new2) { setAlert({ type: "error", msg: "New passwords don't match" }); return; }
    if (form.new1.length < 6) { setAlert({ type: "error", msg: "Password must be at least 6 characters" }); return; }
    const users = localDB.get("users");
    const u = users.find(u => u.id === user.id);
    if (u.password !== form.old) { setAlert({ type: "error", msg: "Current password incorrect" }); return; }
    localDB.update("users", user.id, { password: form.new1 });
    setAlert({ type: "success", msg: "Password changed successfully!" });
    setForm({ old: "", new1: "", new2: "" });
    setTimeout(() => setAlert(null), 3000);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>🔐 Change Password</h2>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", maxWidth: 400 }}>
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <FormField label="Current Password" required>
          <Input type="password" value={form.old} onChange={e => setForm({ ...form, old: e.target.value })} />
        </FormField>
        <FormField label="New Password" required>
          <Input type="password" value={form.new1} onChange={e => setForm({ ...form, new1: e.target.value })} />
        </FormField>
        <FormField label="Confirm New Password" required>
          <Input type="password" value={form.new2} onChange={e => setForm({ ...form, new2: e.target.value })} />
        </FormField>
        <Btn variant="primary" onClick={handleChange}>🔐 Change Password</Btn>
      </div>
    </div>
  );
};

// --- ROLE PERMISSIONS MASTER ---
const RolePermissions = ({ userRole }) => {
  const roles = localDB.get("roles");
  const [selectedRole, setSelectedRole] = useState(roles[0]?.name || "Admin");
  const [permissions, setPermissions] = useState({});
  const [alert, setAlert] = useState(null);
  const canEditPerms = hasPerm(userRole, "rolepermissions", "edit");

  useEffect(() => {
    setPermissions(getPermissions(selectedRole));
  }, [selectedRole]);

  const togglePerm = (moduleKey, permType) => {
    if (!canEditPerms) return;
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] || {}), [permType]: !(prev[moduleKey]?.[permType]) }
    }));
  };

  const toggleAllModule = (moduleKey) => {
    const allOn = PERM_TYPES.every(p => permissions[moduleKey]?.[p]);
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: PERM_TYPES.reduce((acc, p) => { acc[p] = !allOn; return acc; }, {})
    }));
  };

  const toggleAllPerm = (permType) => {
    const allOn = ALL_MODULES.every(m => permissions[m.key]?.[permType]);
    setPermissions(prev => {
      const next = { ...prev };
      ALL_MODULES.forEach(m => {
        next[m.key] = { ...(next[m.key] || {}), [permType]: !allOn };
      });
      return next;
    });
  };

  const handleSave = () => {
    const stored = localDB.get("rolepermissions");
    const exists = stored.find(r => r.role === selectedRole);
    if (exists) {
      localDB.update("rolepermissions", exists.id, { ...exists, permissions: JSON.stringify(permissions) });
    } else {
      localDB.add("rolepermissions", { role: selectedRole, permissions: JSON.stringify(permissions) });
    }
    setAlert({ type: "success", msg: `Permissions saved for ${selectedRole}` });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleReset = () => {
    const def = DEFAULT_PERMISSIONS[selectedRole] || {};
    setPermissions(def);
    setAlert({ type: "info", msg: "Reset to defaults — click Save to apply" });
    setTimeout(() => setAlert(null), 3000);
  };

  const groups = [...new Set(ALL_MODULES.map(m => m.group))];
  const permLabels = { view: "👁 View", add: "➕ Add", edit: "✏️ Edit", delete: "🗑 Delete", export: "📤 Export" };

  const cellStyle = { padding: "10px 8px", textAlign: "center", borderBottom: "1px solid #f1f5f9" };
  const headCellStyle = { padding: "10px 8px", textAlign: "center", color: "#fff", fontWeight: 600, fontSize: 11, background: THEME.secondary };

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>🔒 Role Permissions</h2>
      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {/* Role Selector */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roles.map(r => (
              <button key={r.name} onClick={() => setSelectedRole(r.name)} style={{ padding: "8px 20px", borderRadius: 8, border: "2px solid", cursor: "pointer", fontWeight: 600, fontSize: 14, borderColor: selectedRole === r.name ? THEME.primary : "#e2e8f0", background: selectedRole === r.name ? THEME.primary : "#fff", color: selectedRole === r.name ? "#fff" : THEME.text, transition: "all 0.2s" }}>
                {r.name}
              </button>
            ))}
          </div>
          {canEditPerms && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="sm" onClick={handleReset}>↺ Reset Defaults</Btn>
              <Btn variant="primary" size="sm" onClick={handleSave}>💾 Save Permissions</Btn>
            </div>
          )}
        </div>
        {selectedRole === "Admin" && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "#fef3c7", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
            ⚠️ Admin role always has full access to all modules regardless of permission settings.
          </div>
        )}
      </div>

      {/* Permissions Grid */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: THEME.primary }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#fff", fontWeight: 700, fontSize: 12, minWidth: 160 }}>Module</th>
                {PERM_TYPES.map(p => (
                  <th key={p} style={headCellStyle}>
                    <div>{permLabels[p]}</div>
                    {canEditPerms && (
                      <button onClick={() => toggleAllPerm(p)} title="Toggle all" style={{ marginTop: 4, fontSize: 10, padding: "2px 6px", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer" }}>
                        Toggle All
                      </button>
                    )}
                  </th>
                ))}
                <th style={{ ...headCellStyle, background: THEME.primary }}>All</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <>
                  <tr key={`group-${group}`}>
                    <td colSpan={PERM_TYPES.length + 2} style={{ padding: "6px 16px", background: "#f8fafc", fontWeight: 700, fontSize: 11, color: THEME.muted, letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>
                      {group}
                    </td>
                  </tr>
                  {ALL_MODULES.filter(m => m.group === group).map((mod, i) => {
                    const modPerms = permissions[mod.key] || {};
                    const allOn = PERM_TYPES.every(p => modPerms[p]);
                    const someOn = PERM_TYPES.some(p => modPerms[p]);
                    const rowBg = i % 2 === 0 ? "#fff" : "#fafbfc";
                    return (
                      <tr key={mod.key} style={{ background: rowBg }}>
                        <td style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 500, color: THEME.text }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: someOn ? THEME.success : "#d1d5db", display: "inline-block" }} />
                            {mod.label}
                          </div>
                        </td>
                        {PERM_TYPES.map(p => {
                          const checked = !!modPerms[p];
                          return (
                            <td key={p} style={cellStyle}>
                              <label style={{ cursor: canEditPerms ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canEditPerms || selectedRole === "Admin"}
                                  onChange={() => togglePerm(mod.key, p)}
                                  style={{ width: 16, height: 16, accentColor: THEME.primary, cursor: canEditPerms ? "pointer" : "default" }}
                                />
                              </label>
                            </td>
                          );
                        })}
                        <td style={cellStyle}>
                          {canEditPerms && selectedRole !== "Admin" && (
                            <button onClick={() => toggleAllModule(mod.key)} title={allOn ? "Disable all" : "Enable all"} style={{ padding: "3px 10px", fontSize: 11, borderRadius: 6, border: `1px solid ${allOn ? THEME.danger : THEME.success}`, background: "transparent", color: allOn ? THEME.danger : THEME.success, cursor: "pointer", fontWeight: 600 }}>
                              {allOn ? "None" : "All"}
                            </button>
                          )}
                          {selectedRole === "Admin" && <Badge color="green">Full</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {PERM_TYPES.map(p => {
          const count = selectedRole === "Admin" ? ALL_MODULES.length : ALL_MODULES.filter(m => permissions[m.key]?.[p]).length;
          const pct = Math.round((count / ALL_MODULES.length) * 100);
          return (
            <div key={p} style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, color: THEME.muted, marginBottom: 6 }}>{permLabels[p]}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: THEME.primary }}>{count} <span style={{ fontSize: 13, fontWeight: 400, color: THEME.muted }}>/ {ALL_MODULES.length}</span></div>
              <div style={{ marginTop: 6, height: 4, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? THEME.success : pct > 50 ? THEME.secondary : THEME.accent, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- REPORTS ---
const Reports = ({ userRole = "Admin" }) => {
  const canExport = hasPerm(userRole, "reports", "export");
  const [activeReport, setActiveReport] = useState("teachers");
  const [locationFilter, setLocationFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const teachers = localDB.get("teachers");
  const students = localDB.get("students");
  const locations = localDB.get("locations");
  const classes = localDB.get("classes");
  const attendance = localDB.get("attendance");

  const teacherCols = [
    { key: "teacherid", label: "Teacher ID" }, { key: "name", label: "Name" },
    { key: "classname", label: "Class" }, { key: "position", label: "Position" },
    { key: "email", label: "Email" }, { key: "contact", label: "Contact" },
    { key: "joineddate", label: "Joined", render: v => formatDate(v) },
    { key: "active", label: "Status", render: v => <Badge color={v ? "green" : "gray"}>{v ? "Active" : "Inactive"}</Badge> },
  ];

  const filteredStudents = students.filter(s => {
  
  const [studentClassFilter,setStudentClassFilter]= useState('');

    const loc = locations.find(l => l.id === s.locationid);
    if (locationFilter && s.locationid !== parseInt(locationFilter)) return false;
    if (regionFilter && loc?.region !== regionFilter) return false;
    if (studentClassFilter && parseInt(s.classid) !== parseInt(studentClassFilter)) return false;
    return true;
  }).map(s => {
    const loc = locations.find(l => l.id === s.locationid);
    const cls = classes.find(c => c.id === parseInt(s.classid));
    return { ...s, locationname: loc?.name || "", region: loc?.region || "", classname: cls?.classname || "" };
  });

  const studentCols = [
    { key: "studentid",   label: "ID" },
    { key: "name",        label: "Name" },
    { key: "nin",         label: "NIN" },
    { key: "dob",         label: "Date of Birth", render: v => formatDate(v) },
    { key: "gender",      label: "Gender" },
    { key: "classname",   label: "Class" },
    { key: "parent1",     label: "Parent 1" },
    { key: "contact",     label: "Contact" },
    { key: "locationname",label: "Location" },
    { key: "region",      label: "Region" },
    { key: "transport",   label: "Transport" },
    { key: "active",      label: "Status", render: v => <Badge color={v ? "green" : "gray"}>{v ? "Active" : "Inactive"}</Badge> },
  ];

  const filteredAttendance = attendance.filter(a => {
    if (dateFrom && a.attendancedate < dateFrom) return false;
    if (dateTo && a.attendancedate > dateTo) return false;
    if (classFilter && a.classid !== parseInt(classFilter)) return false;
    return true;
  }).map(a => {
    const cls = classes.find(c => c.id === a.classid);
    const stu = students.find(s => s.id === a.studentid);
    return { ...a, classname: cls?.classname || "", studentname: stu?.name || "" };
  }).sort((a, b) => {
    if (a.classname < b.classname) return -1;
    if (a.classname > b.classname) return 1;
    return a.attendancedate.localeCompare(b.attendancedate);
  });

  const attendanceCols = [
    { key: "attendancedate", label: "Date", render: v => formatDate(v) },
    { key: "classname", label: "Class" }, { key: "studentname", label: "Student" },
    { key: "status", label: "Status", render: v => <Badge color={v === "Present" ? "green" : "red"}>{v}</Badge> },
  ];

  const tabs = [
    { id: "teachers", label: "👩‍🏫 Teachers" },
    { id: "students", label: "👨‍🎓 Students" },
    { id: "attendance", label: "📋 Attendance" },
  ];

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: THEME.text, fontSize: "22px", fontWeight: 700 }}>📊 Reports</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveReport(t.id)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: activeReport === t.id ? THEME.primary : "#e2e8f0", color: activeReport === t.id ? "#fff" : THEME.text, transition: "all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeReport === "teachers" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{teachers.length} Teachers</span>
              {canExport && <ExportBar onExportCSV={() => exportToCSV(teachers, "Teachers_Report")} onExportPDF={() => exportToPDF("Teachers Report", teachers, teacherCols)} />}
            </div>
            <Table columns={teacherCols} data={teachers} />
          </div>
        </div>
      )}

      {activeReport === "students" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FormField label="Filter by Location">
              <Select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ width: 180 }}>
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Filter by Region">
              <Select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ width: 160 }}>
                <option value="">All Regions</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </Select>
            </FormField>
            <Btn variant="secondary" size="sm" onClick={() => { setLocationFilter(""); setRegionFilter(""); }}>Clear</Btn>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{filteredStudents.length} Students</span>
              {canExport && <ExportBar onExportCSV={() => exportToCSV(filteredStudents, "Students_Report")} onExportPDF={() => exportToPDF("Students Report", filteredStudents, studentCols)} />}
            </div>
            <Table columns={studentCols} data={filteredStudents} />
          </div>
        </div>
      )}

      {activeReport === "attendance" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FormField label="Date From">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 160 }} />
            </FormField>
            <FormField label="Date To">
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 160 }} />
            </FormField>
            <FormField label="Class">
              <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ width: 180 }}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.classname}</option>)}
              </Select>
            </FormField>
            <Btn variant="secondary" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setClassFilter(""); }}>Clear</Btn>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{filteredAttendance.length} Records (grouped by class)</span>
              {canExport && <ExportBar onExportCSV={() => exportToCSV(filteredAttendance, "Attendance_Report")} onExportPDF={() => exportToPDF("Attendance Report", filteredAttendance, attendanceCols)} />}
            </div>
            <Table columns={attendanceCols} data={filteredAttendance} />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function SchoolSystem() {

  
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { initLocalData(); }, []);

  const company = localDB.get("company")[0] || { name: "School System" };

  const handleLogin = (u) => { setUser(u); setActivePage("dashboard"); };
  const handleLogout = () => { setUser(null); setActivePage("dashboard"); };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const role = user.role;

  const navGroups = [
    {
      label: "MAIN", items: [
        { id: "dashboard",      icon: "📊", label: "Dashboard" },
        { id: "attendance",     icon: "📋", label: "Attendance" },
      ]
    },
    {
      label: "MASTERS", items: [
        { id: "company",        icon: "🏢", label: "Company" },
        { id: "users",          icon: "👤", label: "Users" },
        { id: "roles",          icon: "🔑", label: "Roles" },
        { id: "rolepermissions",icon: "🔒", label: "Role Permissions" },
        { id: "teachers",       icon: "👩‍🏫", label: "Teachers" },
        { id: "classes",        icon: "🏫", label: "Classes" },
        { id: "students",       icon: "👨‍🎓", label: "Students" },
        { id: "locations",      icon: "📍", label: "Locations" },
        { id: "payments",       icon: "💰", label: "Payments" },
      ]
    },
    {
      label: "TOOLS", items: [
        { id: "reports",        icon: "📈", label: "Reports" },
        { id: "changepassword", icon: "🔐", label: "Change Password" },
      ]
    }
  ].map(group => ({
    ...group,
    items: group.items.filter(item => hasPerm(role, item.id, "view"))
  }));

  const teachers = localDB.get("teachers");
  const classes = localDB.get("classes");
  const locations = localDB.get("locations");

  const pages = {
    dashboard: <Dashboard user={user} />,
    attendance: <AttendanceModule userRole={role} />,
    company: <CompanySettings userRole={role} />,
    reports: <Reports userRole={role} />,
    changepassword: <ChangePassword user={user} />,
    rolepermissions: <RolePermissions userRole={role} />,
    users: <CRUDPage title="Users" icon="👤" table="users" moduleKey="users" searchKey="name" userRole={role}
      columns={[
        { key: "userid", label: "User ID" }, { key: "name", label: "Name" },
        { key: "email", label: "Email" }, { key: "role", label: "Role" },
        { key: "active", label: "Status", render: v => <Badge color={v ? "green" : "gray"}>{v ? "Active" : "Inactive"}</Badge> },
      ]}
      formFields={[
        { key: "userid", label: "User ID", required: true },
        { key: "name", label: "Full Name", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "password", label: "Password", type: "password", required: true },
        { key: "role", label: "Role", type: "select", options: ROLES, required: true },
        { key: "active", label: "Active", type: "checkbox" },
      ]}
      defaultForm={{ userid: "", name: "", email: "", password: "", role: "Staff", active: true }}
    />,
    roles: <CRUDPage title="Roles" icon="🔑" table="roles" moduleKey="roles" searchKey="name" userRole={role}
      columns={[{ key: "id", label: "ID" }, { key: "name", label: "Role Name" }]}
      formFields={[{ key: "name", label: "Role Name", required: true }]}
      defaultForm={{ name: "" }}
    />,
    teachers: <CRUDPage title="Teachers" icon="👩‍🏫" table="teachers" moduleKey="teachers" searchKey="name" userRole={role}
      columns={[
        { key: "teacherid", label: "Teacher ID" }, { key: "name", label: "Name" },
        { key: "classname", label: "Class" }, { key: "position", label: "Position" },
        { key: "email", label: "Email" }, { key: "contact", label: "Contact" },
        { key: "joineddate", label: "Joined", render: v => formatDate(v) },
        { key: "active", label: "Status", render: v => <Badge color={v ? "green" : "gray"}>{v ? "Active" : "Inactive"}</Badge> },
      ]}
      formFields={[
        { key: "teacherid", label: "Teacher ID", required: true },
        { key: "name", label: "Full Name", required: true },
        { key: "classname", label: "Class Name", required: true },
        { key: "email", label: "Email", type: "email" },
        { key: "contact", label: "Contact No", type: "tel" },
        { key: "position", label: "Position", type: "select", options: POSITIONS },
        { key: "joineddate", label: "Joined Date", type: "date" },
        { key: "active", label: "Active", type: "checkbox" },
      ]}
      defaultForm={{ teacherid: "", name: "", classname: "", email: "", contact: "", position: "Teacher", joineddate: "", active: true }}
    />,
    classes: <CRUDPage title="Classes" icon="🏫" table="classes" moduleKey="classes" searchKey="classname" userRole={role}
      columns={[{ key: "classid", label: "Class ID" }, { key: "classname", label: "Class Name" }]}
      formFields={[{ key: "classid", label: "Class ID", required: true }, { key: "classname", label: "Class Name", required: true }]}
      defaultForm={{ classid: "", classname: "" }}
    />,
    students: <CRUDPage title="Students" icon="👨‍🎓" table="students" moduleKey="students" searchKey="name" userRole={role}
      columns={[
        { key: "studentid", label: "Student ID" },
        { key: "name",      label: "Name" },
        { key: "nin",       label: "NIN" },
        { key: "dob",       label: "Date of Birth", render: v => formatDate(v) },
        { key: "gender",    label: "Gender" },
        { key: "classid",   label: "Class", render: v => classes.find(c => c.id === parseInt(v))?.classname || v || "-" },
        { key: "parent1",   label: "Parent 1" },
        { key: "contact",   label: "Contact" },
        { key: "transport", label: "Transport" },
        { key: "joineddate",label: "Joined", render: v => formatDate(v) },
        { key: "active",    label: "Status", render: v => <Badge color={v ? "green" : "gray"}>{v ? "Active" : "Inactive"}</Badge> },
      ]}
      formFields={[
        { key: "studentid", label: "Student ID",         required: true },
        { key: "name",      label: "Full Name",          required: true },
        { key: "nin",       label: "NIN No" },
        { key: "dob",       label: "Date of Birth",      type: "date" },
        { key: "gender",    label: "Gender",             type: "select", options: ["Male", "Female", "Other"] },
        { key: "classid",   label: "Class",              type: "select", options: classes.map(c => ({ value: c.id, label: c.classname })) },
        { key: "parent1",   label: "Parent Name 1" },
        { key: "parent2",   label: "Parent Name 2" },
        { key: "contact",   label: "Contact No",         type: "tel" },
        { key: "email",     label: "Email",              type: "email" },
        { key: "locationid",label: "Location",           type: "select", options: locations.map(l => ({ value: l.id, label: l.name })) },
        { key: "transport", label: "Transport Required", type: "select", options: ["Yes", "No"] },
        { key: "joineddate",label: "Joined Date",        type: "date" },
        { key: "active",    label: "Active",             type: "checkbox" },
      ]}
      defaultForm={{ studentid: "", name: "", nin: "", dob: "", gender: "", classid: "", parent1: "", parent2: "", contact: "", email: "", locationid: "", transport: "No", joineddate: "", active: true }}
    />,
    locations: <CRUDPage title="Locations" icon="📍" table="locations" moduleKey="locations" searchKey="name" userRole={role}
      columns={[
        { key: "locationid", label: "Location ID" }, { key: "name", label: "Location Name" },
        { key: "region", label: "Region" },
      ]}
      formFields={[
        { key: "locationid", label: "Location ID", required: true },
        { key: "name", label: "Location Name", required: true },
        { key: "region", label: "Region", type: "select", options: REGIONS },
      ]}
      defaultForm={{ locationid: "", name: "", region: "North" }}
    />,
    payments: <CRUDPage title="Payments" icon="💰" table="payments" moduleKey="payments" searchKey="paymentdate" userRole={role}
      columns={[
        { key: "paymentdate", label: "Date", render: v => formatDate(v) },
        { key: "teacherid", label: "Teacher", render: v => teachers.find(t => t.id === v)?.name || v },
        { key: "amount", label: "Amount", render: v => `$${parseFloat(v || 0).toLocaleString()}` },
        { key: "paid", label: "Paid", render: v => <Badge color={v === "Yes" ? "green" : "red"}>{v}</Badge> },
      ]}
      formFields={[
        { key: "paymentdate", label: "Payment Date", type: "date", required: true },
        { key: "teacherid", label: "Teacher", type: "select", options: teachers.map(t => ({ value: t.id, label: t.name })), required: true },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "paid", label: "Paid", type: "select", options: ["Yes", "No"] },
      ]}
      defaultForm={{ paymentdate: "", teacherid: "", amount: "", paid: "No" }}
    />,
  };

  const currentPage = pages[activePage] || <Dashboard user={user} />;

  const sidebarWidth = 240;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: THEME.bg }}>
      {/* SIDEBAR OVERLAY (mobile) */}
      {sidebarOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }} onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside style={{ width: sidebarWidth, background: THEME.primary, flexShrink: 0, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, transform: sidebarOpen ? "translateX(0)" : "translateX(0)", transition: "transform 0.3s", overflowY: "auto" }}
        className="sidebar">
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {company.logo ? <img src={company.logo} alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} /> : <span style={{ fontSize: 28 }}>🏫</span>}
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{company.name}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>School System</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {navGroups.map(group => {
            const visibleItems = group.items;
            if (!visibleItems.length) return null;
            return (
              <div key={group.label}>
                <div style={{ padding: "8px 16px 4px", color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{group.label}</div>
                {visibleItems.map(item => (
                  <button key={item.id} onClick={() => { setActivePage(item.id); setSidebarOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: activePage === item.id ? 600 : 400, background: activePage === item.id ? "rgba(255,255,255,0.15)" : "transparent", color: activePage === item.id ? "#fff" : "rgba(255,255,255,0.75)", borderLeft: activePage === item.id ? "3px solid #f59e0b" : "3px solid transparent", transition: "all 0.2s" }}>
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: THEME.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 14 }}>{user.name[0]}</div>
            <div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{user.name}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{user.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: sidebarWidth, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{ background: "#fff", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: THEME.text }}>
              {ALL_MODULES.find(i => i.id === activePage)?.label || 
               navGroups.flatMap(g => g.items).find(i => i.id === activePage)?.label || 
               activePage.charAt(0).toUpperCase() + activePage.slice(1)}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge color="blue">{user.role}</Badge>
            <span style={{ fontSize: 13, color: THEME.muted }}>Welcome, {user.name.split(" ")[0]}</span>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "24px 20px" }}>
          {currentPage}
        </main>

        <footer style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: 12, color: THEME.muted }}>
          School Management System © {new Date().getFullYear()} — Demo Mode (localStorage)
        </footer>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-${sidebarWidth}px); }
        }
      `}</style>
    </div>
  );
}
