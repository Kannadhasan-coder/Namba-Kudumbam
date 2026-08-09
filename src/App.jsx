import React, { useEffect, useMemo, useState } from "react";
import {
  collection, addDoc, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc
} from "firebase/firestore";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "firebase/auth";
import { db, auth, firebaseReady } from "./firebase";
import {
  ShieldCheck, LockKeyhole, Users, MessageCircle, LogOut, Search,
  Send, Smile, Reply, Trash2, Eye, BarChart3, UserRound, X,
  MoreHorizontal, CheckCheck, Sparkles, Settings, ArrowLeft
} from "lucide-react";

const PEOPLE = [
  { name:"Akilan V", role:"Dady", photo:"/akilan.jpg", gender:"Male", about:"Family member" },
  { name:"Rithish N", role:"Naina", photo:"/rithish.jpg", gender:"Male", about:"Family member" },
  { name:"Khavin Balaji T", role:"Son", photo:"/khavin.jpg", gender:"Male", about:"Family member" },
  { name:"Muguthanraj T", role:"Marumagal", photo:"/muguthanraj.jpg", gender:"Male", about:"Family member" },
  { name:"Kannadhasan K", role:"Thatha", photo:"/kannadhasan.jpg", gender:"Male", about:"Family admin" },
  { name:"Vishwa M", role:"Son2", photo:"/vishwa.jpg", gender:"Male", about:"Family member" }
];

const emailFor = (name) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")}@nambafamily.local`;

function useAuthUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}

function useUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
  }, []);
  return users;
}

function Avatar({ person, size="md", online=false, onClick }) {
  return (
    <button className={`avatar-wrap ${size}`} onClick={onClick} title={person?.name || ""}>
      <img className="avatar" src={person?.photo || "/family-group.jpg"} alt="" />
      {online && <span className="online-dot" />}
    </button>
  );
}

