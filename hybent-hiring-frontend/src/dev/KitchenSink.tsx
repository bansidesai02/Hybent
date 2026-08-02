import { useState, type ReactNode } from 'react'
import {
  Users, Briefcase, Calendar, Award, Brain, Upload, Plus, ArrowRight, Trash2,
} from 'lucide-react'
import {
  Avatar, Badge, Button, Card, CardHeader, CellStack, ChartFrame, ChartTooltip, Checkbox,
  ConfirmDialog, ContextMenu, DataTable, Dialog, Drawer, Dropzone, EmptyState, FilterChips,
  IconTile, Input, Meter, PageHeader, Pagination, ScoreRing, Select, SkeletonStats, StatCard,
  StatGrid, StatusPill, TabPanel, Tabs, TagInput, Textarea, Toolbar, ToolbarSearch,
  ToolbarSelection, ToolbarSpacer, axisProps, useChartTheme, type Column,
} from '@/components/hb'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis,
} from 'recharts'

/**
 * Every design-system component, in both themes, on one page.
 *
 * This is the review surface for phases 2 through 10: a component is checked
 * here — light and dark, at every state — before any page adopts it. It is also
 * the fastest way to catch a token that reads correctly on paper and vanishes
 * on the dark ground.
 *
 * Dev-only. `AppRoutes` mounts it behind `import.meta.env.DEV`, so it is not in
 * the production bundle.
 */

/* ─── Sample data ──────────────────────────────────────────────────────────── */

type Candidate = {
  id: number
  name: string
  email: string
  role: string
  score: number
  stage: string
}

const CANDIDATES: Candidate[] = [
  { id: 1, name: 'Priya Nair',    email: 'priya@example.com',  role: 'Senior Frontend', score: 94, stage: 'shortlisted' },
  { id: 2, name: 'Arjun Mehta',   email: 'arjun@example.com',  role: 'Backend',         score: 88, stage: 'interview' },
  { id: 3, name: 'Sara Iqbal',    email: 'sara@example.com',   role: 'Design Lead',     score: 81, stage: 'offer' },
  { id: 4, name: 'Rahul Verma',   email: 'rahul@example.com',  role: 'Data Engineer',   score: 67, stage: 'rejected' },
]

const TREND = [
  { m: 'Feb', applied: 120, hired: 8 },
  { m: 'Mar', applied: 168, hired: 12 },
  { m: 'Apr', applied: 142, hired: 9 },
  { m: 'May', applied: 210, hired: 17 },
  { m: 'Jun', applied: 186, hired: 14 },
  { m: 'Jul', applied: 243, hired: 21 },
]

const ALL_STATUSES = [
  'applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired', 'rejected',
  'scheduled', 'completed', 'cancelled', 'no_show', 'active', 'draft', 'paused',
  'pending', 'accepted', 'declined', 'healthy', 'degraded', 'down', 'processing',
]

/* ─── Layout helpers ───────────────────────────────────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 pb-2 border-b border-hb-border">
        <h2 className="font-display text-hb-h2 text-hb-text">{title}</h2>
        {note && <p className="mt-1 text-hb-sm text-hb-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="w-28 shrink-0 font-mono text-hb-label uppercase text-hb-dim">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/* ─── The gallery, rendered once per theme ─────────────────────────────────── */

