import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Coins, ShoppingBag, ShieldAlert, Plus, Search, 
  Ban, CheckCircle, Key, Trash2, Calendar, RefreshCw, X, ShieldCheck
} from 'lucide-react';
import { Shop, UserRole } from '../types';

interface SuperAdminStats {
  totalShops: number;
  activeShops: number;
  totalRevenue: number;
  totalSalesCount: number;
  totalUsers: number;
  totalBranches: number;
  recentShops: Shop[];
}

export default function SuperAdminView() {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Create Shop State
  const [isCreatingShop, setIsCreatingShop] = useState<boolean>(false);
  const [newShopName, setNewShopName] = useState<string>('');
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newSubscriptionPlan, setNewSubscriptionPlan] = useState<string>('Trial');
  const [newPassword, setNewPassword] = useState<string>('');
  const [creationResult, setCreationResult] = useState<any>(null);

  // Reset Password State
  const [resettingShopId, setResettingShopId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState<string>('');

  // Load SaaS Stats and Shops list
  const fetchSaaSMasterData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cobult_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const statsRes = await fetch('/api/super/stats', { headers });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      const shopsRes = await fetch('/api/super/shops', { headers });
      if (shopsRes.ok) {
        setShops(await shopsRes.json());
      }
    } catch (err) {
      console.error('[SaaS Admin] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaaSMasterData();
  }, []);

  // Handle Create Shop Tenant
  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch('/api/super/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shopName: newShopName,
          ownerName: newOwnerName,
          email: newEmail,
          phone: newPhone,
          subscriptionPlan: newSubscriptionPlan,
          password: newPassword
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreationResult(data);
        // Reset fields
        setNewShopName('');
        setNewOwnerName('');
        setNewEmail('');
        setNewPhone('');
        setNewSubscriptionPlan('Trial');
        setNewPassword('');
        fetchSaaSMasterData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to create shop'}`);
      }
    } catch (err) {
      alert('Network error provisioning new tenant shop.');
    }
  };

  // Toggle Shop status (Suspend / Activate)
  const handleToggleShopStatus = async (shop: Shop) => {
    const nextStatus = shop.status === 'Active' ? 'Suspended' : 'Active';
    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch(`/api/super/shops/${shop.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        fetchSaaSMasterData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to update shop status'}`);
      }
    } catch (err) {
      alert('Error communicating with database.');
    }
  };

  // Change Subscription Plan
  const handleChangeSubscription = async (shopId: string, plan: string) => {
    // Calculate expiry based on plan
    const expiry = new Date();
    if (plan === 'Monthly') expiry.setMonth(expiry.getMonth() + 1);
    else if (plan === 'Quarterly') expiry.setMonth(expiry.getMonth() + 3);
    else if (plan === 'Yearly') expiry.setFullYear(expiry.getFullYear() + 1);
    else expiry.setDate(expiry.getDate() + 14);

    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch(`/api/super/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          subscriptionPlan: plan, 
          expiryDate: expiry.toISOString().slice(0, 10),
          subscriptionStatus: 'Active' // Re-activate subscription when plan is changed
        })
      });

      if (res.ok) {
        fetchSaaSMasterData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Change Subscription Status
  const handleChangeSubscriptionStatus = async (shopId: string, status: string) => {
    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch(`/api/super/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          subscriptionStatus: status 
        })
      });

      if (res.ok) {
        fetchSaaSMasterData();
      }
    } catch (err) {
      console.error('[SaaS Admin] Failed to change subscription status:', err);
    }
  };

  // Delete Tenant
  const handleDeleteShop = async (shopId: string, name: string) => {
    if (!confirm(`WARNING: Are you absolutely sure you want to permanently delete Shop "${name}"? This action is irreversible and all its collections and users will be dropped.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch(`/api/super/shops/${shopId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok) {
        alert('Shop tenant deleted successfully.');
        fetchSaaSMasterData();
      }
    } catch (err) {
      alert('Failed to delete shop.');
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingShopId) return;

    try {
      const token = localStorage.getItem('cobult_token');
      const res = await fetch('/api/super/reset-owner-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shopId: resettingShopId,
          newPassword: newResetPassword
        })
      });

      if (res.ok) {
        alert('Owner credentials successfully reset.');
        setResettingShopId(null);
        setNewResetPassword('newpass123');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert('Error updating user record.');
    }
  };

  // Filter shops
  const filteredShops = shops.filter(s => 
    s.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" id="super_admin_panel">
      
      {/* Platform Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-sans font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            COBULT SAAS CONTROL PANEL
          </h2>
          <p className="text-[11px] text-slate-400 font-mono mt-1">
            Global Cloud Tenant Isolation, Subscription Billing, and System Telemetry
          </p>
        </div>
        
        <button
          onClick={() => setIsCreatingShop(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/10 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Provision New Tenant Shop
        </button>
      </div>

      {/* 1. Global Metrics Bento Blocks */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" id="saas_metrics_grid">
          <div className="p-4 bg-[#16191F] border border-[#2D3139] rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[#94A3B8]">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">Total Shops</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-mono font-bold text-white">{stats.totalShops}</p>
          </div>

          <div className="p-4 bg-[#16191F] border border-[#2D3139] rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[#94A3B8]">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">Active Tenants</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-mono font-bold text-emerald-400">{stats.activeShops}</p>
          </div>

          <div className="p-4 bg-[#16191F] border border-[#2D3139] rounded-2xl space-y-2 col-span-2 lg:col-span-1">
            <div className="flex justify-between items-center text-[#94A3B8]">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">SaaS Revenue</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-mono font-bold text-amber-400">
              ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-4 bg-[#16191F] border border-[#2D3139] rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[#94A3B8]">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">Total Orders</span>
              <ShoppingBag className="w-4 h-4 text-pink-400" />
            </div>
            <p className="text-xl font-mono font-bold text-white">{stats.totalSalesCount}</p>
          </div>

          <div className="p-4 bg-[#16191F] border border-[#2D3139] rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-[#94A3B8]">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-xl font-mono font-bold text-white">{stats.totalUsers}</p>
          </div>
        </div>
      )}

      {/* 2. Main Tenant Table & Search */}
      <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl overflow-hidden" id="shops_manager_card">
        <div className="p-5 border-b border-[#2D3139] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              Registered Shops (Tenants)
            </h3>
            <p className="text-[10px] text-[#94A3B8] font-mono">
              Perform admin commands, suspend accounts, and manage subscriptions safely
            </p>
          </div>

          <div className="relative max-w-sm w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Shop Name, Owner, Email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#1A1D23] hover:bg-[#1F232B] focus:bg-[#0F1115] border border-[#2D3139] rounded-xl text-white font-sans text-xs focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1A1D23] border-b border-[#2D3139] text-[#94A3B8] font-mono text-[9px] uppercase tracking-wider">
                <th className="p-4">Shop Details</th>
                <th className="p-4">Owner Name</th>
                <th className="p-4">Subscription Plan</th>
                <th className="p-4">Subscription Status</th>
                <th className="p-4">Expiry Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3139]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Querying Atlas DB SaaS Collections...
                  </td>
                </tr>
              ) : filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No shops found matching filters.
                  </td>
                </tr>
              ) : (
                filteredShops.map(shop => {
                  const isExpired = new Date(shop.expiryDate).getTime() < Date.now();
                  return (
                    <tr key={shop.id} className="hover:bg-[#1A1D23]/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block text-xs">{shop.shopName}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">{shop.id} | {shop.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-300 font-medium">
                        {shop.ownerName}
                      </td>

                      <td className="p-4">
                        <select
                          value={shop.subscriptionPlan}
                          onChange={(e) => handleChangeSubscription(shop.id, e.target.value)}
                          className="bg-[#1A1D23] hover:bg-[#1F232B] border border-[#2D3139] rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="Trial">Trial</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </td>

                      <td className="p-4">
                        <select
                          value={shop.subscriptionStatus || 'Active'}
                          onChange={(e) => handleChangeSubscriptionStatus(shop.id, e.target.value)}
                          className="bg-[#1A1D23] hover:bg-[#1F232B] border border-[#2D3139] rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-sans"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Expired">Expired</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                      </td>

                      <td className="p-4 font-mono text-xs">
                        <span className={`inline-flex items-center gap-1 ${isExpired ? 'text-rose-400' : 'text-slate-300'}`}>
                          <Calendar className="w-3 h-3" />
                          {shop.expiryDate}
                          {isExpired && <span className="text-[8px] bg-rose-500/15 border border-rose-500/20 px-1 rounded font-sans uppercase">Expired</span>}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans font-bold border ${
                          shop.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${shop.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {shop.status}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleShopStatus(shop)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer inline-flex items-center justify-center ${
                            shop.status === 'Active'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                          title={shop.status === 'Active' ? 'Suspend Shop' : 'Activate Shop'}
                        >
                          {shop.status === 'Active' ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => setResettingShopId(shop.id)}
                          className="p-1.5 bg-[#1A1D23] hover:bg-[#20242E] text-amber-400 border border-[#2D3139] rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Reset Owner Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteShop(shop.id, shop.shopName)}
                          className="p-1.5 bg-rose-600/10 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/20 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Delete Shop Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. PROVISION SHOP MODAL */}
      {isCreatingShop && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="max-w-md w-full bg-[#16191F] border border-[#2D3139] p-6 rounded-2xl shadow-2xl space-y-6 text-xs animate-fade-in">
            <div className="flex justify-between items-center border-b border-[#2D3139] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                Provision SaaS Tenant
              </h3>
              <button
                onClick={() => {
                  setIsCreatingShop(false);
                  setCreationResult(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A1D23] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {creationResult ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/20 rounded-xl space-y-2 text-slate-200">
                  <p className="font-bold text-emerald-400 text-xs uppercase tracking-wide">Tenant Provisioned Successfully!</p>
                  <p className="text-[11px] text-slate-300">
                    A secure multi-tenant sandbox has been isolated and default Harare CBD branch (b1) has been generated.
                  </p>
                </div>

                <div className="p-3.5 bg-[#1A1D23] rounded-xl space-y-2.5 border border-[#2D3139] font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] tracking-wider">Tenant Id:</span>
                    <span className="text-white font-bold">{creationResult.shop.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] tracking-wider">Default Username:</span>
                    <span className="text-white font-bold">{creationResult.owner.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[9px] tracking-wider">Temporary Password:</span>
                    <span className="text-white font-bold text-amber-400">{creationResult.owner.temporaryPassword}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCreatingShop(false);
                    setCreationResult(null);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateShopSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Shop Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Spar Express"
                      value={newShopName}
                      onChange={e => setNewShopName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newOwnerName}
                      onChange={e => setNewOwnerName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Email Address</label>
                    <input
                      type="email"
                      placeholder="owner@example.com"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+263 77..."
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Billing Tier</label>
                    <select
                      value={newSubscriptionPlan}
                      onChange={e => setNewSubscriptionPlan(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white"
                    >
                      <option value="Trial">14-Day Trial</option>
                      <option value="Monthly">Monthly Premium</option>
                      <option value="Quarterly">Quarterly Corporate</option>
                      <option value="Yearly">Yearly Enterprise</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">Owner Password</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#2D3139] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingShop(false)}
                    className="px-4 py-2.5 bg-[#1A1D23] hover:bg-[#20242D] border border-[#2D3139] text-white font-sans text-xs font-bold uppercase rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold uppercase rounded-xl shadow-lg shadow-blue-500/15"
                  >
                    Confirm Provisioning
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 4. RESET PASSWORD MODAL */}
      {resettingShopId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <form onSubmit={handleResetPassword} className="max-w-md w-full bg-[#16191F] border border-[#2D3139] p-6 rounded-2xl shadow-2xl space-y-4 text-xs animate-fade-in">
            <div className="flex justify-between items-center border-b border-[#2D3139] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500" />
                Reset Tenant Credentials
              </h3>
              <button
                type="button"
                onClick={() => setResettingShopId(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A1D23] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#94A3B8] uppercase font-mono tracking-wider">New Password for Owner</label>
              <input
                type="text"
                value={newResetPassword}
                onChange={e => setNewResetPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1A1D23] border border-[#2D3139] rounded-lg text-white font-mono"
                required
              />
            </div>

            <div className="pt-3 border-t border-[#2D3139] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResettingShopId(null)}
                className="px-4 py-2.5 bg-[#1A1D23] hover:bg-[#20242D] border border-[#2D3139] text-white font-sans text-xs font-bold uppercase rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-sans text-xs font-bold uppercase rounded-xl shadow-lg shadow-amber-500/15"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
