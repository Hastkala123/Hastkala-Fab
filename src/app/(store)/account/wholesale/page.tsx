import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { BUSINESS_TYPES } from "@/lib/validators";
import { requireUserPage } from "@/server/auth/page-guard";
import { getSettings } from "@/server/settings";
import { buyerTerms, getWholesaleAccount } from "@/server/wholesale/account";
import ApplicationForm from "./ApplicationForm";
import DocumentsPanel from "./DocumentsPanel";

export const metadata: Metadata = { title: "Wholesale account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TERMS_LABEL = {
  PREPAID: "Pay before dispatch",
  ADVANCE_BALANCE: "Advance now, balance before dispatch",
  CREDIT: "Credit",
} as const;

export default async function WholesaleAccountPage() {
  const user = await requireUserPage("/account/wholesale");
  const [account, settings, me, terms] = await Promise.all([
    getWholesaleAccount(user.id),
    getSettings(),
    db.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
    buyerTerms(db, user.id),
  ]);
  const status = account?.status ?? "NONE";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">Wholesale account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Trade prices for boutiques, shops and resellers. <Link href="/wholesale" className="hf-link">How wholesale works</Link>
        </p>
      </div>

      {status === "NONE" && (
        <p className="rounded-card border border-cotton-300 bg-cotton-100 p-4 text-sm text-slate-700">
          Tell us about your business. Most applications are reviewed within one working day; once approved, you&apos;ll see
          trade prices across the shop and get quick order, the price list and your account statement here.
        </p>
      )}
      {status === "PENDING" && (
        <div role="status" className="rounded-card border border-turmeric-200 bg-turmeric-50 p-4">
          <p className="font-semibold text-indigo-ink-950">Your application is being reviewed</p>
          <p className="mt-1 text-sm text-slate-700">
            Sent on {formatDate(account!.submittedAt)}. We usually reply within one working day. Adding a GST certificate or
            a photo of your shop below helps us approve it faster.
          </p>
        </div>
      )}
      {status === "REJECTED" && (
        <div role="alert" className="rounded-card border border-madder-200 bg-madder-50 p-4">
          <p className="font-semibold text-madder-900">We couldn&apos;t approve your application yet</p>
          <p className="mt-1 text-sm text-madder-800">{account!.rejectionReason}</p>
          <p className="mt-2 text-sm text-slate-700">Fix the details below and send it again.</p>
        </div>
      )}
      {status === "SUSPENDED" && (
        <div role="alert" className="rounded-card border border-madder-200 bg-madder-50 p-4">
          <p className="font-semibold text-madder-900">Your wholesale account is on hold</p>
          <p className="mt-1 text-sm text-madder-800">{account!.rejectionReason ?? "Please contact us."}</p>
        </div>
      )}

      {status === "APPROVED" && terms && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile label="Price tier" value={account!.priceTier?.name ?? "Standard"} />
            <Tile
              label="Payment terms"
              value={TERMS_LABEL[terms.terms]}
              detail={
                terms.terms === "ADVANCE_BALANCE"
                  ? `${terms.advancePercent}% advance`
                  : terms.terms === "CREDIT"
                    ? `${terms.creditDays} days${terms.creditLimit != null ? ` · limit ${formatPrice(terms.creditLimit)}` : ""}`
                    : undefined
              }
            />
            <Tile label="Approved" value={account!.reviewedAt ? formatDate(account!.reviewedAt) : "—"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/account/wholesale/quick-order" className="hf-card p-4 transition hover:border-indigo-ink-300">
              <p className="font-semibold text-indigo-ink-950">Quick order →</p>
              <p className="mt-1 text-xs text-slate-500">Quantities per size, many designs at once</p>
            </Link>
            <Link href="/account/wholesale/catalogue" className="hf-card p-4 transition hover:border-indigo-ink-300">
              <p className="font-semibold text-indigo-ink-950">Catalogue & price list →</p>
              <p className="mt-1 text-xs text-slate-500">Print / save as PDF, or download for Excel</p>
            </Link>
            <Link href="/account/wholesale/ledger" className="hf-card p-4 transition hover:border-indigo-ink-300">
              <p className="font-semibold text-indigo-ink-950">Account statement →</p>
              <p className="mt-1 text-xs text-slate-500">Balances due, payments, bank transfers</p>
            </Link>
          </div>
        </section>
      )}

      {status !== "SUSPENDED" && (
        <section className="hf-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Business details</h2>
          <div className="mt-5">
            <ApplicationForm
              status={status}
              businessTypes={BUSINESS_TYPES}
              gstinRequired={settings.wholesale.requireGstin}
              needsPhone={!me?.phone}
              initial={{
                businessName: account?.businessName ?? "",
                legalName: account?.legalName ?? "",
                gstin: account?.gstin ?? "",
                businessType: account?.businessType ?? "",
                addressLine: account?.addressLine ?? "",
                city: account?.city ?? "",
                state: account?.state ?? "",
                pincode: account?.pincode ?? "",
                expectedVolume: account?.expectedVolume ?? "",
                socialUrl: account?.socialUrl ?? "",
                phone: "",
              }}
            />
          </div>
        </section>
      )}

      {account && (
        <section className="hf-card p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Documents</h2>
          <div className="mt-4">
            <DocumentsPanel
              canRemove={status === "PENDING" || status === "REJECTED"}
              documents={account.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="hf-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-indigo-ink-950">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
