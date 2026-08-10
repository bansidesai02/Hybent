import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ExternalLink, Lock } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { candidatesApi } from '@/api/candidates'
import { formatDate } from '@/utils/formatters'
import { statusDef } from '@/components/hb'
import type { Candidate } from '@/types'
import { Badge, Button, Card, Input, Textarea } from '@/components/hb'

/**
 * The candidate record — read and edit.
 *
 * Extracted from the 1,700-line `CandidateProfileView` in phase 6. The read and
 * edit views used to declare the same 24 fields twice, in two unrelated shapes,
 * so a field added to one silently went missing from the other. Both now come
 * from `FIELDS` below.
 */

/** Blank, "n/a" and stringified nulls all mean the field has no value. */
function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v !== 'string') return false
  const t = v.trim().toLowerCase()
  return t === '' || t === 'n/a' || t === 'undefined' || t === 'null'
}

type FormKey =
  | 'full_name' | 'phone' | 'email' | 'location'
  | 'current_title' | 'applied_job_title' | 'current_company' | 'experience_years' | 'relevant_experience'
  | 'current_ctc' | 'expected_ctc' | 'notice_period_days' | 'availability_status'
  | 'technical_panel' | 'import_status'
  | 'remarks_practical' | 'techno_functional_hr_interview' | 'remarks_hr' | 'remarks_technical'
  | 'reference' | 'hr_name' | 'sr_no'
  | 'linkedin_url' | 'github_url' | 'portfolio_url'
  | 'interview_availability_days' | 'interview_time_slot'

type FieldDef = {
  key: FormKey
  label: string
  placeholder?: string
  multiline?: boolean
  /** Not editable — the address is the account identity. */
  readOnly?: boolean
  /** Read view only; edit view has no control for it. */
  displayOnly?: boolean
}

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Personal information',
    fields: [
      { key: 'full_name', label: 'Name', placeholder: 'e.g. John Doe' },
      { key: 'phone', label: 'Phone number', placeholder: '+91 90000 00000' },
      { key: 'email', label: 'Email', placeholder: 'name@company.com', readOnly: true },
      { key: 'location', label: 'Current location', placeholder: 'City, Country' },
    ],
  },
  {
    title: 'Experience',
    fields: [
      { key: 'current_title', label: 'Position', placeholder: 'e.g. Senior Software Engineer' },
      { key: 'applied_job_title', label: 'Role / designation', placeholder: 'e.g. Fullstack Developer' },
      { key: 'current_company', label: 'Current employer', placeholder: 'e.g. Google' },
      { key: 'experience_years', label: 'Experience', placeholder: 'e.g. 5 years' },
      { key: 'relevant_experience', label: 'Relevant experience', placeholder: 'e.g. 3 years' },
    ],
  },
  {
    title: 'Salary & joining',
    fields: [
      { key: 'current_ctc', label: 'Current salary', placeholder: 'e.g. ₹22,00,000' },
      { key: 'expected_ctc', label: 'Expected salary', placeholder: 'e.g. ₹32,00,000' },
      { key: 'notice_period_days', label: 'Notice period', placeholder: 'e.g. 30 days' },
      { key: 'availability_status', label: 'Can join within', placeholder: 'e.g. 15 days' },
    ],
  },
  {
    title: 'Interview',
    fields: [
      { key: 'technical_panel', label: 'Technical panel', placeholder: 'e.g. Tech Panel A' },
      { key: 'import_status', label: 'Final status', placeholder: 'e.g. Hired / joined' },
      { key: 'remarks_practical', label: 'Practical round', placeholder: 'Remarks for the practical round…', multiline: true },
      { key: 'techno_functional_hr_interview', label: 'HR interview', placeholder: 'Remarks for the HR interview…', multiline: true },
    ],
  },
  {
    title: 'Feedback',
    fields: [
      { key: 'remarks_hr', label: 'Remarks (HR)', placeholder: 'HR remarks…', multiline: true },
      { key: 'remarks_technical', label: 'Remarks (technical)', placeholder: 'Technical remarks…', multiline: true },
    ],
  },
  {
    title: 'Source & references',
    fields: [
      { key: 'reference', label: 'Reference / referral', placeholder: 'e.g. Referrer name' },
      { key: 'hr_name', label: 'HR name', placeholder: 'e.g. Recruiter name' },
      { key: 'sr_no', label: 'Serial no', placeholder: 'e.g. 1' },
    ],
  },
  {
    title: 'Links',
    fields: [
      { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
      { key: 'github_url', label: 'GitHub', placeholder: 'github.com/username' },
      { key: 'portfolio_url', label: 'Portfolio', placeholder: 'https://yoursite.com' },
    ],
  },
]

