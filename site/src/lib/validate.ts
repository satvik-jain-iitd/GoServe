// Form validation, shared by the UI and the unit tests.
// Rules are plain and explicit so a reader can see exactly what is required.

export interface ValidationResult<T> {
  valid: boolean;
  errors: Partial<Record<keyof T, string>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose international-ish phone check: 7 to 15 digits, optional + and separators.
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;

export const INTEREST_ROLES = [
  "customer",
  "rider",
  "kitchen partner",
  "investor",
] as const;

export type InterestRole = (typeof INTEREST_ROLES)[number];

export interface PreRegisterInput {
  name: string;
  email: string;
  phone: string;
  city: string;
  role: string;
}

export interface InvestorInput {
  name: string;
  firm: string;
  email: string;
  message: string;
}

export function validatePreRegister(
  input: PreRegisterInput,
): ValidationResult<PreRegisterInput> {
  const errors: Partial<Record<keyof PreRegisterInput, string>> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Please enter your name.";
  }
  if (!input.email || !EMAIL_RE.test(input.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!input.city || input.city.trim().length < 2) {
    errors.city = "Please enter your city.";
  }
  if (!input.role || !INTEREST_ROLES.includes(input.role as InterestRole)) {
    errors.role = "Please choose how you want to be involved.";
  }
  if (input.phone && input.phone.trim() !== "" && !PHONE_RE.test(input.phone.trim())) {
    errors.phone = "Please enter a valid phone number, or leave it empty.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateInvestor(
  input: InvestorInput,
): ValidationResult<InvestorInput> {
  const errors: Partial<Record<keyof InvestorInput, string>> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Please enter your name.";
  }
  if (!input.firm || input.firm.trim().length < 2) {
    errors.firm = "Please enter your firm.";
  }
  if (!input.email || !EMAIL_RE.test(input.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!input.message || input.message.trim().length < 10) {
    errors.message = "Please add a short message (at least 10 characters).";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
