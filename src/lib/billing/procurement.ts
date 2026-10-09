// The procurement pack: what a hospital's buyers ask a new supplier for,
// downloadable from /for-hospitals so nobody has to email for it. Each entry
// is listed only when its file is in public/procurement/ — add a file there
// and it appears. public/procurement/README.md says what each should be.

export interface PackItem {
  file: string
  title: string
  detail: string
}

export const PROCUREMENT_PACK: PackItem[] = [
  { file: "supplier-details.pdf", title: "Supplier details", detail: "Company number, VAT number, registered address and contacts" },
  { file: "bank-letter.pdf", title: "Bank details letter", detail: "On headed paper, for your supplier set-up form" },
  { file: "insurance.pdf", title: "Insurance certificates", detail: "Professional indemnity, public and product liability, cyber" },
  { file: "dtac.pdf", title: "DTAC", detail: "The NHS Digital Technology Assessment Criteria, completed" },
  { file: "dcb0129-safety-case.pdf", title: "Clinical safety case (DCB0129)", detail: "Hazard log and safety case report, signed by our clinical safety officer" },
  { file: "dspt.pdf", title: "DSPT status", detail: "Our Data Security and Protection Toolkit submission" },
  { file: "dpia-template.docx", title: "DPIA template", detail: "Pre-filled for your data protection officer" },
  { file: "accessibility-statement.pdf", title: "Accessibility", detail: "WCAG 2.2 AA statement and test results" },
]
