import React, { useState, useEffect } from 'react'
import { 
  Coins, 
  TrendingUp, 
  History, 
  Download, 
  Search, 
  AlertTriangle, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react'
import { aiApi } from '@/api/ai'
import toast from 'react-hot-toast'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell
} from 'recharts'

export default function AICreditsPage() {
  const [balance, setBalance] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [usageByFeature, setUsageByFeature] = useState<any>({})
  const [usageOverTime, setUsageOverTime] = useState<any[]>([])
  
  // History pagination and filter states
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  
  // Modals and loading states
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false)
  const [buyAmount, setBuyAmount] = useState(50000)
  const [isBuying, setIsBuying] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [balRes, featRes, timeRes] = await Promise.all([
        aiApi.getCreditsBalance(),
        aiApi.getUsageByFeature(),
        aiApi.getUsageOverTime()
      ])
      
      if (balRes.data) setBalance(balRes.data)
      if (featRes.data) setUsageByFeature(featRes.data)
      if (timeRes.data) setUsageOverTime(timeRes.data)
      
      await fetchHistory(1)
    } catch (error: any) {
      toast.error('Failed to load AI credits data.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch paginated usage logs
  const fetchHistory = async (pageNo: number) => {
    try {
      const histRes = await aiApi.getCreditsHistory(pageNo, 10)
      if (histRes.data) {
        setHistory(histRes.data.items || [])
        setTotalPages(histRes.data.pages || 1)
        setTotalCount(histRes.data.total || 0)
        setPage(pageNo)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Refetch history when page changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchHistory(newPage)
    }
  }

  // Filter logs locally based on search/status/provider filters
  const filteredHistory = history.filter((item: any) => {
    const matchesSearch = 
      item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.feature.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase())
      
    const matchesStatus = 
      statusFilter === 'all' || 
      item.status === statusFilter
      
    const matchesProvider = 
      providerFilter === 'all' || 
      item.provider.toLowerCase() === providerFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesProvider
  })

  // Handle Buy Credits submission
  const handleBuyCredits = async () => {
    if (buyAmount <= 0) {
      toast.error('Please enter a valid credit amount.')
      return
    }
    
    try {
      setIsBuying(true)
      const res = await aiApi.buyCredits(buyAmount)
      toast.success(`Successfully purchased ${buyAmount.toLocaleString()} AI credits!`)
      setIsBuyModalOpen(false)
      fetchData() // Refetch to update all charts/balances
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to purchase credits.')
    } finally {
      setIsBuying(false)
    }
  }

  // Export logs to CSV
  const handleCSVExport = () => {
    if (!history.length) {
      toast.error('No history records to export.')
      return
    }

    const headers = [
      'Timestamp',
      'User Name',
      'User Email',
      'Feature',
      'AI Provider',
      'Model Used',
      'Prompt Tokens',
      'Completion Tokens',
      'Total Tokens',
      'Credits Used',
      'Estimated Cost (USD)',
      'Duration (ms)',
      'Status',
      'Error Detail'
    ]

    const csvRows = [headers.join(',')]

    for (const item of history) {
      const values = [
        new Date(item.created_at).toLocaleString(),
        `"${item.user_name.replace(/"/g, '""')}"`,
        item.user_email,
        item.feature,
        item.provider,
        item.model,
        item.prompt_tokens,
        item.completion_tokens,
        item.total_tokens,
        item.credits_used,
        item.cost,
        item.duration_ms,
        item.status,
        `"${(item.error_detail || '').replace(/"/g, '""')}"`
      ]
      csvRows.push(values.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ai_credits_usage_report_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Credits usage history exported successfully!')
  }

  // Formatting helpers
  const formatFeatureName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Prep data for Recharts Pie/Bar Chart
  const featureColors: Record<string, string> = {
    jd_generation: '#6c47ff',
    resume_parsing: '#10b981',
    interview_evaluation: '#f59e0b',
    ai_copilot: '#3b82f6',
    speech_to_text: '#ec4899',
    candidate_matching: '#8b5cf6',
    pre_screening_questions: '#14b8a6',
    pre_screening_summary: '#06b6d4',
    pre_screening_translation: '#84cc16'
  }
  
  const defaultColors = ['#6c47ff', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6']

  const chartDataByFeature = Object.keys(usageByFeature).map((key, index) => ({
    name: formatFeatureName(key),
    credits: usageByFeature[key],
    color: featureColors[key] || defaultColors[index % defaultColors.length]
  }))

  const remainingPercent = balance 
    ? (balance.remaining_credits / balance.allowed_credits) * 100 
    : 100

  return (
    <div className="p-4 md:p-6 lg:p-[28px_30px] space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text,#1a1040)]">
            AI Credits & Usage
          </h1>
          <p className="text-[13px] font-medium text-[var(--text-mid,#7b719c)]">
            Monitor credits consumption, usage logs, and billing cycles.
          </p>
        </div>
        <button
          onClick={() => setIsBuyModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all duration-300 bg-[var(--theme-primary,#6c47ff)] text-white hover:opacity-90 shadow-md"
        >
          <CreditCard className="w-4 h-4" />
          <span>Buy AI Credits</span>
        </button>
      </div>

      {/* Warning Banners */}
      {balance && (
        <>
          {balance.warning_level === 'critical' && (
            <div className="flex items-center gap-3 p-4 border border-red-200 rounded-2xl bg-red-50 text-red-800 animate-pulse">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <div className="text-sm font-semibold">
                Critical Alert: Your organization's AI Credits are exhausted! All AI features have been disabled. Click 'Buy AI Credits' above to restore operations.
              </div>
            </div>
          )}
          {balance.warning_level === 'danger' && (
            <div className="flex items-center gap-3 p-4 border border-red-200 rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <div className="text-sm font-semibold">
                Credits Almost Finished! Only 5% of your monthly AI credits are remaining. Please purchase additional credits to prevent interruption.
              </div>
            </div>
          )}
          {balance.warning_level === 'warning' && (
            <div className="flex items-center gap-3 p-4 border border-amber-200 rounded-2xl bg-amber-50 text-amber-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
              <div className="text-sm font-semibold">
                Low AI Credits: Only 10% remaining. Consider upgrading your plan or buying additional credits.
              </div>
            </div>
          )}
          {balance.warning_level === 'low' && (
            <div className="flex items-center gap-3 p-4 border border-yellow-200 rounded-2xl bg-yellow-50 text-yellow-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-500" />
              <div className="text-sm font-semibold">
                Warning: Only 25% AI Credits Remaining.
              </div>
            </div>
          )}
        </>
      )}

      {/* Balance Cards */}
      {loading && !balance ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
          <div className="h-28 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
          <div className="h-28 rounded-2xl bg-[var(--kpi-bg,#f7f5ff)] animate-pulse" />
        </div>
      ) : (
        balance && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Limit Card */}
            <div 
              className="rounded-2xl p-5 border transition-all duration-300 bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[var(--text-mid,#7b719c)]">Quota Allowed (Monthly)</span>
                <Coins className="w-5 h-5 text-[var(--theme-primary,#6c47ff)]" />
              </div>
              <p className="text-3xl font-extrabold text-[var(--text,#1a1040)]">
                {balance.allowed_credits.toLocaleString()}
              </p>
              <div className="text-[11px] font-semibold text-[var(--text-light,#c4b9de)] mt-2">
                Resets on: {new Date(balance.reset_at).toLocaleDateString()}
              </div>
            </div>

            {/* Used Card */}
            <div 
              className="rounded-2xl p-5 border transition-all duration-300 bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[var(--text-mid,#7b719c)]">Credits Consumed</span>
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-3xl font-extrabold text-[var(--text,#1a1040)]">
                {balance.used_credits.toLocaleString()}
              </p>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-100 mt-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    remainingPercent <= 5 ? 'bg-red-500' : remainingPercent <= 25 ? 'bg-amber-500' : 'bg-[var(--theme-primary,#6c47ff)]'
                  }`}
                  style={{ width: `${100 - remainingPercent}%` }}
                />
              </div>
            </div>

            {/* Remaining Card */}
            <div 
              className="rounded-2xl p-5 border transition-all duration-300 bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[var(--text-mid,#7b719c)]">Remaining Balance</span>
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className={`text-3xl font-extrabold ${remainingPercent === 0 ? 'text-red-500 animate-pulse' : 'text-[var(--text,#1a1040)]'}`}>
                {balance.remaining_credits.toLocaleString()}
              </p>
              <div className="text-[11px] font-semibold text-[var(--text-light,#c4b9de)] mt-2">
                {remainingPercent.toFixed(1)}% Quota available
              </div>
            </div>
          </div>
        )
      )}

      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage Over Time */}
        <div 
          className="rounded-[20px] p-5 md:p-6 border bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm"
        >
          <h3 className="text-[15px] font-bold text-[var(--text,#1a1040)] mb-4">
            Credit Consumption (Daily)
          </h3>
          <div className="h-64 w-full">
            {usageOverTime.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] font-medium text-[var(--text-light,#c4b9de)]">
                No credit consumption logs found for this billing cycle.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6c47ff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6c47ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ff" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#7b719c" 
                    fontSize={11} 
                    tickLine={false} 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  />
                  <YAxis stroke="#7b719c" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f0ff', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }} 
                    labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  />
                  <Area type="monotone" dataKey="credits" stroke="#6c47ff" strokeWidth={2} fillOpacity={1} fill="url(#colorCredits)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Usage by Feature */}
        <div 
          className="rounded-[20px] p-5 md:p-6 border bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm"
        >
          <h3 className="text-[15px] font-bold text-[var(--text,#1a1040)] mb-4">
            Credits Breakdown by Feature
          </h3>
          <div className="h-64 w-full">
            {chartDataByFeature.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] font-medium text-[var(--text-light,#c4b9de)]">
                No credit consumption logs found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataByFeature} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f0ff" />
                  <XAxis type="number" stroke="#7b719c" fontSize={11} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#7b719c" fontSize={11} tickLine={false} width={120} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f0ff', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="credits" radius={[0, 4, 4, 0]}>
                    {chartDataByFeature.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* History Table logs */}
      <div 
        className="rounded-[20px] border bg-[var(--card-bg,#ffffff)] border-[var(--card-border,#f1f0ff)] shadow-sm overflow-hidden"
      >
        <div className="p-5 md:p-6 border-b border-[var(--card-border,#f1f0ff)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[var(--theme-primary,#6c47ff)]" />
            <h3 className="text-[16px] font-bold text-[var(--text,#1a1040)]">
              Consumption History logs
            </h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user or feature..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border rounded-xl text-xs w-48 focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary,#6c47ff)] focus:border-[var(--theme-primary,#6c47ff)] border-gray-200"
              />
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-xs text-gray-700">
              <Filter className="w-3.5 h-3.5 text-gray-400 mr-2" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-0 outline-none pr-1 focus:ring-0"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            {/* Provider Filter */}
            <div className="flex items-center border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-xs text-gray-700">
              <Filter className="w-3.5 h-3.5 text-gray-400 mr-2" />
              <select 
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="bg-transparent border-0 outline-none pr-1 focus:ring-0"
              >
                <option value="all">All Providers</option>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
                <option value="huggingface">HuggingFace</option>
              </select>
            </div>

            {/* CSV Export */}
            <button
              onClick={handleCSVExport}
              className="flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 border-gray-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[11px] font-bold text-[var(--text-mid,#7b719c)] uppercase tracking-wider border-b border-[var(--card-border,#f1f0ff)]">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Feature</th>
                <th className="px-6 py-4">Model & Provider</th>
                <th className="px-6 py-4">Tokens Used</th>
                <th className="px-6 py-4">Credits</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border,#f1f0ff)] text-xs font-semibold text-[var(--text,#1a1040)]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400 font-medium">
                    No consumption logs found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors duration-200">
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{item.user_name}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{item.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-[var(--theme-primary,#6c47ff)]">
                      {formatFeatureName(item.feature)}
                    </td>
                    <td className="px-6 py-4">
                      <div>{item.model}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{item.provider}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      {item.total_tokens > 0 ? (
                        <span>
                          {item.total_tokens.toLocaleString()}
                          <span className="text-[10px] text-gray-400 font-normal block">
                            (in: {item.prompt_tokens} / out: {item.completion_tokens})
                          </span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-sm">
                      {item.credits_used.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          <span>Success</span>
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-red-50 text-red-700 cursor-pointer"
                          title={item.error_detail || 'Unknown Error'}
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Failure</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[var(--card-border,#f1f0ff)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-mid,#7b719c)]">
              Showing page {page} of {totalPages} ({totalCount} logs)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="p-1.5 border rounded-lg hover:bg-gray-50 border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="p-1.5 border rounded-lg hover:bg-gray-50 border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Buy Credits Modal */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl p-6 border shadow-2xl bg-white border-[var(--card-border,#f1f0ff)] animate-slideUp"
          >
            <h3 className="text-lg font-bold text-[var(--text,#1a1040)] mb-2 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--theme-primary,#6c47ff)]" />
              <span>Purchase AI Credits</span>
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Simulate adding additional credits to your organization balance. The request will automatically process and update dashboard charts.
            </p>

            <div className="space-y-4 mb-6">
              {/* Presets */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                  Select Pack
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[20000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setBuyAmount(amt)}
                      className={`py-2.5 rounded-xl border text-xs font-extrabold transition-all duration-200 ${
                        buyAmount === amt 
                          ? 'border-[var(--theme-primary,#6c47ff)] bg-[var(--theme-primary,#6c47ff)] text-white' 
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                  Custom Credit Amount
                </label>
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary,#6c47ff)] focus:border-[var(--theme-primary,#6c47ff)] border-gray-200"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t pt-4 border-gray-100">
              <button
                onClick={() => setIsBuyModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyCredits}
                disabled={isBuying || buyAmount <= 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--theme-primary,#6c47ff)] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                {isBuying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Purchase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
