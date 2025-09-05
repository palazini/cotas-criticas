import { supabase } from '../lib/supabase';

export async function uploadDesenhoFile(file: File, desenhoId: string) {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${desenhoId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('desenhos').upload(path, file, {
    cacheControl: '60',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function signedUrlDesenho(path: string, expiresInSec = 300) {
  const { data, error } = await supabase.storage.from('desenhos').createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return `${data.signedUrl}&cb=${Date.now()}`; // cache-buster
}
