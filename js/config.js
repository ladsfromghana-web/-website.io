// Public configuration. These two values are SAFE to publish (the anon key only grants what the database's
// row-level-security policies allow). Never put a service-role key or any secret in this file.
// Leave both empty to run the storefront from data/seed.json (read-only) or in local preview mode on localhost.
export const CONFIG = {
  supabaseUrl: "https://ozhygnjreetosnujbwoh.supabase.co",       // e.g. "https://abcdxyz.supabase.co"
  supabaseAnonKey: "sb_publishable_2LvyuEpm5uG6NdT0ZR5XFA_DKsW6oJa",   // Project Settings -> API -> anon public key
};
