/**
 * Shared validation helpers. Pure functions, no browser APIs, so they run in
 * both the UI and unit tests.
 */

export interface FieldErrors {
  [field: string]: string;
}

const CERT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** True when a string is a real calendar date in YYYY-MM-DD form. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function validateCertificateId(value: string): string | null {
  const id = value.trim().toUpperCase();
  if (!id) return "Certificate ID is required.";
  if (!CERT_ID_RE.test(id))
    return "Use 4–32 characters: letters, numbers or hyphens (no spaces).";
  return null;
}

export interface IssueFormInput {
  id: string;
  studentName: string;
  studentEmail: string;
  course: string;
  institution: string;
  department: string;
  registrationNumber: string;
  grade: string;
  issueDate: string;
  expiryDate: string;
  issuerName: string;
  notes: string;
}

/** Validate the issuance form. Returns field-level errors keyed by input name. */
export function validateIssueForm(input: IssueFormInput): FieldErrors {
  const errors: FieldErrors = {};

  const idError = validateCertificateId(input.id);
  if (idError) errors.id = idError;

  if (!input.studentName.trim())
    errors.studentName = "Student full name is required.";
  else if (input.studentName.trim().length > 120)
    errors.studentName = "Name is limited to 120 characters.";

  const email = trimOrUndefined(input.studentEmail);
  if (email && !EMAIL_RE.test(email)) errors.studentEmail = "Enter a valid email address or leave it blank.";

  if (!input.course.trim()) errors.course = "Course / degree is required.";
  if (!input.institution.trim()) errors.institution = "Institution name is required.";
  if (!input.issuerName.trim()) errors.issuerName = "Issuer name is required.";

  if (!input.issueDate) errors.issueDate = "Issue date is required.";
  else if (!isValidIsoDate(input.issueDate))
    errors.issueDate = "Enter a valid date.";

  if (input.expiryDate) {
    if (!isValidIsoDate(input.expiryDate))
      errors.expiryDate = "Enter a valid date.";
    else if (isValidIsoDate(input.issueDate) && input.expiryDate < input.issueDate)
      errors.expiryDate = "Expiry cannot be before the issue date.";
  }

  for (const [field, value] of Object.entries(input) as [string, string][]) {
    if (value && value.length > 200)
      errors[field] = "Limited to 200 characters.";
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Normalize an uploaded filename for display + hashing bookkeeping. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
}
