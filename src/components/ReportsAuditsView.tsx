/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  ShieldAlert, 
  Download, 
  Calendar, 
  BarChart, 
  Users, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  FileSpreadsheet,
  AlertOctagon,
  Search,
  Activity,
  Award
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell
} from 'recharts';
import { Sale, AuditLog, Product, UserRole } from '../types.ts';

interface ReportsAuditsViewProps {
  sales: Sale[];
  auditLogs: AuditLog[];
  products: Product[];
  currencySymbol: string;
  userRole: UserRole;
  taxPercentage: number;
}

export default function ReportsAuditsView({
  sales,
  auditLogs,
  products,
  currencySymbol,
  userRole,
  taxPercentage
}: ReportsAuditsViewProps) {
  // Tabs: Reports or Security Audits
  const [activeTab, setActiveTab] = useState<'reports' | 'audits'>('reports');
  const [searchLog, setSearchLog] = useState('');

  // Restricted Access flags
  const isOwner = userRole === UserRole.OWNER;
  const isManager = userRole === UserRole.MANAGER;
  const canAccessAudits = isOwner || isManager;

  // 1. Calculations: Cashier Performance
  const cashierPerfData = useMemo(() => {
    const map: Record<string, { name: string; sales: number; count: number }> = {};
    sales.forEach(s => {
      if (!map[s.cashierId]) {
        map[s.cashierId] = { name: s.cashierName, sales: 0, count: 0 };
      }
      map[s.cashierId].sales += s.total;
      map[s.cashierId].count += 1;
    });
    return Object.values(map);
  }, [sales]);

  // 2. Calculations: Fast vs Slow Moving Stock
  const stockMovements = useMemo(() => {
    // Generate sale quantity tally per product
    const tally: Record<string, number> = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        tally[item.productId] = (tally[item.productId] || 0) + item.quantity;
      });
    });

    const fastMoving: { name: string; qtySold: number; left: number }[] = [];
    const slowMoving: { name: string; left: number; costValue: number }[] = [];

    products.forEach(p => {
      const sold = tally[p.id] || 0;
      if (sold > 5) {
        fastMoving.push({ name: p.name, qtySold: sold, left: p.quantity });
      } else if (sold === 0 && p.quantity > 0) {
        slowMoving.push({ name: p.name, left: p.quantity, costValue: p.purchasePrice * p.quantity });
      }
    });

    return {
      fastMoving: fastMoving.sort((a, b) => b.qtySold - a.qtySold).slice(0, 5),
      slowMoving: slowMoving.sort((a, b) => b.left - a.left).slice(0, 5)
    };
  }, [sales, products]);

  // 3. VAT/Tax report summary
  const taxMetrics = useMemo(() => {
    let totalTaxable = 0;
    let totalVatCollected = 0;
    sales.forEach(s => {
      if (s.status === 'Completed') {
        totalVatCollected += s.taxTotal;
        totalTaxable += s.total - s.taxTotal;
      }
    });
    return {
      totalTaxable,
      totalVatCollected
    };
  }, [sales]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = log.action.toLowerCase().includes(searchLog.toLowerCase()) ||
                          log.userName.toLowerCase().includes(searchLog.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchLog.toLowerCase());
      return matchSearch;
    });
  }, [auditLogs, searchLog]);

  const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8'];

  // Simulated export actions
  const triggerExport = (format: 'Excel' | 'PDF' | 'CSV') => {
    alert(`Generating high-fidelity ${format} report export... Document successfully downloaded.`);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="reports-module">
      
      {/* Upper bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-sans font-medium tracking-tight text-slate-900">Reports & Audit Trails</h1>
          <p className="text-slate-500 text-sm mt-1">Audit sales tax VAT collections, cashier throughput, and secure login history.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => triggerExport('Excel')}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button 
            onClick={() => triggerExport('PDF')}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            PDF
          </button>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex gap-4 border-b border-slate-100 pb-px">
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-sm font-sans font-medium relative transition-colors ${
            activeTab === 'reports' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Performance Reports
          {activeTab === 'reports' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />}
        </button>
        {canAccessAudits && (
          <button
            onClick={() => setActiveTab('audits')}
            className={`pb-3 text-sm font-sans font-medium relative transition-colors ${
              activeTab === 'audits' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Security Audit Trails
            {activeTab === 'audits' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />}
          </button>
        )}
      </div>

      {/* Reports panel rendering */}
      {activeTab === 'reports' ? (
        <div className="space-y-8" id="reports-container">
          
          {/* VAT Ledger summary */}
          {canAccessAudits && (
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">VAT Reg: VAT-789-201-99</span>
                <h4 className="font-sans font-semibold text-slate-800 text-sm mt-1">Sales Tax & VAT Ledger</h4>
                <p className="text-xs text-slate-400 mt-1">Cumulative tax liability computed at standard rate of {taxPercentage}%.</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono">Taxable Sales Turnover</span>
                <p className="text-xl font-bold text-slate-900">{currencySymbol}{taxMetrics.totalTaxable.toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-emerald-600 font-semibold font-mono flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  VAT Liability Collected
                </span>
                <p className="text-xl font-bold text-slate-900">{currencySymbol}{taxMetrics.totalVatCollected.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Cashier Throughput performance */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-sans font-medium text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                  <Award className="w-4 h-4 text-slate-700" />
                  Cashier Performance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Sales throughput registered per cashier terminal.</p>
              </div>

              {cashierPerfData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={cashierPerfData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                        itemStyle={{ fontSize: '11px', color: '#fff' }}
                      />
                      <Bar dataKey="sales" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={35}>
                        {cashierPerfData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-44 text-center">
                  <Users className="w-8 h-8 text-slate-200" />
                  <p className="text-xs text-slate-400 mt-2">No cashier transactions logged yet today.</p>
                </div>
              )}
            </div>

            {/* Fast Moving Inventory Stock */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
              <div className="mb-4">
                <h3 className="font-sans font-medium text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-slate-700" />
                  Fast-Moving Inventory
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Items with high turnover rates requiring regular PO reorders.</p>
              </div>

              <div className="space-y-3">
                {stockMovements.fastMoving.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="font-sans font-semibold text-slate-800">{item.name}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.left} units remaining on shelf</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-1 rounded text-[10px]">
                      {item.qtySold} sold
                    </span>
                  </div>
                ))}

                {stockMovements.fastMoving.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-44 text-center">
                    <TrendingUp className="w-8 h-8 text-slate-200" />
                    <p className="text-xs text-slate-400 mt-2">Products sold under threshold limits to classify.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slow/Dead Stock analysis */}
          {canAccessAudits && (
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-sans font-medium text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                    <AlertOctagon className="w-4 h-4 text-slate-700" />
                    Dead / Slow Moving Capital (Write-Off Risks)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Products with zero turnover representing dead locked capital.</p>
                </div>
                <button 
                  onClick={() => alert('Triggering automatic supplier return order recommendations...')}
                  className="text-[10px] font-sans font-semibold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-sm"
                >
                  Request Returns
                </button>
              </div>

              <div className="space-y-2.5">
                {stockMovements.slowMoving.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-rose-50/20 border border-rose-50 p-3 rounded-xl text-xs text-slate-800">
                    <div className="space-y-0.5">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <p className="text-[10px] text-slate-400">{item.left} stagnant units in warehouse</p>
                    </div>
                    <span className="font-mono text-rose-600 font-semibold">
                      Capital locked: {currencySymbol}{item.costValue.toFixed(2)}
                    </span>
                  </div>
                ))}

                {stockMovements.slowMoving.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">All products have had active sales velocity.</p>
                )}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* AUDIT TRAILS PANEL */
        <div className="space-y-4" id="audits-container">
          
          {/* Search audit filter */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search security log event, user, details, login activities..."
              value={searchLog}
              onChange={e => setSearchLog(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white text-xs rounded-xl border-none focus:ring-2 focus:ring-slate-900 transition-all text-slate-800"
            />
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs text-slate-500 uppercase font-mono tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Detailed Audit Log</th>
                    <th className="py-3 px-4 text-center">Security Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-mono text-slate-700">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {log.userName} ({log.userRole})
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-sans max-w-xs truncate">
                        {log.details}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                          log.action.includes('DELETE') || log.action.includes('ADJUST')
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.action.includes('DELETE') || log.action.includes('ADJUST') ? 'CRITICAL' : 'STANDARD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-sans">
                        No security logs found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
