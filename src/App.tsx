import React, { useState, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { identifyFace } from './lib/gemini';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, CheckCircle2, XCircle, Camera, Clock, 
  Trash2, ShieldCheck, Loader2, Database, Settings, ArrowLeft,
  Activity, Users, FileLock, UserPlus, ScanFace, Code
} from 'lucide-react';

interface AttendanceLog {
  id: string;
  name: string;
  time: Date;
  status: 'success' | 'failed';
  message: string;
  confidence?: number;
}

export interface RegisteredUser {
  id: string;
  name: string;
  department: string;
  role: string;
  photo: string;
  registeredAt: Date;
}

export default function App() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [currentView, setCurrentView] = useState<'terminal' | 'admin'>('terminal');
  const [identifiedUser, setIdentifiedUser] = useState<RegisteredUser | null>(null);
  const [cameraMode, setCameraMode] = useState<'register' | 'verify' | null>(null);
  const [adminForm, setAdminForm] = useState({ name: '', department: '', role: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupabaseData = async () => {
      try {
        const { data: usersData, error: usersError } = await supabase.from('users').select('*').order('registered_at', { ascending: false });
        
        if (usersError) {
          if (usersError.code === '42P01' || usersError.code === 'PGRST106' || usersError.message?.includes('schema cache')) {
            setSupabaseError('The required tables do not exist in your Supabase database. Please set them up.');
            return;
          } else {
            console.error('Supabase users error:', usersError);
          }
        } else if (usersData) {
          setUsers(usersData.map((u: any) => ({
            id: u.id,
            name: u.name,
            department: u.department,
            role: u.role,
            photo: u.photo,
            registeredAt: new Date(u.registered_at)
          })));
        }

        const { data: logsData, error: logsError } = await supabase.from('logs').select('*').order('time', { ascending: false });
        if (!logsError && logsData) {
          setLogs(logsData.map((log: any) => ({
            id: log.id,
            name: log.name,
            time: new Date(log.time),
            status: log.status,
            message: log.message,
            confidence: log.confidence
          })));
        }
      } catch (err) {
        console.error('Failed to fetch from supabase:', err);
      }
    };
    
    fetchSupabaseData();
  }, []);

  const handleCapture = async (base64Photo: string) => {
    const currentMode = cameraMode;
    setCameraMode(null);
    setIsProcessing(true);
    
    if (currentMode === 'register') {
      setProcessMessage("Computing facial embeddings & storing profile in Supabase...");
      const newId = `USR-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      const newUser: RegisteredUser = {
        id: newId,
        name: adminForm.name || 'Unknown Reference',
        department: adminForm.department || 'General',
        role: adminForm.role || 'Personnel',
        photo: base64Photo,
        registeredAt: new Date()
      };
      
      // Save to Supabase
      const { error } = await supabase.from('users').insert({
        id: newUser.id,
        name: newUser.name,
        department: newUser.department,
        role: newUser.role,
        photo: newUser.photo,
        registered_at: newUser.registeredAt.toISOString()
      });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST106' || error.message?.includes('schema cache')) {
          setSupabaseError('Database tables not set up.');
          setIsProcessing(false);
          return;
        }
        console.error('Failed to save user:', error);
        alert(`Failed to save to database: ${error.message}`);
      } else {
        setUsers(prev => [newUser, ...prev]);
        setAdminForm({ name: '', department: '', role: '' });
      }
      
      setIsProcessing(false);
      return;
    }

    if (currentMode === 'verify') {
      if (users.length === 0) {
        alert("No personnel registered in the database.");
        setIsProcessing(false);
        return;
      }
      setProcessMessage("Running multi-face identification sequence...");
      try {
        const result = await identifyFace(users, base64Photo);
        let recognizedUser = null;
        if (result.match && result.matchedUserId) {
          recognizedUser = users.find(u => u.id === result.matchedUserId) || null;
        }

        const newLog: AttendanceLog = {
          id: Math.random().toString(36).substring(7),
          name: recognizedUser ? recognizedUser.name : 'Unknown Identity',
          time: new Date(),
          status: result.match ? 'success' : 'failed',
          message: result.reason,
          confidence: result.confidence
        };

        // Save log to Supabase
        const { error: logError } = await supabase.from('logs').insert({
          id: newLog.id,
          name: newLog.name,
          time: newLog.time.toISOString(),
          status: newLog.status,
          message: newLog.message,
          confidence: newLog.confidence
        });

        if (logError) {
          if (logError.code === '42P01' || logError.code === 'PGRST106' || logError.message?.includes('schema cache')) {
            setSupabaseError('Database tables not set up.');
          } else {
            console.error("Failed to save log:", logError);
            alert(`Failed to save log to database: ${logError.message}`);
          }
        }

        setLogs(prev => [newLog, ...prev]);

        if (recognizedUser) {
          setIdentifiedUser(recognizedUser);
        } else {
          setIdentifiedUser(null);
        }
      } catch (err) {
        console.error("Verification error", err);
        const newLog: AttendanceLog = {
          id: Math.random().toString(36).substring(7),
          name: 'System Error',
          time: new Date(),
          status: 'failed',
          message: 'Error connecting to Gemini verification engine.',
          confidence: 0
        };
        
        const { error: logError2 } = await supabase.from('logs').insert({
          id: newLog.id,
          name: newLog.name,
          time: newLog.time.toISOString(),
          status: newLog.status,
          message: newLog.message,
          confidence: newLog.confidence
        });

        if (logError2) {
          if (logError2.code === '42P01' || logError2.code === 'PGRST106' || logError2.message?.includes('schema cache')) {
            setSupabaseError('Database tables not set up.');
          } else {
            console.error("Failed to save log:", logError2);
          }
        }
        
        setLogs(prev => [newLog, ...prev]);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const TopBar = ({ title, showAdminBtn }: { title: string, showAdminBtn: boolean }) => (
    <header className="flex justify-between items-center bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg rounded-2xl md:rounded-3xl p-4 sm:p-6 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
          <ShieldCheck size={24} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-400/80 mb-0.5">Nexus Security</span>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {showAdminBtn ? (
           <button 
             onClick={() => setCurrentView('admin')} 
             className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-display text-sm font-medium transition-all text-slate-300 hover:text-white"
           >
             <Settings size={16} /> Server Admin
           </button>
        ) : (
           <button 
             onClick={() => setCurrentView('terminal')} 
             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-display text-sm font-medium transition-all text-slate-300 hover:text-white"
           >
             <ArrowLeft size={16} /> Back to Terminal
           </button>
        )}
        <div className="hidden lg:flex flex-col text-right">
          <div className="text-xl font-mono text-cyan-50">
            {new Date().toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );

  if (supabaseError) {
    const sqlCode = `create table users (
  id text primary key,
  name text,
  department text,
  role text,
  photo text,
  registered_at timestamp with time zone default timezone('utc'::text, now())
);

create table logs (
  id text primary key,
  name text,
  time timestamp with time zone default timezone('utc'::text, now()),
  status text,
  message text,
  confidence numeric
);

-- Note: Ensure Row Level Security (RLS) is disabled or properly configured for anonymous access
-- The easiest way for this prototype is:
alter table users disable row level security;
alter table logs disable row level security;`;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden relative selection:bg-cyan-500/30 flex flex-col p-4 sm:p-6 lg:p-8">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full max-w-4xl mx-auto w-full items-center justify-center">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl w-full">
            <div className="flex items-center gap-4 text-amber-400 mb-6 border-b border-white/10 pb-6">
              <Database size={32} />
              <div>
                <h1 className="text-2xl font-display font-bold">Supabase Database Setup Required</h1>
                <p className="text-sm text-slate-400">The necessary tables were not found in your Supabase project.</p>
              </div>
            </div>
            
            <p className="text-slate-300 mb-4 font-sans text-sm leading-relaxed">
              To complete the integration, please run the following SQL script in your Supabase project's SQL Editor. This will create the required <strong>users</strong> and <strong>logs</strong> tables.
            </p>
            <p className="text-amber-400 mb-6 font-sans text-xs bg-amber-400/10 p-3 rounded-lg border border-amber-400/20">
              <strong>Note:</strong> If you have already run this SQL and are still seeing this message, Supabase might be caching the schema. You can fix this by going to your Supabase Dashboard -&gt; Settings -&gt; API, and clicking <strong>Reload Cache</strong> under "Schema Cache", or just waiting a minute and reloading this page.
            </p>

            <div className="relative group rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-2 bg-slate-900 border-b border-white/10 text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>SQL Editor</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(sqlCode);
                    alert("SQL Copied to clipboard!");
                  }} 
                  className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
                >
                  <Code size={14} /> Copy Code
                </button>
              </div>
              <pre className="bg-[#0f172a] p-4 text-cyan-300 text-xs font-mono overflow-x-auto">
                {sqlCode}
              </pre>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => window.location.reload()} 
                className="w-full py-4 rounded-xl font-display font-bold uppercase tracking-widest text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all"
              >
                I've run the SQL, Reload App
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden relative selection:bg-cyan-500/30 flex flex-col p-4 sm:p-6 lg:p-8">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full">
          <TopBar title="Database Management" showAdminBtn={false} />

          <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            {/* Left: Registration Form */}
            <div className="lg:col-span-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                 <UserPlus className="text-cyan-400" size={24} />
                 <h2 className="text-sm font-display uppercase tracking-widest font-bold">New Personnel</h2>
              </div>
              
              <div className="flex flex-col gap-5 flex-1">
                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-2">Legal Name</label>
                  <input 
                    type="text" 
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({...adminForm, name: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono text-sm placeholder:text-slate-600"
                    placeholder="E.g. Sarah Connor"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-2">Department</label>
                  <input 
                    type="text" 
                    value={adminForm.department}
                    onChange={(e) => setAdminForm({...adminForm, department: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono text-sm placeholder:text-slate-600"
                    placeholder="E.g. Engineering"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-widest block mb-2">Security Role</label>
                  <input 
                    type="text" 
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({...adminForm, role: e.target.value})}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono text-sm placeholder:text-slate-600"
                    placeholder="E.g. Lead Architect"
                  />
                </div>
                
                <div className="mt-auto pt-8">
                  <button 
                    disabled={!adminForm.name || !adminForm.department || !adminForm.role}
                    onClick={() => setCameraMode('register')}
                    className="w-full py-4 rounded-xl font-display font-bold uppercase tracking-widest text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all disabled:opacity-30 disabled:hover:bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    <ScanFace size={16} />
                    Capture & Store Face
                  </button>
                </div>
              </div>
            </div>

            {/* Right: User Database */}
            <div className="lg:col-span-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <Users className="text-cyan-400" size={24} />
                    <h2 className="text-sm font-display uppercase tracking-widest font-bold">Registered Directory</h2>
                 </div>
                 <div className="text-xs font-mono px-3 py-1 bg-white/5 rounded-full border border-white/10 text-cyan-400">
                    {users.length} Records
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max pr-2">
                <AnimatePresence>
                  {users.map((u, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.05 }}
                      key={u.id} 
                      className="group border border-white/10 bg-black/20 hover:bg-white/5 rounded-2xl p-5 flex flex-col relative transition-colors"
                    >
                      <button 
                        onClick={() => {
                          if (window.confirm(`Revoke identity for ${u.name}?`)) {
                            setUsers(prev => prev.filter(x => x.id !== u.id));
                          }
                        }}
                        className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                      >
                         <Trash2 size={16} />
                      </button>
                      <div className="w-14 h-14 rounded-full overflow-hidden mb-4 border-2 border-white/10 shrink-0 shadow-lg">
                        <img src={u.photo} alt={u.name} className="w-full h-full object-cover grayscale mix-blend-screen" />
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">{u.id}</div>
                      <div className="text-base font-display font-bold truncate text-slate-100">{u.name}</div>
                      <div className="text-xs text-slate-400 mt-1 truncate">{u.role}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">{u.department}</div>
                      {(() => {
                         const userLog = logs.find(log => log.name === u.name && log.status === 'success');
                         return userLog ? (
                           <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
                             <div className="flex items-center gap-1.5">
                               <Clock size={12} className="text-emerald-400" />
                               <span>Last Entry</span>
                             </div>
                             <span className="text-emerald-400">
                               {userLog.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                             </span>
                           </div>
                         ) : (
                           <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-500">
                             <div className="flex items-center gap-1.5">
                               <Clock size={12} />
                               <span>No Entry</span>
                             </div>
                             <span>--:--</span>
                           </div>
                         );
                      })()}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {users.length === 0 && (
                   <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-500 gap-3">
                     <FileLock size={32} className="opacity-50" />
                     <p className="text-xs uppercase font-mono tracking-widest">Database is empty</p>
                   </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Modals... */}
        {cameraMode && (
          <CameraCapture 
            title="Biometric Setup"
            description="Align features for baseline capture."
            onCapture={handleCapture}
            onCancel={() => setCameraMode(null)}
          />
        )}
        
        <ProcessingModal isVisible={isProcessing} message={processMessage} />
      </div>
    );
  }

  // Terminal (Kiosk) UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-hidden relative selection:bg-cyan-500/30 flex flex-col p-4 sm:p-6 lg:p-8">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full">
        <TopBar title="Interactive Terminal" showAdminBtn={true} />

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          
          {/* Left Side: Scanner Viewport & Profile */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Main Visualizer */}
            <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 flex border-t-white/20 shadow-2xl relative overflow-hidden flex-col justify-center items-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-transparent opacity-80 pointer-events-none z-0"></div>
              
              <div className="relative z-10 w-full max-w-sm aspect-[4/5] rounded-[2rem] border border-white/10 bg-black/40 overflow-hidden flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                 {identifiedUser ? (
                    <>
                      <div className="absolute inset-0 z-0">
                         <img src={identifiedUser.photo} alt="Verified" className="w-full h-full object-cover opacity-30 grayscale blur-[2px] scale-105" />
                         <div className="absolute inset-0 bg-cyan-900/40 mix-blend-overlay"></div>
                      </div>
                      <div className="w-32 h-32 rounded-full border-2 border-cyan-400 p-1 relative z-10 bg-black/50 backdrop-blur-sm mb-6 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                        <img src={identifiedUser.photo} alt={identifiedUser.name} className="w-full h-full rounded-full object-cover grayscale mix-blend-screen" />
                      </div>
                      <h2 className="text-2xl font-display font-bold relative z-10">{identifiedUser.name}</h2>
                      <p className="text-cyan-400 font-mono text-sm mt-2 uppercase tracking-widest relative z-10">{identifiedUser.role}</p>
                      
                      <div className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full mt-6 flex items-center gap-2 text-xs font-bold tracking-widest uppercase relative z-10">
                        <CheckCircle2 size={16} /> Access Granted
                      </div>
                    </>
                 ) : (
                    <>
                       <div className="w-32 h-32 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-6 shadow-inner text-slate-600">
                          <ScanFace size={48} strokeWidth={1.5} />
                       </div>
                       <h2 className="text-xl font-display text-slate-300">Awaiting Subject</h2>
                       <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mt-2">{users.length} Profiles Local</p>
                    </>
                 )}
              </div>

              {/* Quick Actions overlay */}
              <div className="absolute bottom-8 right-8 z-20">
                <button 
                  onClick={() => {
                    setIdentifiedUser(null);
                    setCameraMode('verify');
                  }}
                  disabled={users.length === 0}
                  className="px-8 py-4 font-display font-bold uppercase tracking-[0.2em] text-xs rounded-2xl bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400 hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-3 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                >
                  <Camera size={18} /> Initialize Scan
                </button>
              </div>
            </div>

            {/* Hardware Status Bar */}
            <div className="h-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] px-8 flex items-center justify-between border-t-white/20 shadow-xl">
              <div className="flex gap-12">
                 <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Link Status</div>
                    <div className="flex items-center gap-2 text-sm font-bold font-display text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Secure
                    </div>
                 </div>
                 <div className="hidden sm:block">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Engine</div>
                    <div className="flex items-center gap-2 text-sm font-bold font-display text-cyan-400">
                       Google Gemini Flash
                    </div>
                 </div>
              </div>
              <div className="sm:hidden block">
                 <button onClick={() => setCurrentView('admin')} className="p-3 bg-white/5 border border-white/10 rounded-xl text-slate-400">
                    <Settings size={18} />
                 </button>
              </div>
            </div>
          </div>

          {/* Right Side: Activity List */}
          <div className="lg:col-span-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 lg:p-8 flex flex-col h-[600px] lg:h-auto border-t-white/20 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 text-cyan-400">
                <Activity size={20} />
                <h2 className="text-sm font-display uppercase tracking-widest font-bold text-white">Event Log</h2>
              </div>
              <span className="text-[10px] font-mono opacity-50 px-2 py-1 bg-white/5 rounded border border-white/10">Today: {logs.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-3">
              <AnimatePresence>
                {logs.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-slate-500 gap-3"
                  >
                     <Clock size={24} className="opacity-50" />
                     <p className="text-[10px] font-mono uppercase tracking-widest">No entries recorded</p>
                  </motion.div>
                ) : (
                  logs.map((log, i) => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`p-4 border rounded-2xl flex flex-col gap-3 transition-colors ${
                        log.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {log.status === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          </div>
                          <span className="text-sm font-bold font-display truncate text-slate-200">
                            {log.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {log.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 font-sans leading-relaxed line-clamp-2">
                        {log.message}
                      </div>
                      
                      {log.confidence !== undefined && (
                        <div className="flex items-center gap-3 mt-1">
                           <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round(log.confidence * 100)}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className={`h-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} 
                              />
                           </div>
                           <span className="text-[10px] font-mono text-slate-500 font-bold">
                             {Math.round(log.confidence * 100)}%
                           </span>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {logs.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <button 
                  onClick={() => setLogs([])}
                  className="w-full py-3 text-[10px] uppercase font-mono tracking-[0.2em] font-bold border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition-all rounded-xl"
                >
                  Clear Logs
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {cameraMode === 'verify' && (
        <CameraCapture 
          title="Security Verification"
          description="Focus within frame to initialize matching."
          onCapture={handleCapture}
          onCancel={() => setCameraMode(null)}
        />
      )}

      {/* Global Processing Modal */}
      <ProcessingModal isVisible={isProcessing} message={processMessage} />
    </div>
  );
}

// Extracted Processing Modal for reuse
function ProcessingModal({ isVisible, message }: { isVisible: boolean, message: string }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-8 sm:p-10 flex flex-col items-center gap-8 border border-white/10 bg-white/5 shadow-2xl rounded-[2rem] max-w-sm w-full mx-4 relative overflow-hidden"
          >
            {/* Ambient glow inner */}
            <div className="absolute top-0 center w-32 h-32 bg-cyan-500/20 blur-3xl rounded-full"></div>
            
            <div className="relative z-10 w-16 h-16 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
            
            <div className="space-y-3 text-center relative z-10 w-full">
               <h3 className="text-sm font-display uppercase tracking-[0.2em] font-bold text-white">Analysis in Progress</h3>
               <p className="text-xs font-mono text-cyan-400/80 tracking-wide break-words">{message}</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
