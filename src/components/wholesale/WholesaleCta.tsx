import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

/** The right next step for this visitor: apply, check status, or order. */
export default function WholesaleCta({ user, whatsapp }: { user: SessionUser | null; whatsapp: string | null }) {
  const status = user?.wholesaleStatus ?? null;
  return (
    <div className="flex flex-wrap gap-3">
      {!user && (
        <>
          <Link href="/signup?type=wholesale" className="hf-btn hf-btn-accent px-6 py-3">
            Apply for a wholesale account
          </Link>
          <Link href="/login?next=/account/wholesale" className="hf-btn px-6 py-3 text-cotton-50 ring-1 ring-inset ring-cotton-50/30 hover:bg-cotton-50/10">
            Sign in
          </Link>
        </>
      )}
      {user && !status && (
        <Link href="/account/wholesale" className="hf-btn hf-btn-accent px-6 py-3">
          Apply for a wholesale account
        </Link>
      )}
      {user && (status === "PENDING" || status === "REJECTED" || status === "SUSPENDED") && (
        <Link href="/account/wholesale" className="hf-btn hf-btn-accent px-6 py-3">
          {status === "PENDING" ? "See your application" : "Check your wholesale account"}
        </Link>
      )}
      {status === "APPROVED" && (
        <>
          <Link href="/account/wholesale/quick-order" className="hf-btn hf-btn-accent px-6 py-3">
            Quick order
          </Link>
          <Link href="/account/wholesale/catalogue" className="hf-btn px-6 py-3 text-cotton-50 ring-1 ring-inset ring-cotton-50/30 hover:bg-cotton-50/10">
            Price list & catalogue
          </Link>
        </>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="hf-btn bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700"
        >
          WhatsApp us
        </a>
      )}
    </div>
  );
}