function Gate({ onFamilyAccess, onAdminAccess }) {
  const [mode, setMode] = useState("family");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const endpoint = mode === "family" ? "/api/family-gate" : "/api/admin-gate";
    try {
      const r = await fetch(endpoint, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ code, password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Access denied.");
      mode === "family" ? onFamilyAccess() : await onAdminAccess(code, password);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="gate">
      <div className="gate-orb orb-a"/><div className="gate-orb orb-b"/>
      <section className="gate-card glass">
        <div className="brand-mark"><Sparkles size={20}/></div>
        <p className="eyebrow">PRIVATE FAMILY SPACE</p>
        <h1>Namba <span>Family</span></h1>
        <p className="muted">A private place for family conversations.</p>
        <div className="gate-tabs">
          <button className={mode==="family"?"active":""} onClick={()=>setMode("family")}>Family Login</button>
          <button className={mode==="admin"?"active":""} onClick={()=>setMode("admin")}>Admin Login</button>
        </div>
        <form onSubmit={submit} className="stack">
          <label>{mode==="family" ? "Family code" : "Admin code"}
            <div className="input-icon"><LockKeyhole size={17}/><input value={code} onChange={e=>setCode(e.target.value)} placeholder={mode==="family"?"Enter family code":"Enter admin code"} required /></div>
          </label>
          <label>Password
            <div className="input-icon"><ShieldCheck size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required /></div>
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary-btn" disabled={busy}>{busy ? "Checking…" : "Continue"} <ArrowLeft size={17} className="rotate-180"/></button>
        </form>
        <div className="secure-note"><ShieldCheck size={15}/> Server-checked gate • Firebase protected chat</div>
      </section>
    </main>
  );
}

function CharacterPicker({ onLogin, familyUsers }) {
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const merged = PEOPLE.map(p => ({
    ...p, ...(familyUsers.find(u => u.name === p.name) || {})
  }));

  async function login(e) {
    e.preventDefault();
    if (!selected || !auth) return;
    setBusy(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, emailFor(selected.name), password);
      await setDoc(doc(db, "presence", selected.id), { online:true, lastSeen:serverTimestamp() }, { merge:true });
      onLogin();
    } catch { setError("Wrong password or Firebase is not configured yet."); }
    finally { setBusy(false); }
  }

  return (
    <main className="picker">
      <div className="picker-head">
        <div><p className="eyebrow">WELCOME HOME</p><h2>Choose your family profile</h2><p className="muted">Tap a character to zoom in, then enter their private password.</p></div>
        <img className="mini-group" src="/family-group.jpg" alt="" />
      </div>
      <div className="people-grid">
        {merged.map((p, i) => (
          <button key={p.name} className={`person-card ${selected?.name===p.name?"selected":""}`} onClick={()=>{setSelected(p);setPassword("");setError("");}}>
            <div className="person-photo"><img src={p.photo} alt=""/><span className="pulse-ring"/></div>
            <div><strong>{p.name}</strong><span>{p.role}</span></div>
            <div className="card-number">0{i+1}</div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="login-overlay" onClick={()=>setSelected(null)}>
          <div className="character-login glass" onClick={e=>e.stopPropagation()}>
            <button className="icon-btn close" onClick={()=>setSelected(null)}><X/></button>
            <img src={selected.photo} className="zoom-photo" alt=""/>
            <p className="eyebrow">PRIVATE PROFILE</p>
            <h2>{selected.name}</h2><p className="role-pill">{selected.role}</p>
            <form onSubmit={login} className="stack compact">
              <label>Password
                <input type="password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter profile password" required/>
              </label>
              {error && <div className="error">{error}</div>}
              <button className="primary-btn" disabled={busy}>{busy?"Signing in…":"Enter chat"} <ArrowLeft size={17} className="rotate-180"/></button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function ProfileModal({ person, onClose }) {
  if (!person) return null;
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="profile-modal glass" onClick={e=>e.stopPropagation()}>
      <button className="icon-btn close" onClick={onClose}><X/></button>
      <img className="profile-big" src={person.photo} alt=""/>
      <p className="eyebrow">FAMILY PROFILE</p>
      <h2>{person.name}</h2>
      <span className="role-pill">{person.role}</span>
      <div className="profile-facts">
        <div><span>Gender</span><b>{person.gender || "—"}</b></div>
        <div><span>About</span><b>{person.about || "Family member"}</b></div>
      </div>
      <p className="locked-note"><LockKeyhole size={14}/> Name, role and photo are fixed by admin.</p>
    </div>
  </div>
}

function usePresence(userId, users) {
  const [presence, setPresence] = useState({});
  useEffect(() => {
    if (!db || !users.length) return;
    const unsubs = users.map(u => onSnapshot(doc(db, "presence", u.id), s => {
      setPresence(p => ({...p, [u.id]:s.exists() ? s.data() : {}}));
    }));
    return () => unsubs.forEach(u => u());
  }, [users.length]);
  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, "presence", userId);
    setDoc(ref, { online:true, lastSeen:serverTimestamp() }, { merge:true });
    const handler = () => setDoc(ref, { online:false, lastSeen:serverTimestamp() }, { merge:true });
    window.addEventListener("beforeunload", handler);
    return () => { handler(); window.removeEventListener("beforeunload", handler); };
  }, [userId]);
  return presence;
}

function ChatRoom({ currentUser, users, conversation, spectate=false, onProfile }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [reactionMenu, setReactionMenu] = useState(null);
  const presence = usePresence(currentUser?.uid, users);
  const member = conversation?.memberIds?.map(id=>users.find(u=>u.id===id)).filter(Boolean) || [];
  const title = conversation?.type === "group" ? "Namba Family" :
    member.filter(x=>x.id !== currentUser?.uid).map(x=>x.name).join(" & ");

  useEffect(() => {
    if (!db || !conversation?.id) return;
    const q = query(collection(db, "conversations", conversation.id, "messages"), orderBy("createdAt","asc"), limit(300));
    return onSnapshot(q, snap => setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [conversation?.id]);

  async function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || spectate) return;
    if (clean.length > 1000) return;
    await addDoc(collection(db, "conversations", conversation.id, "messages"), {
      senderId:currentUser.uid, senderName:currentUser.displayName || "Family",
      text:clean, createdAt:serverTimestamp(),
      replyTo: replyTo ? { id:replyTo.id, text:replyTo.text, senderName:replyTo.senderName } : null,
      reactions:{}
    });
    setText(""); setReplyTo(null);
  }

  async function deleteMine(m) {
    if (m.senderId !== currentUser.uid) return;
    await deleteDoc(doc(db, "conversations", conversation.id, "messages", m.id));
  }

  async function react(m, emoji) {
    const current = m.reactions || {};
    const list = Array.isArray(current[emoji]) ? current[emoji] : [];
    const next = list.includes(currentUser.uid) ? list.filter(x=>x!==currentUser.uid) : [...list,currentUser.uid];
    await updateDoc(doc(db, "conversations", conversation.id, "messages", m.id), {
      reactions:{...current, [emoji]:next}
    });
    setReactionMenu(null);
  }

  return <section className="chat-panel">
    <header className="chat-head">
      <div className="chat-title">
        <div className="stack-avatars">{member.slice(0,3).map(p=><Avatar key={p.id} person={p} size="sm" online={!!presence[p.id]?.online} onClick={()=>onProfile(p)}/>)}</div>
        <div><h3>{title}</h3><span>{conversation?.type==="group" ? `${member.length} family members` : "Private 1-to-1 chat"} • {member.filter(p=>presence[p.id]?.online).length} online</span></div>
      </div>
      <div className="chat-actions">
        {spectate && <span className="spectate-chip"><Eye size={14}/> Spectate</span>}
        <button className="icon-btn"><Search size={18}/></button>
        <button className="icon-btn"><MoreHorizontal size={18}/></button>
      </div>
    </header>

    <div className="messages">
      <div className="day-divider"><span>Today</span></div>
      {messages.map(m => {
        const mine = m.senderId === currentUser.uid;
        const sender = users.find(u=>u.id===m.senderId);
        return <div className={`message-row ${mine?"mine":""}`} key={m.id}>
          {!mine && <Avatar person={sender || {photo:"/family-group.jpg",name:m.senderName}} size="xs" onClick={()=>sender&&onProfile(sender)}/>}
          <div className="message-stack">
            {!mine && conversation.type==="group" && <span className="sender-name">{m.senderName}</span>}
            <div className="message-bubble">
              {m.replyTo && <div className="reply-preview"><Reply size={12}/><span><b>{m.replyTo.senderName}</b>{m.replyTo.text}</span></div>}
              <div className="message-text">{m.text}</div>
              <div className="message-meta"><span>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "sending…"}</span>{mine && <CheckCheck size={14}/>}</div>
            </div>
            {Object.entries(m.reactions || {}).filter(([,v])=>Array.isArray(v)&&v.length).length>0 &&
              <div className="reactions">{Object.entries(m.reactions).filter(([,v])=>Array.isArray(v)&&v.length).map(([emo,v])=><button key={emo} onClick={()=>react(m,emo)}>{emo} {v.length}</button>)}</div>}
            {!spectate && <div className="message-tools">
              <button onClick={()=>setReplyTo(m)}><Reply size={13}/> Reply</button>
              <button onClick={()=>setReactionMenu(reactionMenu===m.id?null:m.id)}><Smile size={13}/> React</button>
              {mine && <button onClick={()=>deleteMine(m)}><Trash2 size={13}/> Delete</button>}
              {reactionMenu===m.id && <div className="reaction-pop">{["❤️","😂","👍","😮","😢","🔥"].map(e=><button key={e} onClick={()=>react(m,e)}>{e}</button>)}</div>}
            </div>}
          </div>
        </div>
      })}
      {!messages.length && <div className="empty-chat"><MessageCircle size={34}/><h3>No messages yet</h3><p>Start a conversation with the family.</p></div>}
    </div>

    {replyTo && !spectate && <div className="reply-bar"><Reply size={16}/><div><b>Replying to {replyTo.senderName}</b><span>{replyTo.text}</span></div><button onClick={()=>setReplyTo(null)}><X size={17}/></button></div>}
    {!spectate && <form className="composer" onSubmit={send}>
      <button type="button" className="icon-btn"><Smile/></button>
      <input value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message…" maxLength={1000}/>
      <span className="char-count">{text.length}/1000</span>
      <button className="send-btn" disabled={!text.trim()}><Send size={18}/></button>
    </form>}
  </section>
}

function Sidebar({ currentUser, users, presence, conversations, selectedId, onSelect, onProfile, onLogout, admin, onAdmin }) {
  const [search, setSearch] = useState("");
  const me = users.find(u=>u.id===currentUser?.uid);
  const filtered = users.filter(u=>u.id!==currentUser?.uid && u.name.toLowerCase().includes(search.toLowerCase()));
  return <aside className="sidebar">
    <div className="side-brand"><div className="brand-mark"><Sparkles size={18}/></div><div><b>Namba Family</b><span>Private chat</span></div></div>
    <div className="my-card">
      <Avatar person={me || {photo:"/family-group.jpg"}} size="md" online/>
      <div><b>{me?.name || currentUser?.displayName}</b><span>{me?.role || "Member"}</span></div>
      <button className="icon-btn" onClick={()=>me&&onProfile(me)}><UserRound size={17}/></button>
    </div>
    <div className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search family"/></div>
    <div className="section-label">CHATS</div>
    <button className={`chat-list-item ${selectedId==="family-group"?"active":""}`} onClick={()=>onSelect("family-group")}>
      <div className="group-avatar"><Users size={18}/></div>
      <div><b>Namba Family</b><span>Family Group</span></div><span className="online-count">{users.filter(u=>presence[u.id]?.online).length}</span>
    </button>
    {filtered.map(u=>{
      const c = conversations.find(x=>x.type==="personal" && x.memberIds?.includes(currentUser.uid) && x.memberIds?.includes(u.id));
      return <button className={`chat-list-item ${selectedId===c?.id?"active":""}`} key={u.id} onClick={()=>c&&onSelect(c.id)}>
        <Avatar person={u} size="sm" online={!!presence[u.id]?.online} onClick={(e)=>{e?.stopPropagation?.();onProfile(u)}}/>
        <div><b>{u.name}</b><span>{u.role}</span></div>
        {presence[u.id]?.online && <span className="live">online</span>}
      </button>
    })}
    <div className="side-bottom">
      {admin && <button className="admin-btn" onClick={onAdmin}><BarChart3 size={17}/> Admin Console</button>}
      <button className="logout-btn" onClick={onLogout}><LogOut size={17}/> Sign out</button>
    </div>
  </aside>
}

function AdminConsole({ users, conversations, onClose, currentUser }) {
  const [tab, setTab] = useState("analytics");
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [spectateId, setSpectateId] = useState(null);

  useEffect(() => {
    fetch("/api/admin-analytics").then(r=>r.json()).then(setStats).catch(()=>{});
  }, []);

  async function deleteAllChat() {
    if (!confirm("Delete ALL family chat messages? This cannot be undone.")) return;
    const r = await fetch("/api/admin-delete-all", { method:"POST" });
    const data = await r.json();
    if (!r.ok) return setNotice(data.message || "Delete failed.");
    setNotice(`Deleted ${data.deleted} messages.`);
    setStats(null);
  }

  return <div className="admin-overlay">
    <div className="admin-panel glass">
      <header className="admin-head">
        <div><p className="eyebrow">KANNADHASAN K • ADMIN</p><h2>Admin Console</h2><span>Full access • moderation • analytics • spectate</span></div>
        <button className="icon-btn" onClick={onClose}><X/></button>
      </header>
      <nav className="admin-tabs">
        <button className={tab==="analytics"?"active":""} onClick={()=>setTab("analytics")}><BarChart3 size={16}/> Analytics</button>
        <button className={tab==="members"?"active":""} onClick={()=>setTab("members")}><Users size={16}/> Members</button>
        <button className={tab==="spectate"?"active":""} onClick={()=>setTab("spectate")}><Eye size={16}/> Spectate</button>
        <button className="danger-tab" onClick={deleteAllChat}><Trash2 size={16}/> Delete all chat</button>
      </nav>
      {notice && <div className="notice">{notice}</div>}
      {tab==="analytics" && <div className="analytics-grid">
        <div className="stat"><span>Conversations</span><b>{stats?.conversations ?? conversations.length}</b></div>
        <div className="stat"><span>Messages</span><b>{stats?.messageCount ?? "—"}</b></div>
        <div className="stat"><span>Estimated text data</span><b>{stats ? `${stats.estimatedKB} KB` : "—"}</b></div>
        <div className="stat"><span>Message budget</span><b>{import.meta.env.VITE_MAX_MESSAGE_BUDGET || "100k"}</b></div>
        <div className="analytics-note"><ShieldCheck size={18}/><div><b>Security model</b><p>Passwords stay in Firebase Authentication. Firestore Rules require authenticated members; admin access uses a custom admin claim. The server gate secrets are Vercel environment variables.</p></div></div>
      </div>}
      {tab==="members" && <div className="member-admin-list">
        {users.map(u=><div className="member-admin-row" key={u.id}><Avatar person={u} size="sm"/><div><b>{u.name}</b><span>{u.role}</span></div><button className="small-btn" onClick={()=>setSelected(u)}>View profile</button></div>)}
        {selected && <ProfileModal person={selected} onClose={()=>setSelected(null)}/>}
      </div>}
      {tab==="spectate" && <div className="spectate-list">
        <p className="muted">Open any conversation in read-only mode. Replies and reactions are disabled.</p>
        {conversations.map(c=><button key={c.id} className="spectate-row" onClick={()=>setSpectateId(c.id)}><Eye size={16}/><span>{c.title || c.id}</span><span>{c.type}</span></button>)}
        {spectateId && <div className="spectate-help"><Eye size={16}/> Spectate mode is available from the main chat by choosing a conversation and enabling read-only mode.</div>}
      </div>}
    </div>
  </div>
}

function MainApp({ adminMode=false }) {
  const currentUser = useAuthUser();
  const users = useUsers();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("family-group");
  const [profile, setProfile] = useState(null);
  const [adminOpen, setAdminOpen] = useState(adminMode);
  const [spectate, setSpectate] = useState(false);
  const presence = usePresence(currentUser?.uid, users);

  useEffect(() => {
    if (!db || !currentUser) return;
    return onSnapshot(collection(db, "conversations"), snap => {
      setConversations(snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.memberIds?.includes(currentUser.uid)));
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedId && conversations.length) setSelectedId(conversations[0].id);
  }, [conversations.length]);

  if (!currentUser) return <div className="loading-screen"><Sparkles/><span>Opening your family space…</span></div>;

  const selected = conversations.find(c=>c.id===selectedId) || conversations.find(c=>c.id==="family-group");
  const allConversations = adminMode ? conversations : conversations;
  const [claims, setClaims] = useState(null);
  useEffect(() => { currentUser.getIdTokenResult(true).then(r => setClaims(r.claims)).catch(() => setClaims(null)); }, [currentUser]);
  const isAdmin = adminMode || claims?.admin === true;

  return <div className="app-shell">
    <Sidebar currentUser={currentUser} users={users} presence={presence} conversations={allConversations} selectedId={selectedId} onSelect={setSelectedId} onProfile={setProfile} onLogout={()=>signOut(auth)} admin={isAdmin} onAdmin={()=>setAdminOpen(true)}/>
    <main className="main-area">
      <div className="mobile-top"><b>Namba Family</b><button className="icon-btn" onClick={()=>setAdminOpen(true)}><Settings size={18}/></button></div>
      <ChatRoom currentUser={currentUser} users={users} conversation={selected} spectate={spectate} onProfile={setProfile}/>
      <div className="floating-controls">
        <button className={spectate?"active":""} onClick={()=>setSpectate(v=>!v)}><Eye size={15}/> {spectate?"Spectating":"Spectate"}</button>
      </div>
    </main>
    <ProfileModal person={profile} onClose={()=>setProfile(null)}/>
    {adminOpen && isAdmin && <AdminConsole users={users} conversations={allConversations} onClose={()=>setAdminOpen(false)} currentUser={currentUser}/>}
  </div>
}

export default function App() {
  const [familyAccess, setFamilyAccess] = useState(false);
  const [adminAccess, setAdminAccess] = useState(false);
  const [familyUsers, setFamilyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const authUser = useAuthUser();

  useEffect(() => {
    if (!firebaseReady || !db) { setLoading(false); return; }
    return onSnapshot(collection(db, "users"), snap => {
      setFamilyUsers(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  if (!firebaseReady) return <SetupScreen/>;
  if (loading) return <div className="loading-screen"><Sparkles/><span>Preparing Namba Family…</span></div>;
  if (authUser) return <MainApp adminMode={adminAccess}/>;
  if (!familyAccess) return <Gate onFamilyAccess={()=>setFamilyAccess(true)} onAdminAccess={async (code, password)=>{
    try {
      await signInWithEmailAndPassword(auth, emailFor("Kannadhasan K"), password);
      setAdminAccess(true);
    } catch {
      throw new Error("Admin Firebase account is not ready. Run the seed script first.");
    }
  }}/>;
  return <CharacterPicker familyUsers={familyUsers} onLogin={()=>{}}/>;
}

function SetupScreen() {
  return <main className="gate">
    <section className="gate-card glass">
      <div className="brand-mark"><Settings size={20}/></div>
      <p className="eyebrow">ONE-TIME SETUP</p>
      <h1>Namba <span>Family</span></h1>
      <p className="muted">The UI is ready, but Firebase is not configured yet.</p>
      <div className="setup-list">
        <div><b>1</b><span>Create a Firebase project and enable Email/Password Auth + Firestore.</span></div>
        <div><b>2</b><span>Copy <code>.env.example</code> to <code>.env.local</code> and add your Firebase web config.</span></div>
        <div><b>3</b><span>Run <code>npm install</code>, then seed the six Firebase accounts with <code>npm run seed</code>.</span></div>
        <div><b>4</b><span>Deploy to Vercel and add the server-side gate secrets in Project Settings → Environment Variables.</span></div>
      </div>
      <p className="secure-note"><ShieldCheck size={15}/> No passwords are embedded in the React bundle.</p>
    </section>
  </main>
}