const LINKS: Array<{ key: 'linkedin_url' | 'github_url' | 'portfolio_url'; label: string }> = [
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'github_url', label: 'GitHub' },
  { key: 'portfolio_url', label: 'Portfolio' },
]

function initialForm(c: Candidate): Record<FormKey, string> {
  return {
    full_name: c.full_name || '',
    phone: c.phone || '',
    email: c.email || '',
    location: c.location || '',
    current_title: c.current_title || '',
    applied_job_title: c.applied_job_title || '',
    current_company: c.current_company || '',
    experience_years: String(c.experience_years || ''),
    relevant_experience: c.relevant_experience || '',
    current_ctc: String(c.current_ctc || c.current_salary || ''),
    expected_ctc: String(c.expected_ctc || c.expected_salary || ''),
    notice_period_days: String(c.notice_period_days || ''),
    availability_status: c.availability_status || '',
    technical_panel: c.technical_panel || '',
    import_status: c.import_status || 'active',
    remarks_practical: c.remarks_practical || '',
    techno_functional_hr_interview: c.techno_functional_hr_interview || '',
    remarks_hr: c.remarks_hr || '',
    remarks_technical: c.remarks_technical || '',
    reference: c.reference || '',
    hr_name: c.hr_name || '',
    sr_no: String(c.sr_no || ''),
    linkedin_url: c.linkedin_url || '',
    github_url: c.github_url || '',
    portfolio_url: c.portfolio_url || '',
    interview_availability_days: c.interview_availability_days || '',
    interview_time_slot: c.interview_time_slot || '',
  }
}

