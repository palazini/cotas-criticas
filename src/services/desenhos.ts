import { supabase } from '../lib/supabase';

export type Desenho = {
  id: string;
  nome: string;
  imagem_bucket: string | null;
  imagem_path: string | null;
};

export async function listDesenhos(): Promise<Desenho[]> {
  const { data, error } = await supabase
    .from('desenhos')
    .select('id, nome, imagem_bucket, imagem_path')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Desenho[];
}

export async function createDesenho(payload: { nome: string; imagem_path?: string | null }) {
  const { data, error } = await supabase
    .from('desenhos')
    .insert({ nome: payload.nome, imagem_bucket: 'desenhos', imagem_path: payload.imagem_path ?? null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getDesenho(id: string): Promise<Desenho | null> {
  const { data, error } = await supabase
    .from('desenhos')
    .select('id, nome, imagem_bucket, imagem_path')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Desenho | null;
}

export async function deleteDesenho(id: string) {
  const { error } = await supabase.from('desenhos').delete().eq('id', id);
  if (error) throw error;
}
