import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Users, 
  Send, 
  Settings, 
  LogOut, 
  Upload, 
  Download,
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  LayoutDashboard,
  History,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  Trash2,
  FileText,
  Zap,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// --- Types ---
interface Contact {
  id: number;
  name: string;
  phone: string;
}

interface MessageLog {
  id: number;
  phone: string;
  content: string;
  status: 'sent' | 'failed' | 'pending';
  timestamp: string;
}

interface Template {
  id: number;
  name: string;
  content: string;
}

interface AutoReply {
  id: number;
  keyword: string;
  response: string;
  enabled: number;
}

type ConnectionStatus = 'connecting' | 'open' | 'close' | 'qr';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
        : 'text-slate-500 hover:bg-slate-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'campaign' | 'history' | 'settings'>('dashboard');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [qr, setQr] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket
    socketRef.current = io();

    socketRef.current.on('whatsapp-status', (data: { status: ConnectionStatus, qr?: string, userPhone?: string }) => {
      setStatus(data.status);
      if (data.qr) setQr(data.qr);
      if (data.userPhone) setUserPhone(data.userPhone);
    });

    socketRef.current.on('send-progress', (data: { phone: string, status: 'sent' | 'failed' }) => {
      setSendingProgress(prev => ({ ...prev, current: prev.current + 1 }));
      fetchHistory();
    });

    // Initial data fetch
    fetchStatus();
    fetchContacts();
    fetchHistory();
    fetchTemplates();
    fetchAutoReplies();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data.status);
      setQr(data.qr);
      setUserPhone(data.userPhone);
    } catch (e) {
      console.error('Failed to fetch status');
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (e) {
      console.error('Failed to fetch contacts');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch history');
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (e) {
      console.error('Failed to fetch templates');
    }
  };

  const fetchAutoReplies = async () => {
    try {
      const res = await fetch('/api/autoreplies');
      const data = await res.json();
      setAutoReplies(data);
    } catch (e) {
      console.error('Failed to fetch auto replies');
    }
  };

  const saveTemplate = async () => {
    if (!newTemplateName || !message) return;
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName, content: message }),
      });
      setNewTemplateName('');
      fetchTemplates();
    } catch (e) {
      console.error('Failed to save template');
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {
      console.error('Failed to delete template');
    }
  };

  const saveAutoReply = async () => {
    if (!newKeyword || !newResponse) return;
    try {
      await fetch('/api/autoreplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword, response: newResponse }),
      });
      setNewKeyword('');
      setNewResponse('');
      fetchAutoReplies();
    } catch (e) {
      console.error('Failed to save auto reply');
    }
  };

  const deleteAutoReply = async (id: number) => {
    try {
      await fetch(`/api/autoreplies/${id}`, { method: 'DELETE' });
      fetchAutoReplies();
    } catch (e) {
      console.error('Failed to delete auto reply');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  const deleteContact = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
      setSelectedContactIds(prev => prev.filter(i => i !== id));
    } catch (e) {
      console.error('Delete failed');
    }
  };

  const clearAllContacts = async () => {
    if (!confirm('Are you sure you want to delete ALL contacts?')) return;
    try {
      await fetch('/api/contacts', { method: 'DELETE' });
      fetchContacts();
      setSelectedContactIds([]);
    } catch (e) {
      console.error('Clear failed');
    }
  };

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear message history?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      fetchHistory();
    } catch (e) {
      console.error('Clear history failed');
    }
  };

  const downloadDemoCSV = () => {
    const headers = 'name,phone\n';
    const rows = [
      'John Doe,1234567890',
      'Jane Smith,0987654321',
      'Sample Business,5550123456'
    ].join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'contacts_demo.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleContactSelection = (id: number) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map(c => c.id));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchContacts();
      }
    } catch (e) {
      console.error('Import failed');
    }
  };

  const handleSendBulk = async () => {
    const targetContacts = contacts.filter(c => selectedContactIds.includes(c.id));
    if (!message || targetContacts.length === 0) return;
    
    setIsSending(true);
    setSendingProgress({ current: 0, total: targetContacts.length });
    
    try {
      await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contacts: targetContacts }),
      });
    } catch (e) {
      console.error('Bulk send failed');
      setIsSending(false);
    }
  };

  const stats = {
    total: contacts.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
  };
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      fetchStatus();
    } catch (e) {
      console.error('Logout failed');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <MessageSquare size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">WA Pro</h1>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Contacts" 
            active={activeTab === 'contacts'} 
            onClick={() => setActiveTab('contacts')} 
          />
          <SidebarItem 
            icon={Send} 
            label="Campaign" 
            active={activeTab === 'campaign'} 
            onClick={() => setActiveTab('campaign')} 
          />
          <SidebarItem 
            icon={History} 
            label="History" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <SidebarItem 
            icon={Settings} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <p className="text-slate-500">Manage your WhatsApp marketing campaigns efficiently.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {status === 'open' ? 'Connected' : status === 'qr' ? 'Waiting for Scan' : 'Disconnected'}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Connection Card */}
                <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-xl font-bold mb-2">WhatsApp Connection</h3>
                      <p className="text-slate-500 text-sm">Scan the QR code with your WhatsApp app to start.</p>
                    </div>
                    <QrCode className="text-slate-300" size={32} />
                  </div>

                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    {status === 'qr' && qr ? (
                      <div className="bg-white p-6 rounded-2xl shadow-xl">
                        <QRCodeSVG value={qr} size={256} />
                        <p className="mt-4 text-center text-sm font-medium text-slate-600">Scan this QR code</p>
                      </div>
                    ) : status === 'open' ? (
                      <div className="text-center">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-emerald-700">Connected Successfully</h4>
                        <p className="text-slate-500 mt-2">You are ready to send messages.</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Loader2 className="animate-spin text-slate-400 mx-auto mb-4" size={40} />
                        <p className="text-slate-500">Initializing WhatsApp connection...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-6">Quick Stats</h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Total Contacts</span>
                        <span className="text-2xl font-bold">{stats.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Messages Sent</span>
                        <span className="text-2xl font-bold text-emerald-500">{stats.sent}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Failed</span>
                        <span className="text-2xl font-bold text-rose-500">{stats.failed}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('campaign')}
                    className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    Start New Campaign
                  </button>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold mb-8">Campaign Performance</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Sent', value: stats.sent, color: '#10b981' },
                      { name: 'Failed', value: stats.failed, color: '#f43f5e' }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                        {[
                          { name: 'Sent', value: stats.sent, color: '#10b981' },
                          { name: 'Failed', value: stats.failed, color: '#f43f5e' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'contacts' && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={downloadDemoCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                    >
                      <Download size={18} />
                      Download Demo
                    </button>
                    <button 
                      onClick={clearAllContacts}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors"
                    >
                      Clear All
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium cursor-pointer hover:bg-emerald-600 transition-colors">
                      <Upload size={18} />
                      Import CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-4 font-semibold w-10">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            checked={filteredContacts.length > 0 && selectedContactIds.length === filteredContacts.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-8 py-4 font-semibold">Name</th>
                        <th className="px-8 py-4 font-semibold">Phone Number</th>
                        <th className="px-8 py-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredContacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                              checked={selectedContactIds.includes(contact.id)}
                              onChange={() => toggleContactSelection(contact.id)}
                            />
                          </td>
                          <td className="px-8 py-4 font-medium">{contact.name}</td>
                          <td className="px-8 py-4 text-slate-500">{contact.phone}</td>
                          <td className="px-8 py-4">
                            <button 
                              onClick={() => deleteContact(contact.id)}
                              className="text-rose-500 hover:underline text-sm font-medium"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredContacts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                            {searchQuery ? 'No contacts match your search.' : 'No contacts found. Import a CSV file to get started.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Activity Section within Contacts */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold">Recent Activity</h3>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="text-sm font-medium text-emerald-600 hover:underline"
                  >
                    View All History
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-4 font-semibold">Phone</th>
                        <th className="px-8 py-4 font-semibold">Message</th>
                        <th className="px-8 py-4 font-semibold">Status</th>
                        <th className="px-8 py-4 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.slice(0, 5).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4 font-medium">+{log.phone}</td>
                          <td className="px-8 py-4 text-slate-500 max-w-xs truncate">{log.content}</td>
                          <td className="px-8 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-slate-400 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-8 py-10 text-center text-slate-400">
                            No recent activity.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'campaign' && (
            <motion.div
              key="campaign"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-8">
                {/* Sender Info */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Sender Information</h3>
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-medium">
                      <CheckCircle2 size={16} />
                      Verified Account
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                      <Users size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Connected Number</p>
                      <p className="text-lg font-bold text-slate-900">{userPhone ? `+${userPhone}` : 'Not Connected'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Compose Message</h3>
                    <div className="flex gap-2">
                      <select 
                        onChange={(e) => {
                          const t = templates.find(t => t.id === Number(e.target.value));
                          if (t) setMessage(t.content);
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Load Template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Message Content</label>
                      <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full h-48 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
                        placeholder="Hello {name}, check out our latest offers!"
                      />
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-xs text-slate-400">Use {'{name}'} to personalize your message.</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Template Name"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="px-3 py-1 text-xs rounded-lg border border-slate-200 outline-none"
                          />
                          <button 
                            onClick={saveTemplate}
                            className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                          >
                            <Plus size={14} />
                            Save as Template
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
                      <AlertCircle size={20} />
                      <p className="text-sm">We recommend adding a random delay between messages to avoid being flagged as spam.</p>
                    </div>
                  </div>
                </div>

                {/* Target Selection in Campaign Tab */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Target Contacts</h3>
                    <button 
                      onClick={toggleSelectAll}
                      className="text-sm font-medium text-emerald-600 hover:underline"
                    >
                      {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {contacts.map(contact => (
                      <div 
                        key={contact.id}
                        onClick={() => toggleContactSelection(contact.id)}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                          selectedContactIds.includes(contact.id)
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            selectedContactIds.includes(contact.id)
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-300'
                          }`}>
                            {selectedContactIds.includes(contact.id) && <CheckCircle2 size={14} />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{contact.name}</p>
                            <p className="text-sm text-slate-500">+{contact.phone}</p>
                          </div>
                        </div>
                        {selectedContactIds.includes(contact.id) ? (
                          <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Included</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Excluded</span>
                        )}
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                        <Users size={40} className="mx-auto mb-2 opacity-20" />
                        <p>No contacts available. Please import some first.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold mb-6">Campaign Summary</h3>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Contacts</span>
                      <span className="font-bold">{contacts.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Selected Contacts</span>
                      <span className="font-bold text-emerald-600">{selectedContactIds.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Estimated Time</span>
                      <span className="font-bold">~{Math.ceil(selectedContactIds.length * 4 / 60)} mins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Connection Status</span>
                      <span className={`font-bold ${status === 'open' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {status === 'open' ? 'Ready' : 'Not Connected'}
                      </span>
                    </div>
                  </div>

                  <button 
                    disabled={status !== 'open' || isSending || !message || selectedContactIds.length === 0}
                    onClick={handleSendBulk}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <Loader2 className="animate-spin" size={20} />
                          <span>Sending...</span>
                        </div>
                        <span className="text-[10px] opacity-80">{sendingProgress.current} / {sendingProgress.total}</span>
                      </div>
                    ) : (
                      <Send size={20} />
                    )}
                    {!isSending && 'Launch Campaign'}
                  </button>
                  
                  {isSending && (
                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="bg-emerald-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">Message History</h3>
                <button 
                  onClick={clearHistory}
                  className="text-sm font-medium text-rose-500 hover:underline"
                >
                  Clear History
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                    <tr>
                      <th className="px-8 py-4 font-semibold">Phone</th>
                      <th className="px-8 py-4 font-semibold">Message</th>
                      <th className="px-8 py-4 font-semibold">Status</th>
                      <th className="px-8 py-4 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-4 font-medium">+{log.phone}</td>
                        <td className="px-8 py-4 text-slate-500 max-w-xs truncate">{log.content}</td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-slate-400 text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                          <History size={48} className="mx-auto mb-4 opacity-20" />
                          <p>No message history available yet.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Auto Replies */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="text-amber-500" size={24} />
                  <h3 className="text-xl font-bold">Auto Replies</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Add New Rule</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Keyword</label>
                        <input 
                          type="text" 
                          placeholder="e.g. price"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Response</label>
                        <textarea 
                          placeholder="Your automated response..."
                          value={newResponse}
                          onChange={(e) => setNewResponse(e.target.value)}
                          className="w-full h-32 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        />
                      </div>
                      <button 
                        onClick={saveAutoReply}
                        className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                      >
                        Add Auto Reply Rule
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Active Rules</h4>
                    <div className="space-y-3">
                      {autoReplies.map(reply => (
                        <div key={reply.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">
                              {reply.keyword}
                            </span>
                            <button 
                              onClick={() => deleteAutoReply(reply.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{reply.response}</p>
                        </div>
                      ))}
                      {autoReplies.length === 0 && (
                        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                          <p>No auto-reply rules set yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Templates Management */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="text-blue-500" size={24} />
                  <h3 className="text-xl font-bold">Message Templates</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {templates.map(template => (
                    <div key={template.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-slate-900">{template.name}</h4>
                          <button 
                            onClick={() => deleteTemplate(template.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-3 mb-6">{template.content}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setMessage(template.content);
                          setActiveTab('campaign');
                        }}
                        className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                      <p>No templates saved yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
