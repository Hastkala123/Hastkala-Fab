import Link from "next/link";

/** Shown on buyer-only wholesale pages to anyone not yet approved. */
export default function NotApproved() {
  return (
    <div className="hf-card p-8 text-center">
      <p className="font-semibold text-indigo-ink-950">This is for approved wholesale buyers</p>
      <p className="mt-2 text-sm text-slate-600">Apply for a wholesale account to see trade prices and order in bulk.</p>
      <Link href="/account/wholesale" className="hf-btn hf-btn-primary mt-5">
        Wholesale account
      </Link>
    </div>
  );
}
