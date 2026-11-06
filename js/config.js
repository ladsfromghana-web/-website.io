// Public configuration. These two values are SAFE to publish (the anon key only grants what the database's
// row-level-security policies allow). Never put a service-role key or any secret in this file.
// Leave both empty to run the storefront from data/seed.json (read-only) or in local preview mode on localhost.
export const CONFIG = {
  supabaseUrl: "",       // e.g. "https://abcdxyz.supabase.co"
  supabaseAnonKey: "",   // Project Settings -> API -> anon public key
};