function Gallery() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
  const [selected, setSelected] = useState<Set<React.Key>>(new Set())
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'score',
    direction: 'desc',
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tags, setTags] = useState<string[]>(['React', 'TypeScript'])
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [page, setPage] = useState(3)
  const theme = useChartTheme()

  const columns: Array<Column<Candidate>> = [
    {
      key: 'name',
      header: 'Candidate',
      cardTitle: true,
      sortable: true,
      cell: (c) => <CellStack primary={c.name} secondary={c.email} />,
    },
    { key: 'role', header: 'Role', sortable: true, cell: (c) => c.role },
    {
      key: 'score',
      header: 'Match',
      align: 'right',
      sortable: true,
      width: '110px',
      cell: (c) => <span className="font-display font-bold tabular-nums">{c.score}%</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '150px',
      cell: (c) => <StatusPill status={c.stage} />,
    },
  ]

  return (
    <div className="p-hb-6 max-w-hb-page mx-auto">
      <PageHeader
        eyebrow="Design system"
        title="Kitchen sink"
        description="Every Hybent primitive, at every state. Reviewed here before any page adopts it."
        breadcrumbs={[{ label: 'Dev', to: '/dev' }, { label: 'Kitchen sink' }]}
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<Upload size={15} />}>Import</Button>
            <Button size="sm" icon={<Plus size={15} />}>Add candidate</Button>
          </>
        }
      />

      <Section title="Buttons" note="Four variants, three sizes. The pill radius is the loudest brand cue.">
        <Row label="Primary">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg" trailingIcon={<ArrowRight size={16} />}>Large with arrow</Button>
        </Row>
        <Row label="Ghost">
          <Button variant="ghost" size="sm">Small</Button>
          <Button variant="ghost" icon={<Calendar size={15} />}>With icon</Button>
        </Row>
        <Row label="Quiet">
          <Button variant="quiet">Cancel</Button>
          <Button variant="quiet" size="sm">Dismiss</Button>
        </Row>
        <Row label="Danger">
          <Button variant="danger" icon={<Trash2 size={15} />}>Delete</Button>
        </Row>
        <Row label="States">
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="ghost" disabled>Disabled ghost</Button>
        </Row>
      </Section>

      <Section title="Stats">
        <StatGrid>
          <StatCard label="Total candidates" value="1,284" icon={<Users />} trend={{ value: '+12%', direction: 'up' }} />
          <StatCard label="Open positions" value="18" icon={<Briefcase />} trend={{ value: '+2', direction: 'up' }} />
          <StatCard label="Time to hire" value="21d" icon={<Calendar />} trend={{ value: '+3d', direction: 'up', goodWhen: 'down' }} />
          <StatCard label="Offers accepted" value="92%" icon={<Award />} trend={{ value: '0%', direction: 'flat' }} />
        </StatGrid>
        <div className="mt-4">
          <SkeletonStats count={4} />
        </div>
      </Section>

      <Section
        title="People & scores"
        note="Added during phase 6. The avatar has one appearance on purpose — the predecessor hashed a name to one of six Tailwind hues, so a candidate list read as a bag of sweets."
      >
        <Row label="Avatar">
          <Avatar name="Priya Nair" size="xs" />
          <Avatar name="Arjun Mehta" size="sm" />
          <Avatar name="Sara Iqbal" size="md" />
          <Avatar name="Rahul Verma" size="lg" />
          <Avatar name="Devika Rao" size="xl" />
        </Row>
        <Row label="Score ring">
          <ScoreRing score={94} />
          <ScoreRing score={71} />
          <ScoreRing score={38} />
          <ScoreRing score={null} />
        </Row>
        <Row label="Meter">
          <div className="w-64 space-y-3">
            <Meter label="Applied" value={100} />
            <Meter label="Shortlisted" value={62} />
            <Meter label="Match" value={94} tone="auto" />
            <Meter label="Communication" value={4} max={5} size="xs" valueLabel="4/5" />
          </div>
        </Row>
      </Section>

      <Section
        title="Input & upload"
        note="Both replace controls that were built from divs and could not be reached by keyboard."
      >
        <div className="grid gap-hb-5 lg:grid-cols-2 max-w-4xl">
          <TagInput
            label="Required skills"
            value={tags}
            onChange={setTags}
            placeholder="React, TypeScript, Node"
          />
          <Dropzone
            title="Drop a résumé"
            description="PDF or Word. Hybent AI extracts the skills and experience."
            formats={['PDF', 'DOCX', 'TXT']}
            onFiles={(files) => window.alert(`${files.length} file(s) — demo only`)}
          />
        </div>
      </Section>

      <Section
        title="Wayfinding"
        note="Pagination renders page numbers — its predecessor was Previous/Next only, so page 30 of 40 took twenty-nine clicks. Right-click the card for the context menu."
      >
        <Pagination page={page} pages={12} total={584} limit={50} onPage={setPage} noun="candidates" />
        <Card
          padding="compact"
          className="mt-4 max-w-xs select-none text-center text-hb-sm text-hb-muted"
          onContextMenu={(e) => {
            e.preventDefault()
            setMenuAt({ x: e.clientX, y: e.clientY })
          }}
        >
          Right-click me
        </Card>
        <ContextMenu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          items={[
            { label: 'Rename', onSelect: () => {} },
            { label: 'Delete', destructive: true, icon: <Trash2 size={14} aria-hidden />, onSelect: () => {} },
          ]}
        />
      </Section>

      <Section title="Status" note="One map for the whole product. Tones are semantic; the label always carries the meaning.">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => <StatusPill key={s} status={s} />)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="success" dot>Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="success" dot="pulse">Live</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-hb-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader title="Flat card" subtitle="The default data surface" icon={<IconTile size="sm"><Brain /></IconTile>} />
            <p className="text-hb-sm text-hb-muted">Sits on a border, no lift. Used for anything not clickable.</p>
          </Card>
          <Card variant="interactive">
            <CardHeader title="Interactive" subtitle="Hover for the gradient hairline" />
            <p className="text-hb-sm text-hb-muted">Lifts 2px and draws the brand edge — the site's card detail at product scale.</p>
          </Card>
          <Card padding="compact">
            <CardHeader title="Compact" subtitle="14px padding" />
            <p className="text-hb-sm text-hb-muted">For dense lists and sidebars.</p>
          </Card>
        </div>
      </Section>

      <Section title="Form controls" note="Mono uppercase labels are the site's `.field label` — the strongest brand carrier in a form.">
        <div className="grid gap-hb-5 sm:grid-cols-2 max-w-3xl">
          <Input label="Full name" placeholder="Priya Nair" required />
          <Input label="Work email" type="email" placeholder="you@company.com" description="We never share this." />
          <Input label="With error" defaultValue="not-an-email" error="Enter a valid email address" />
          <Select
            label="Stage"
            placeholder="Choose a stage"
            defaultValue=""
            options={[
              { value: 'applied', label: 'Applied' },
              { value: 'screening', label: 'Screening' },
              { value: 'interview', label: 'Interview' },
            ]}
          />
          <Input label="Disabled" value="Read only" disabled readOnly />
          <Input label="Search" leadingIcon={<Users size={15} />} placeholder="Find someone" />
          <div className="sm:col-span-2">
            <Textarea label="Notes" placeholder="What stood out in the screen?" />
          </div>
          <div className="sm:col-span-2 grid gap-3">
            <Checkbox label="Email me when a candidate is shortlisted" description="Sent at most once an hour." defaultChecked />
            <Checkbox label="Include archived roles" />
          </div>
        </div>
      </Section>

      <Section title="Toolbar and tabs">
        <Toolbar>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search candidates…" />
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'shortlisted', label: 'Shortlisted', count: 12 },
              { value: 'interview', label: 'Interview', count: 5 },
              { value: 'offer', label: 'Offer', count: 2 },
            ]}
          />
          <ToolbarSpacer />
          <Button variant="ghost" size="sm">Export</Button>
        </Toolbar>

        <ToolbarSelection count={selected.size} onClear={() => setSelected(new Set())}>
          <Button size="sm" variant="ghost">Move stage</Button>
          <Button size="sm" variant="danger">Reject</Button>
        </ToolbarSelection>

        <div className="mt-4">
          <Tabs
            aria-label="Candidate sections"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'resume', label: 'Resume', count: 3 },
              { value: 'scorecards', label: 'Scorecards', count: 12 },
              { value: 'archived', label: 'Archived', disabled: true },
            ]}
          />
          <TabPanel value="overview" active={tab === 'overview'}>
            <p className="text-hb-sm text-hb-muted">Arrow keys move between tabs. Only the active tab is in the tab order.</p>
          </TabPanel>
          <TabPanel value="resume" active={tab === 'resume'}>
            <p className="text-hb-sm text-hb-muted">Resume panel.</p>
          </TabPanel>
          <TabPanel value="scorecards" active={tab === 'scorecards'}>
            <p className="text-hb-sm text-hb-muted">Scorecards panel.</p>
          </TabPanel>
        </div>
      </Section>

      <Section title="Data table" note="Resize below 768px — it collapses to cards rather than scrolling sideways.">
        <DataTable
          caption="Candidates"
          columns={columns}
          rows={CANDIDATES}
          rowKey={(c) => c.id}
          sort={sort}
          onSortChange={setSort}
          selection={{
            selected,
            onToggle: (k) =>
              setSelected((prev) => {
                const next = new Set(prev)
                if (next.has(k)) next.delete(k)
                else next.add(k)
                return next
              }),
            onToggleAll: (keys) =>
              setSelected((prev) => (prev.size === keys.length ? new Set() : new Set(keys))),
          }}
        />

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={[]}
            rowKey={(c: Candidate) => c.id}
            empty={{
              tone: 'no-results',
              title: 'No candidates match',
              description: 'Try widening the stage filter or clearing your search.',
              action: { label: 'Clear filters', onClick: () => { setSearch(''); setFilter(null) } },
            }}
          />
        </div>

        <div className="mt-4">
          <DataTable columns={columns} rows={[]} rowKey={(c: Candidate) => c.id} loading />
        </div>
      </Section>

      <Section title="Charts" note="Series colours are read from tokens at render, so a chart is never hardcoded to a theme.">
        <div className="grid gap-hb-4 lg:grid-cols-2">
          <ChartFrame title="Applications">
            <AreaChart data={TREND} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="m" {...axisProps(theme)} />
              <YAxis {...axisProps(theme)} />
              <ChartTooltip />
              <Area type="monotone" dataKey="applied" stroke={theme.series[0]} fill={theme.fill(0)} strokeWidth={2} />
            </AreaChart>
          </ChartFrame>

          <ChartFrame title="Hires per month">
            <BarChart data={TREND} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="m" {...axisProps(theme)} />
              <YAxis {...axisProps(theme)} />
              <ChartTooltip />
              <Bar dataKey="hired" fill={theme.series[2]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </div>
      </Section>

      <Section title="Empty states">
        <div className="grid gap-hb-4 lg:grid-cols-3">
          <Card padding="none">
            <EmptyState
              title="No candidates yet"
              description="Upload a resume or import from your ATS to get started."
              action={{ label: 'Upload resume', onClick: () => {} }}
            />
          </Card>
          <Card padding="none">
            <EmptyState tone="no-results" title="No results" description="Nothing matched that search." secondaryAction={{ label: 'Clear', onClick: () => {} }} />
          </Card>
          <Card padding="none">
            <EmptyState tone="error" title="Could not load" description="The request failed. This is usually temporary." action={{ label: 'Retry', onClick: () => {} }} />
          </Card>
        </div>
      </Section>

      <Section title="Overlays" note="Escape closes, focus is trapped and returns to the trigger, the page behind cannot scroll.">
        <Row label="Open">
          <Button variant="ghost" onClick={() => setDialogOpen(true)}>Dialog</Button>
          <Button variant="ghost" onClick={() => setDrawerOpen(true)}>Drawer</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Destructive confirm</Button>
        </Row>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Schedule interview"
          description="Both parties get a calendar invite immediately."
          footer={
            <>
              <Button variant="quiet" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => setDialogOpen(false)}>Schedule</Button>
            </>
          }
        >
          <div className="grid gap-hb-4 py-2">
            <Input label="Interviewer" placeholder="Search team…" />
            <Input label="When" type="datetime-local" />
            <Textarea label="Agenda" rows={3} placeholder="What will you cover?" />
          </div>
        </Dialog>

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Priya Nair"
          description="Senior Frontend · 94% match"
          footer={
            <>
              <Button variant="quiet" size="sm" onClick={() => setDrawerOpen(false)}>Close</Button>
              <Button size="sm">Move to interview</Button>
            </>
          }
        >
          <div className="grid gap-hb-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill status="shortlisted" />
              <Badge tone="info">8 yrs</Badge>
              <Badge>Remote</Badge>
            </div>
            <p className="text-hb-sm text-hb-muted">
              The drawer keeps the list behind it in place, with its filters and scroll position intact —
              which is the whole reason it exists rather than a route change.
            </p>
          </div>
        </Drawer>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          destructive
          title="Reject 3 candidates?"
          description="They will each be emailed. This cannot be undone."
          confirmLabel="Reject them"
        />
      </Section>

      <Section title="Type ramp">
        <div className="grid gap-3">
          <p className="font-display text-hb-display text-hb-text">Display · Sora 32</p>
          <p className="font-display text-hb-h2 text-hb-text">Heading 2 · Sora 22</p>
          <p className="font-display text-hb-h3 text-hb-text">Heading 3 · Sora 17</p>
          <p className="text-hb-body text-hb-text">Body · Manrope 14. The reading size for prose and table cells.</p>
          <p className="text-hb-sm text-hb-muted">Small · Manrope 13, muted. Secondary information.</p>
          <p className="font-mono text-hb-label uppercase text-hb-dim">Label · IBM Plex Mono 10</p>
          <p className="font-display text-hb-num text-hb-text">1,284</p>
        </div>
      </Section>
    </div>
  )
}

/* ─── Both themes, side by side ────────────────────────────────────────────── */

export default function KitchenSink() {
  /* One theme, because there is one theme. This page used to render the gallery
     twice side by side to check every token against a dark ground; dark mode has
     since been removed from the product, so the second column would have been
     comparing the design system against a surface nothing ships. */
  return (
    <div className="min-h-screen">
      <div className="hb-app sticky top-0 z-50 flex items-center gap-3 border-b border-hb-border bg-hb-surface px-hb-6 py-3">
        <span className="font-mono text-hb-label uppercase text-hb-muted">Hybent design system</span>
      </div>

      <div className="hb-app min-h-screen">
        <Gallery />
      </div>
    </div>
  )
}
