import { supabase } from '../lib/supabase';

export type Cota = {
  id: string;
  tag: string;
  descricao: string | null;
  unidade: string;
  valor_nominal: number | null;
  tol_mais: number | null;
  tol_menos: number | null;
  metodo_medicao: string | null;
  criticidade: string | null;
  pos_x: number | null;
  pos_y: number | null;
  pos_set_at?: string | null;
  pos_set_by?: string | null;
};

export async function listCotas(desenhoId: string): Promise<Cota[]> {
  const { data, error } = await supabase
    .from('cotas_criticas')
    .select('id, tag, descricao, unidade, valor_nominal, tol_mais, tol_menos, metodo_medicao, criticidade, pos_x, pos_y, pos_set_at, pos_set_by')
    .eq('desenho_id', desenhoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Cota[];
}

export async function deleteCota(id: string) {
  const { error } = await supabase.from('cotas_criticas').delete().eq('id', id);
  if (error) throw error;
}

export async function createCotaSimple(
  desenhoId: string,
  payload: { tag: string; descricao?: string | null }
) {
  const { data, error } = await supabase
    .from('cotas_criticas')
    .insert({
      desenho_id: desenhoId,
      tag: payload.tag,
      descricao: payload.descricao ?? null,
      unidade: 'mm',
      tol_mais: 0,
      tol_menos: 0,
    })
    .select('id, tag, descricao, unidade, valor_nominal, tol_mais, tol_menos, metodo_medicao, criticidade, pos_x, pos_y, pos_set_at, pos_set_by')
    .single();
  if (error) throw error;
  return data as Cota;
}

export const createCota = createCotaSimple;

export async function updateCota(id: string, patch: Partial<Omit<Cota, 'id'>>) {
  const { data, error } = await supabase
    .from('cotas_criticas')
    .update(patch as any)
    .eq('id', id)
    .select('id, tag, descricao, unidade, valor_nominal, tol_mais, tol_menos, metodo_medicao, criticidade, pos_x, pos_y, pos_set_at, pos_set_by')
    .single();
  if (error) throw error;
  return data as Cota;
}