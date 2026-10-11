import { GST_STATE_CODES } from "./gstin";

/**
 * How each store setting is edited in Admin → Settings. The rules (allowed
 * values, defaults) live in src/server/settings/schema.ts; this file only
 * describes the form. Money fields are typed in rupees and saved as paise.
 */

export type SettingField = {
  name: string;
  label: string;
  hint?: string;
  kind: "text" | "textarea" | "money" | "money-or-blank" | "int" | "bool" | "select";
  options?: { value: string; label: string }[];
};

export type SettingSection = { key: string; title: string; description: string; fields: SettingField[] };

const STATE_OPTIONS = Object.entries(GST_STATE_CODES).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

export const SETTING_SECTIONS: SettingSection[] = [
  {
    key: "store.profile",
    title: "Business details",
    description: "Printed on invoices and shown in the shop footer and legal pages.",
    fields: [
      { name: "displayName", label: "Shop name", kind: "text" },
      { name: "legalName", label: "Legal / registered name", kind: "text" },
      { name: "gstin", label: "Your GSTIN", kind: "text" },
      { name: "stateCode", label: "State of business (decides CGST+SGST vs IGST)", kind: "select", options: STATE_OPTIONS },
      { name: "addressLine1", label: "Address line 1", kind: "text" },
      { name: "addressLine2", label: "Address line 2", kind: "text" },
      { name: "city", label: "City", kind: "text" },
      { name: "state", label: "State", kind: "text" },
      { name: "pincode", label: "PIN code", kind: "text" },
      { name: "phone", label: "Phone", kind: "text" },
      { name: "whatsapp", label: "WhatsApp number", kind: "text" },
      { name: "email", label: "Support email", kind: "text" },
      { name: "grievanceOfficerName", label: "Grievance officer — name", kind: "text", hint: "Required by the Consumer Protection (E-Commerce) Rules." },
      { name: "grievanceOfficerEmail", label: "Grievance officer — email", kind: "text" },
      { name: "grievanceOfficerPhone", label: "Grievance officer — phone", kind: "text" },
      { name: "invoicePrefix", label: "Invoice number prefix", kind: "text", hint: "1–4 capital letters/numbers, e.g. HF → HF/26-27/000123." },
    ],
  },
  {
    key: "shipping",
    title: "Shipping",
    description: "Delivery charges and the delivery promise shown on product pages.",
    fields: [
      { name: "freeShippingThreshold", label: "Free shipping on retail orders from (₹)", kind: "money-or-blank", hint: "Leave blank for never free." },
      { name: "retailFee", label: "Retail shipping charge (₹)", kind: "money" },
      { name: "wholesaleFee", label: "Wholesale freight charge (₹)", kind: "money", hint: "0 = arranged separately." },
      { name: "dispatchText", label: "Dispatch promise", kind: "text" },
      { name: "deliveryText", label: "Delivery time text", kind: "text" },
    ],
  },
  {
    key: "cod",
    title: "Cash on delivery",
    description: "Whether COD is offered, what it costs and its limits.",
    fields: [
      { name: "enabled", label: "Offer cash on delivery", kind: "bool" },
      { name: "fee", label: "COD fee (₹)", kind: "money" },
      { name: "maxOrderValue", label: "Maximum COD order (₹)", kind: "money-or-blank", hint: "Leave blank for no limit." },
      { name: "otpAboveValue", label: "Ask for a phone code on COD orders above (₹)", kind: "money-or-blank" },
    ],
  },
  {
    key: "returns",
    title: "Returns",
    description: "Your return policy, shown on product pages and orders.",
    fields: [
      { name: "windowDays", label: "Return window (days after delivery)", kind: "int", hint: "0 = no returns." },
      { name: "allowExchange", label: "Allow exchanges", kind: "bool" },
      { name: "conditionsText", label: "Return conditions", kind: "textarea" },
      { name: "returnShippingDeduction", label: "Deduct from refunds for change-of-mind returns (₹)", kind: "money" },
    ],
  },
  {
    key: "tax",
    title: "GST and invoices",
    description: "How GST is charged. Confirm these with your CA.",
    fields: [
      { name: "wholesalePricesIncludeTax", label: "Wholesale prices already include GST", kind: "bool", hint: "Off = wholesale prices are shown “+ GST”." },
      {
        name: "feeTaxMode",
        label: "GST on shipping and fees",
        kind: "select",
        options: [
          { value: "PROPORTIONAL", label: "Proportional to the items' GST rates" },
          { value: "HIGHEST_RATE", label: "Highest item rate" },
        ],
      },
      { name: "roundTotalToRupee", label: "Round order totals to the nearest rupee", kind: "bool" },
      {
        name: "invoiceTrigger",
        label: "Issue the GST invoice when the order is",
        kind: "select",
        options: [
          { value: "CONFIRMED", label: "Confirmed" },
          { value: "SHIPPED", label: "Shipped" },
        ],
      },
      { name: "ratesConfirmedByCa", label: "My CA has confirmed the HSN codes and GST rates", kind: "bool" },
    ],
  },
  {
    key: "checkout",
    title: "Checkout",
    description: "Payment window, gift wrap and quantity limits.",
    fields: [
      { name: "paymentWindowMinutes", label: "Hold stock for unpaid online orders (minutes)", kind: "int" },
      { name: "giftWrapEnabled", label: "Offer gift wrap", kind: "bool" },
      { name: "giftWrapFee", label: "Gift wrap charge (₹)", kind: "money" },
      { name: "maxQuantityPerLine", label: "Most pieces of one item per retail order", kind: "int" },
    ],
  },
  {
    key: "wholesale",
    title: "Wholesale",
    description: "Rules for trade buyers.",
    fields: [
      { name: "minOrderValue", label: "Minimum wholesale order (₹)", kind: "money" },
      { name: "maxQuantityPerLine", label: "Most pieces of one item per wholesale order", kind: "int" },
      { name: "requireGstin", label: "Require a GSTIN to apply", kind: "bool" },
    ],
  },
  {
    key: "seo",
    title: "Search and social",
    description: "Defaults for Google and social media.",
    fields: [
      { name: "defaultTitle", label: "Default page title", kind: "text", hint: "Up to 70 characters." },
      { name: "defaultDescription", label: "Default description", kind: "textarea", hint: "Up to 170 characters." },
      { name: "instagramUrl", label: "Instagram link", kind: "text" },
      { name: "facebookUrl", label: "Facebook link", kind: "text" },
      { name: "youtubeUrl", label: "YouTube link", kind: "text" },
    ],
  },
];
