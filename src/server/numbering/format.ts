/**
 * Human-facing document numbers. The sequence values come from
 * DocumentSequence inside the transaction that creates the document
 * (numbering/sequence.ts); these functions only format them.
 */

/** GST rule: an invoice / credit-note number may be at most 16 characters. */
export const GST_DOC_NUMBER_MAX = 16;

export class DocumentNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentNumberError";
  }
}

function checkGstLength(value: string): string {
  if (value.length > GST_DOC_NUMBER_MAX) {
    throw new DocumentNumberError(
      `"${value}" is longer than ${GST_DOC_NUMBER_MAX} characters. Use a shorter invoice prefix in Settings.`,
    );
  }
  if (!/^[A-Z0-9/-]+$/.test(value)) {
    throw new DocumentNumberError(`"${value}" may only use capital letters, digits, "/" and "-".`);
  }
  return value;
}

/** Order HF-100001: short enough to read out on a phone call. */
export function formatOrderNumber(sequence: number): string {
  return `HF-${100_000 + sequence}`;
}

/** Tax invoice HF/26-27/000123 — consecutive within each financial year. */
export function formatInvoiceNumber(prefix: string, fyShort: string, sequence: number): string {
  return checkGstLength(`${prefix}/${fyShort}/${String(sequence).padStart(6, "0")}`);
}

/** Credit note HFCN/26-27/00012 — its own consecutive series. */
export function formatCreditNoteNumber(prefix: string, fyShort: string, sequence: number): string {
  return checkGstLength(`${prefix}CN/${fyShort}/${String(sequence).padStart(5, "0")}`);
}

export const formatReturnNumber = (sequence: number) => `RET-${100_000 + sequence}`;
export const formatRefundNumber = (sequence: number) => `RFD-${100_000 + sequence}`;
export const formatTicketNumber = (sequence: number) => `TKT-${100_000 + sequence}`;
