import Link from "next/link";
import { whatsappLink } from "@/lib/wholesale-content";
import { getSettings } from "@/server/settings";
import { contentValues } from "@/server/content/pages";
import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("contact", "Contact us");

/** The page text comes from Admin → Content; the details beside it from Settings → Business details. */
export default async function ContactPage() {
  const settings = await getSettings();
  const profile = settings["store.profile"];
  const { address } = contentValues(settings);
  const whatsapp = profile.whatsapp ? whatsappLink(profile.whatsapp, "Hello Hastkala Fab!") : null;

  return (
    <ContentPage slug="contact" fallbackTitle="Contact us">
      <div className="hf-card space-y-4 p-5 text-sm">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Reach us</h2>
        {profile.phone && (
          <p>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
            <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`} className="hf-link font-medium">
              {profile.phone}
            </a>
          </p>
        )}
        {whatsapp && (
          <p>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">WhatsApp</span>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="hf-link font-medium">
              Chat on WhatsApp
            </a>
          </p>
        )}
        {profile.email && (
          <p>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <a href={`mailto:${profile.email}`} className="hf-link font-medium break-all">
              {profile.email}
            </a>
          </p>
        )}
        {address && (
          <p>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
            <span className="text-slate-700">{address}</span>
          </p>
        )}
        <div className="space-y-2 border-t border-cotton-200 pt-4">
          <p className="text-slate-600">About an order? Raise it from your account so we can see the order straight away.</p>
          <Link href="/account/support" className="hf-btn hf-btn-primary w-full">
            Help Centre
          </Link>
          <Link href="/track" className="hf-btn hf-btn-outline w-full">
            Track an order
          </Link>
          <Link href="/wholesale#enquiry" className="block pt-1 text-center text-xs font-semibold text-indigo-ink-700 hover:underline">
            Buying for a shop? Send a wholesale enquiry →
          </Link>
        </div>
      </div>
    </ContentPage>
  );
}