/** One labelled value in the read view. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-hb-sm border border-hb-border bg-hb-surface-2 px-3.5 py-3">
      <p className="font-mono text-hb-label uppercase text-hb-dim">{label}</p>
      <p className="mt-1.5 break-words text-hb-sm font-semibold text-hb-text">{value}</p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-3 font-mono text-hb-label uppercase text-hb-dim">
      {children}
      <span aria-hidden className="h-px flex-1 bg-hb-border" />
    </h3>
  )
}

export function DetailsTab({ candidate }: { candidate: Candidate }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(() => initialForm(candidate))
  const [notes, setNotes] = useState(candidate.hr_notes || '')

  useEffect(() => {
    setForm(initialForm(candidate))
    setNotes(candidate.hr_notes || '')
  }, [candidate])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['candidate-detail', candidate.id] })
    queryClient.invalidateQueries({ queryKey: ['talent-pool'] })
    queryClient.invalidateQueries({ queryKey: ['all-talent-full'] })
  }

  const saveDetails = useMutation({
    mutationFn: (data: typeof form) => candidatesApi.update(candidate.id, data),
    onSuccess: () => {
      toast.success('Candidate details updated')
      setIsEditing(false)
      invalidate()
    },
    onError: () => toast.error('Failed to update details'),
  })

  const saveNotes = useMutation({
    mutationFn: (next: string) => candidatesApi.update(candidate.id, { hr_notes: next }),
    onSuccess: () => {
      toast.success('Notes saved')
      invalidate()
    },
    onError: () => toast.error('Failed to save notes'),
  })

  const set = (key: FormKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  /* Read view: the same section list, filtered to fields that have a value, so
     a sparse record does not render a grid of empty boxes. */
  const readSections = useMemo(() => {
    const importDate = (() => {
      if (candidate.import_row_date) {
        const datePart = candidate.import_row_date.split(' ')[0]
        const parsed = new Date(datePart)
        return Number.isNaN(parsed.getTime()) ? datePart : formatDate(parsed.toISOString())
      }
      if (candidate.import_date) return formatDate(candidate.import_date)
      if (candidate.imported_at) return formatDate(candidate.imported_at)
      return null
    })()

    const extras: Record<string, Array<{ label: string; value: any }>> = {
      Experience: [],
      Interview: [
        {
          label: 'Pipeline stage',
          value:
            candidate.import_status && candidate.import_status !== 'active'
              ? candidate.import_status
              : statusDef(candidate.pipeline_stage ?? 'applied').label,
        },
        {
          label: 'Preferred interview time',
          value: [candidate.interview_availability_days, candidate.interview_time_slot]
            .filter(Boolean)
            .join(' • '),
        },
      ],
      'Source & references': [
        { label: 'Source', value: candidate.source },
        { label: 'Import sheet', value: candidate.import_panel_name },
        { label: 'Import date', value: importDate },
      ],
    }

    return SECTIONS.filter((s) => s.title !== 'Links')
      .map((section) => ({
        title: section.title,
        fields: [
          ...section.fields.map((f) => ({
            label: f.label,
            value: (candidate as any)[f.key],
          })),
          ...(extras[section.title] ?? []),
        ].filter((f) => !isEmpty(f.value)),
      }))
      .filter((s) => s.fields.length > 0)
  }, [candidate])

  const experience = candidate.parsed_data?.experience
  const education = candidate.parsed_data?.education

  return (
    <div className="space-y-hb-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-hb-label uppercase text-hb-dim">Overview &amp; info</p>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="quiet" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saveDetails.isPending} onClick={() => saveDetails.mutate(form)}>
              Save changes
            </Button>
          </div>
        ) : (
          user?.role === 'admin' && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Edit details
            </Button>
          )
        )}
      </div>

      {isEditing ? (
        <div className="space-y-hb-4">
          {SECTIONS.map((section) => (
            <Card key={section.title} padding="default">
              <SectionHeading>{section.title}</SectionHeading>
              <div className="grid gap-hb-4 md:grid-cols-2">
                {section.fields.map((f) =>
                  f.multiline ? (
                    <Textarea
                      key={f.key}
                      label={f.label}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      rows={3}
                      onChange={(e) => set(f.key, e.target.value)}
                      fieldClassName="md:col-span-2"
                    />
                  ) : (
                    <Input
                      key={f.key}
                      label={f.label}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      disabled={f.readOnly}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-hb-6">
          {readSections.map((section) => (
            <section key={section.title}>
              <SectionHeading>{section.title}</SectionHeading>
              <div className="grid gap-hb-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.fields.map((f) => (
                  <Fact key={f.label} label={f.label} value={String(f.value)} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <SectionHeading>Links</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {LINKS.map(({ key, label }) => {
                const href = candidate[key]
                return href ? (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-hb-full border border-hb-border bg-hb-surface px-3.5 text-hb-sm font-semibold text-hb-text transition-colors duration-hb hover:border-hb-border-strong hover:bg-hb-surface-2"
                  >
                    {label}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-hb-full border border-dashed border-hb-border-strong px-3.5 text-hb-sm font-semibold text-hb-dim transition-colors duration-hb hover:border-hb-blue/40 hover:text-hb-blue"
                  >
                    Add {label}
                  </button>
                )
              })}
            </div>
          </section>

          {candidate.skills && candidate.skills.length > 0 && (
            <section>
              <SectionHeading>Technical expertise</SectionHeading>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill: string) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(experience) && experience.length > 0 && (
            <section>
              <SectionHeading>Career journey</SectionHeading>
              <ol className="space-y-hb-5">
                {(experience as any[]).map((exp, i) => (
                  <li key={i} className="relative pl-5">
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-0 w-0.5 rounded-full bg-hb-grad"
                    />
                    <h4 className="font-display text-hb-h3 text-hb-text">{exp.title}</h4>
                    <p className="mt-0.5 text-hb-sm text-hb-cyan">
                      {exp.company}
                      {exp.duration && <span className="ml-2 text-hb-muted">· {exp.duration}</span>}
                    </p>
                    {exp.description && (
                      <p className="mt-1.5 text-hb-sm text-hb-muted">{exp.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {Array.isArray(education) && education.length > 0 && (
            <section>
              <SectionHeading>Academic foundation</SectionHeading>
              <ul className="space-y-hb-3">
                {(education as any[]).map((edu, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-hb-body font-semibold text-hb-text">{edu.degree}</h4>
                      <p className="text-hb-sm text-hb-muted">{edu.institution}</p>
                    </div>
                    {edu.year && <Badge>{edu.year}</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionHeading>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={12} aria-hidden />
                Recruitment notes
              </span>
            </SectionHeading>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (candidate.hr_notes || '')) saveNotes.mutate(notes)
              }}
              rows={5}
              placeholder="Private notes about this candidate. Visible to your team only."
              description={
                saveNotes.isPending ? 'Saving…' : 'Saves automatically when you click away.'
              }
            />
          </section>
        </div>
      )}
    </div>
  )
}
