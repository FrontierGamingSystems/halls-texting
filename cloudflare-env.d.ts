declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TD_API_KEY?: string;
    TD_NUMBER?: string;
    BUCKET?: R2Bucket;
  }
}
