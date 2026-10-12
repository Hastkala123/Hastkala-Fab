import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, WholesaleStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import { getSettings } from "@/server/settings";
import { outstandingBalance } from "@/server/wholesale/account";
import InquiryRow from "./InquiryRow";
import ReviewPanel from "./ReviewPanel";
import TierManager from "./TierManager";

export const metadata: Metadata = { title: "Wholesale" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "applications", label: "Applications" },
  { key: "buyers", label: "Buyers" },
  { key: "inquiries", label: "Enquiries" },
  { key: "tiers", label: "Price tiers" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const DOC_LABELS: Record<string, string> = {
  GST_CERTIFICATE: "GST certificate",
  SHOP_PHOTO: "Shop photo",
  VISITING_CARD: "Visiting card",
  OTHER: "Document",
};

const TERMS: Record<string, string> = { PREPAID: "Prepaid", ADVANCE_BALANCE: "Advance + balance", CREDIT: "Credit" };

export default async function AdminWholesalePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireStaffPage("wholesale.manage");
  const params = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === params.tab)?.key ?? "applications";

  const [counts, tiers, settings, newInquiries] = await Promise.all([
    db.wholesaleProfile.groupBy({ by: ["status"], _count: { id: true } }),
    db.priceTier.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { profiles: true } } },
    }),
    getSettings(),
    db.wholesaleInquiry.count({ where: { status: "NEW" } }),
  ]);
  const count = (s: WholesaleStatus) => counts.find((c) => c.status === s)?._count.id ?? 0;
  const tierOptions = tiers.map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault }));
  const defaults = { advancePercent: settings.wholesale.advancePercent, creditDays: settings.wholesale.creditDays };
  const badge: Record<Tab, number> = {
    applications: count("PENDING"),
    buyers: count("APPROVED") + count("SUSPENDED"),
    inquiries: newInquiries,
    tiers: tiers.length,
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Wholesale</h1>
      <p className="mt-1 text-sm text-slate-600">
        Approve trade buyers, set their price tier and payment terms, and follow up enquiries.{" "}
        <Link href="/admin/settings#wholesale" className="hf-link">
          Wholesale settings
        </Link>{" "}
        ·{" "}
        <Link href="/wholesale" className="hf-link" target="_blank">
          View /wholesale page
        </Link>
      </p>

      <nav aria-label="Wholesale sections" className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/wholesale?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`hf-btn py-1.5 text-sm ${tab === t.key ? "hf-btn-primary" : "hf-btn-outline"}`}
          >
            {t.label}
            {badge[t.key] > 0 && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{badge[t.key]}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "applications" && <Applications tierOptions={tierOptions} defaults={defaults} />}
        {tab === "buyers" && <Buyers tierOptions={tierOptions} defaults={defaults} query={params.q ?? ""} />}
        {tab === "inquiries" && <Inquiries />}
        {tab === "tiers" && (
          <TierManager
            tiers={await Promise.all(
              tiers.map(async (t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                isDefault: t.isDefault,
                buyers: t._count.profiles,
                prices: (await db.wholesalePrice.groupBy({ by: ["productId"], where: { priceTierId: t.id } })).length,
              })),
            )}
          />
        )}
      </div>
    </div>
  );
}

const profileInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
  documents: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true } },
  priceTier: { select: { name: true } },
} satisfies Prisma.WholesaleProfileInclude;

type ProfileRow = Prisma.WholesaleProfileGetPayload<{ include: typeof profileInclude }>;
type TierOption = { id: string; name: string; isDefault: boolean };
type Defaults = { advancePercent: number; creditDays: number };

