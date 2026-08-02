import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download } from 'lucide-react'
import { Button, Dialog, Input } from '@/components/hb'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { formatDate } from '@/utils/formatters'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'
import { toast } from 'react-hot-toast'
import type { Candidate, Application } from '@/types'

/**
 * Every field here is interpolated straight into a legal document, so a field
 * that is present but empty is worse than one that is absent — it produces a
 * grammatical hole in a signed letter.
 *
 * `.default()` alone does not prevent that: it only fills an *undefined* value,
 * so clearing the input and submitting passed an empty string through to the
 * DOCX and emitted "You are being hired to work at ." and "You will be on
 * probation for  from your Date of Joining." Each of the three defaulted fields
 * now also carries `.min(1)`.
 *
 * `salary` stays optional — some organisations agree compensation separately —
 * but when it is given it is now written into the letter, which it previously
 * was not.
 */
const offerSchema = z.object({
  candidate_name: z.string().min(1, 'Name required'),
  job_role: z.string().min(1, 'Job role required'),
  joining_date: z.string().min(1, 'Date required'),
  salary: z.string().optional(),
  location: z.string().min(1, 'Office location required').default('Ahmedabad office'),
  probation_period: z.string().min(1, 'Probation period required').default('three months'),
  agreement_years: z.string().min(1, 'Agreement period required').default('2 years'),
})

type OfferFormData = z.infer<typeof offerSchema>

interface GenerateOfferModalProps {
  onClose: () => void
  candidate?: Candidate
  application?: Application
  organizationName?: string
}

const FORM_ID = 'generate-offer-form'

