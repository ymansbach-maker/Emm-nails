// ============================================================
// Client configuration — edit this file to deploy for a new client.
// ============================================================

// Staff members — must mirror server/src/config.js WORKERS.
export const WORKERS = ['Emmy', 'Noa'] as const;

export const config = {
  business_name: 'Emm Nails',
  tagline: 'יופי מדויק. חוויה בלתי נשכחת.',
  hero_badge: 'סטודיו לציפורניים',
  phone: '050-1234567',
  whatsapp_number: '972501234567',
  instagram: 'Emm.Nails',
  address: 'הרצל, ירושלים',
  maps_url: 'https://maps.google.com/?q=הרצל,ירושלים',
  frontend_url: 'https://your-site.vercel.app',

  // Displayed in the hero section beneath the CTA button.
  hours_display: [
    'א׳–ה׳ 10:00–16:00',
    'ו׳ 10:00–14:00',
  ],

  // Maximum days ahead a booking can be made (must match server MAX_DAYS_AHEAD).
  max_days_ahead: 30,

  colors: {
    bg:         '#12091e',
    surface:    '#1e1133',
    border:     '#3d2060',
    primary:    '#9b59d0',
    secondary:  '#d4a5f5',
    text:       '#f5eeff',
    text_muted: '#b89fd4',
  },

  pricing: [
    { name: "לק ג'ל על ציפורן טבעית", price: 120 },
    { name: "לק ג'ל + מבנה אנטומי", price: 140 },
    { name: "לק ג'ל פרנץ'", price: 150 },
    { name: "הסרת לק ג'ל בלבד", price: 50 },
    { name: "הסרת לק ג'ל + טיפול חדש", price: 30 },
    { name: "בנייה ראשונה בג'ל", price: 250 },
    { name: "מילוי בנייה בג'ל", price: 180 },
    { name: "תיקון ציפורן שבורה", price: 15 },
    { name: "קישוט פשוט (לאצבע)", price: 5 },
    { name: "קישוט מורכב (לאצבע)", price: 10 },
    { name: "פדיקור + לק ג'ל", price: 180 },
    { name: "לק ג'ל ברגליים", price: 120 },
  ],
} as const;