async function Applications({ tierOptions, defaults }: { tierOptions: TierOption[]; defaults: Defaults }) {
  const profiles = await db.wholesaleProfile.findMany({
    where: { status: { in: ["PENDING", "REJECTED"] } },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    take: 100,
    include: profileInclude,
  });
  if (profiles.length === 0) return <Empty text="No applications waiting. 🎉" />;
  return (
    <ul className="space-y-4">
      {profiles.map((p) => (
        <li key={p.id} className="hf-card p-5">
          <ProfileSummary profile={p} />
          <div className="mt-4 border-t border-cotton-200 pt-4">
            <ReviewPanel profileId={p.id} status={p.status} tiers={tierOptions} terms={p} defaults={defaults} />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function Buyers({ tierOptions, defaults, query }: { tierOptions: TierOption[]; defaults: Defaults; query: string }) {
  const q = query.trim();
  const profiles = await db.wholesaleProfile.findMany({
    where: {
      status: { in: ["APPROVED", "SUSPENDED"] },
      ...(q
        ? {
            OR: [
              { businessName: { contains: q, mode: "insensitive" } },
              { gstin: { contains: q.toUpperCase() } },
              { city: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { businessName: "asc" },
    take: 100,
    include: profileInclude,
  });
  const balances = await Promise.all(profiles.map((p) => outstandingBalance(db, p.userId)));
  return (
    <div>
      <form className="mb-4 flex gap-2" action="/admin/wholesale">
        <input type="hidden" name="tab" value="buyers" />
        <input name="q" defaultValue={q} placeholder="Business, GSTIN, city or email" className="hf-input max-w-sm" aria-label="Search buyers" />
        <button className="hf-btn hf-btn-outline">Search</button>
      </form>
      {profiles.length === 0 ? (
        <Empty text={q ? "No buyers match." : "No approved buyers yet."} />
      ) : (
        <ul className="space-y-4">
          {profiles.map((p, i) => (
            <li key={p.id} className="hf-card p-5">
              <ProfileSummary profile={p} />
              <p className="mt-2 text-sm">
                <span className="text-slate-500">Tier:</span> <strong>{p.priceTier?.name ?? "Default"}</strong> ·{" "}
                <span className="text-slate-500">Terms:</span> <strong>{TERMS[p.paymentTerms]}</strong>
                {p.paymentTerms === "CREDIT" && p.creditLimit != null && ` (limit ${formatPrice(p.creditLimit)})`} ·{" "}
                <span className="text-slate-500">Balance due:</span>{" "}
                <strong className={balances[i]! > 0 ? "text-madder-700" : ""}>{formatPrice(balances[i]!)}</strong>
              </p>
              <details className="mt-3 border-t border-cotton-200 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-indigo-ink-800">Change tier, terms or status</summary>
                <div className="mt-3">
                  <ReviewPanel profileId={p.id} status={p.status} tiers={tierOptions} terms={p} defaults={defaults} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileSummary({ profile: p }: { profile: ProfileRow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-display text-lg font-bold text-indigo-ink-950">
          {p.businessName}{" "}
          <span
            className={`hf-badge ml-1 align-middle ${
              p.status === "APPROVED" ? "text-emerald-700" : p.status === "PENDING" ? "text-turmeric-700" : "text-madder-700"
            }`}
          >
            {p.status.toLowerCase()}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          {p.user.name} · {p.user.email ?? ""}
          {p.user.phone ? ` · ${formatIndianMobile(p.user.phone)}` : ""}
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Detail label="GSTIN" value={p.gstin ?? "Not given"} />
          <Detail label="Legal name" value={p.legalName} />
          <Detail label="Business" value={p.businessType} />
          <Detail label="Location" value={[p.addressLine, p.city, p.state, p.pincode].filter(Boolean).join(", ")} />
          <Detail label="Expected purchase" value={p.expectedVolume} />
          <Detail label="Instagram / website" value={p.socialUrl} />
        </dl>
        {p.rejectionReason && p.status !== "APPROVED" && <p className="mt-2 text-sm text-madder-700">Reason given: {p.rejectionReason}</p>}
        {p.staffNotes && <p className="mt-2 text-sm text-slate-600">Notes: {p.staffNotes}</p>}
      </div>
      <div className="text-right text-xs text-slate-500">
        <p>Applied {formatDate(p.submittedAt)}</p>
        <Link href={`/admin/customers/${p.user.id}`} className="hf-link font-semibold">
          Customer profile →
        </Link>
        {p.documents.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {p.documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/admin/wholesale/documents/${d.id}`} target="_blank" rel="noopener" className="hf-link">
                  {DOC_LABELS[d.kind] ?? d.kind}: {d.fileName}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">No documents uploaded</p>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500">{label}:</dt>
      <dd className="font-medium text-indigo-ink-900">{value}</dd>
    </div>
  );
}

async function Inquiries() {
  const inquiries = await db.wholesaleInquiry.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  if (inquiries.length === 0) return <Empty text="No enquiries yet. They arrive from the /wholesale pages." />;
  return (
    <ul className="space-y-3">
      {inquiries.map((inq) => (
        <li key={inq.id} className={`hf-card p-4 ${inq.status === "NEW" ? "border-turmeric-300" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-indigo-ink-950">
                {inq.name}
                {inq.businessName ? ` · ${inq.businessName}` : ""}
                {inq.city ? ` · ${inq.city}` : ""}
              </p>
              <p className="text-sm">
                <a href={`tel:${inq.phone}`} className="hf-link">
                  {formatIndianMobile(inq.phone)}
                </a>
                {inq.email && (
                  <>
                    {" · "}
                    <a href={`mailto:${inq.email}`} className="hf-link">
                      {inq.email}
                    </a>
                  </>
                )}
              </p>
              {inq.categoriesOfInterest.length > 0 && <p className="mt-1 text-xs text-slate-500">Interested in: {inq.categoriesOfInterest.join(", ")}</p>}
              {inq.message && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{inq.message}</p>}
            </div>
            <p className="text-xs text-slate-400">
              {formatDateTime(inq.createdAt)}
              {inq.source ? ` · ${inq.source}` : ""}
            </p>
          </div>
          <InquiryRow id={inq.id} status={inq.status} staffNotes={inq.staffNotes} />
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="hf-card p-8 text-center text-sm text-slate-500">{text}</p>;
}
