import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 匿名登录尚未配置");
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

function audioExtension(contentType: string) {
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("wav")) return "wav";
  return "webm";
}

export async function uploadVoiceObject(userId: string, blob: Blob) {
  const path = `${userId}/${crypto.randomUUID()}.${audioExtension(blob.type)}`;
  const { error } = await getSupabaseClient()
    .storage.from("voice-messages")
    .upload(path, blob, {
      contentType: blob.type || "audio/webm",
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function createVoiceSignedUrl(path: string) {
  const { data, error } = await getSupabaseClient()
    .storage.from("voice-messages")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
