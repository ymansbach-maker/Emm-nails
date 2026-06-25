// ============================================================
// Client configuration — edit this file to deploy for a new client.
// ============================================================

export const config = {
  business_name: 'Business Name',
  tagline: 'טקסט תיאור העסק',
  hero_badge: 'סוג העסק',
  phone: '050-0000000',
  whatsapp_number: '9720500000000',
  instagram: 'instagram_handle',
  address: 'כתובת העסק, עיר',
  maps_url: 'https://maps.google.com/?q=כתובת+העסק',
  frontend_url: 'https://your-site.vercel.app',

  // Displayed in the hero section beneath the CTA button.
  hours_display: [
    'א׳, ג׳–ה׳ 10:00–20:00',
    'ו׳ 09:00–14:00',
  ],

  // Maximum days ahead a booking can be made (must match server MAX_DAYS_AHEAD).
  max_days_ahead: 30,

  colors: {
    bg:         '#0a0a0f',
    surface:    '#13131a',
    border:     '#1e1e2e',
    primary:    '#c9a84c',
    secondary:  '#8b6914',
    text:       '#e8e8e8',
    text_muted: '#aaaaaa',
  },

  pricing: [
    { name: 'שירות 1', price: 100 },
    { name: 'שירות 2', price: 150 },
    { name: 'שירות 3', price: 200 },
  ],
} as const;