export function GenerateOfferModal({
  onClose,
  candidate,
  application,
  organizationName
}: GenerateOfferModalProps) {
  const { user: authUser } = useAuth()
  const { profile } = useProfile()

  const finalOrgName = organizationName || profile?.organization_name || authUser?.organization_name || 'Our Company'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      candidate_name: candidate?.full_name || '',
      job_role: application?.job?.title || '',
      joining_date: formatDate(new Date().toISOString(), 'yyyy-MM-dd'),
      location: 'Ahmedabad office',
      probation_period: 'three months',
      agreement_years: '2 years'
    }
  })

  // Helper to fetch logo as buffer for docx
  const fetchImageAsBuffer = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return await blob.arrayBuffer()
    } catch (e) {
      console.error('Failed to fetch logo:', e)
      return null
    }
  }

  const generateDocx = async (data: OfferFormData) => {
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })

    const logoBuffer = profile?.avatar_url ? await fetchImageAsBuffer(profile.avatar_url) : null
    /* Trimmed here so a whitespace-only entry counts as absent rather than
       printing "Annual CTC:   " into the letter. */
    const salary = data.salary?.trim()

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Logo (if exists)
          ...(logoBuffer ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: { width: 80, height: 80 },
                  type: 'png' // Required in docx v8+
                }),
              ],
            }),
            new Paragraph({ text: '', spacing: { after: 200 } }),
          ] : []),

          // Header: Date
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: today, font: 'Arial', size: 24 }),
            ],
            spacing: { after: 400 },
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({ text: 'OFFER LETTER', bold: true, underline: {}, font: 'Arial', size: 32 }),
            ],
            spacing: { after: 400 },
          }),

          // Salutation
          new Paragraph({
            children: [
              new TextRun({ text: `Dear ${data.candidate_name},`, font: 'Arial', size: 24 }),
            ],
            spacing: { after: 200 },
          }),

          // Opening
          new Paragraph({
            children: [
              new TextRun({ text: `Congratulations on being selected to be an integral part of `, font: 'Arial', size: 24 }),
              new TextRun({ text: finalOrgName, bold: true, font: 'Arial', size: 24 }),
              new TextRun({ text: '.', font: 'Arial', size: 24 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: `We are pleased to offer you the position of `, font: 'Arial', size: 24 }),
              new TextRun({ text: data.job_role, bold: true, font: 'Arial', size: 24 }),
              new TextRun({ text: '.', font: 'Arial', size: 24 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: 'The specific terms and conditions of your offer of employment are as follows:', font: 'Arial', size: 24 }),
            ],
            spacing: { after: 200 },
          }),

          // Details Table or Bullet list
          new Paragraph({
            children: [
              new TextRun({ text: 'Date of Joining: ', bold: true, font: 'Arial', size: 24 }),
              new TextRun({ text: data.joining_date, font: 'Arial', size: 24 }),
            ],
          }),

          /* Compensation. The field was collected and then dropped on the floor —
             a recruiter could type a CTC, download the letter, and send an offer
             with no salary in it and no warning. Omitted entirely when blank
             rather than printed as an empty label. */
          ...(salary
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Annual CTC: ', bold: true, font: 'Arial', size: 24 }),
                    new TextRun({ text: salary, font: 'Arial', size: 24 }),
                  ],
                }),
              ]
            : []),

          new Paragraph({
            children: [
              new TextRun({ text: `You are being hired to work at `, font: 'Arial', size: 24 }),
              new TextRun({ text: data.location, bold: true, font: 'Arial', size: 24 }),
              new TextRun({ text: '.', font: 'Arial', size: 24 }),
            ],
            spacing: { after: 400 },
          }),

          // Standard Clauses
          new Paragraph({
            children: [
              new TextRun({ text: `You will be on probation for ${data.probation_period} from your Date of Joining. ${finalOrgName} will confirm your employment status based on your performance during or on completion of the probation. Company have all right to extend your probation if your performance is not satisfactory.`, font: 'Arial', size: 22 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: 'Performance review will be conducted yearly basis subject to completion of one year with the company.', font: 'Arial', size: 22 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: 'You will be eligible for the credit of 1.5 leave per month on pro-rata basis after completion of probation period. During your probation period you are allowed to take emergency leaves only.', font: 'Arial', size: 22 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: 'We will be verifying your previous employment and educational qualification details, etc. Misrepresentation or giving false statements about personal/professional background or suppression of relevant facts during the selection process or at the time of joining may result in termination of services.', font: 'Arial', size: 22 }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: `You will be under ${data.agreement_years} of service agreement with `, font: 'Arial', size: 22 }),
              new TextRun({ text: finalOrgName, bold: true, font: 'Arial', size: 22 }),
              new TextRun({ text: `, which would be applicable starting from your date of joining. In the event of the employee leaving, abandoning or resigning the service of the company in breach of the terms of the agreement before the expiry of the term, the cost incurred by the company for providing training as also for suffering the employee during the term of the training without the employee being able to generate revenue during this period, which, in absence of specific proof by the Company, is to be quantified at 2 months’ cost to the company.`, font: 'Arial', size: 22 }),
            ],
            spacing: { after: 600 },
          }),

          // Signature
          new Paragraph({
            children: [
              new TextRun({ text: 'Sincerely,', font: 'Arial', size: 24 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Director,', font: 'Arial', size: 24 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: finalOrgName, bold: true, font: 'Arial', size: 24 }),
            ],
          }),
        ],
      }],
    })

    try {
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `Offer_Letter_${data.candidate_name.replace(/\s+/g, '_')}.docx`)
      toast.success('Offer letter generated successfully!')
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate Word document.')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Generate Offer Letter (DOCX)"
      description="The letter is built in the browser and downloaded straight away — nothing is saved or sent."
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form={FORM_ID}
            loading={isSubmitting}
            icon={<Download size={15} />}
          >
            Download DOCX
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(generateDocx)} className="pb-2">
        <div className="grid gap-hb-4 md:grid-cols-2">
          <Input
            label="Candidate Name"
            {...register('candidate_name')}
            error={errors.candidate_name?.message}
          />
          <Input
            label="Job Role"
            {...register('job_role')}
            error={errors.job_role?.message}
          />
          <Input
            type="date"
            label="Joining Date"
            {...register('joining_date')}
            error={errors.joining_date?.message}
          />
          <Input
            label="Office Location"
            {...register('location')}
            error={errors.location?.message}
          />
          <Input
            label="Probation Period"
            {...register('probation_period')}
            error={errors.probation_period?.message}
          />
          <Input
            label="Agreement Period"
            {...register('agreement_years')}
            error={errors.agreement_years?.message}
          />
          <Input
            label="Annual CTC / Salary"
            placeholder="e.g. ₹12,00,000"
            description="Optional. Printed in the letter as an Annual CTC line; left out entirely if blank."
            {...register('salary')}
            error={errors.salary?.message}
            fieldClassName="md:col-span-2"
          />
        </div>
      </form>
    </Dialog>
  )
}
