import { supabase } from '../lib/supabase';
import { signedUrlDesenho } from './storage';

export type OpRow = {
  id: string;
  status: 'nao_concluida' | 'concluida';
  qtd_total: number | null;
  freq_n: number | null;
  created_at: string;
  amostras: number[] | null;
  desenho: { nome: string } | { nome: string }[] | null;
};

export type OpProgress = {
  op_id: string;
  total_required: number;
  total_done: number;
  pct: number;
  completo: boolean;
}; 

export async function listOpsWithProgress(): Promise<(OpRow & { progress?: OpProgress })[]> {
  const { data: ops, error } = await supabase
    .from('ops')
    .select('id, status, qtd_total, freq_n, created_at, amostras, desenho:desenho_id (nome)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!ops?.length) return [];

  const ids = ops.map((o: any) => o.id);
  const { data: prog, error: e2 } = await supabase
    .from('vw_op_progresso')
    .select('*')
    .in('op_id', ids);
  if (e2) throw e2;

  const map = new Map<string, OpProgress>((prog ?? []).map((p: any) => [p.op_id, p]));
  const opsRows = (ops ?? []) as any[];

  return opsRows.map((o) => ({ ...o, progress: map.get(o.id) })) as (OpRow & { progress?: OpProgress })[];
}

export async function createOp(payload: { id: string; desenho_id: string; qtd_total?: number; freq_n?: number }) {
  const { id, desenho_id, qtd_total, freq_n } = payload;
  const { error } = await supabase.from('ops').insert({ id, desenho_id });
  if (error && error.code !== '23505') throw error; // ignora conflito em reenvio

  if (qtd_total || freq_n) {
    const { error: e2 } = await supabase
      .from('ops')
      .update({ qtd_total: qtd_total ?? null, freq_n: freq_n ?? null })
      .eq('id', id);
    if (e2) throw e2;
  }
}

export async function getOp(id: string) {
  const { data, error } = await supabase
    .from('ops')
    .select(`
      id,
      status,
      qtd_total,
      freq_n,
      amostras,
      created_at,
      desenho_id,
      desenho:desenho_id (
        id,
        nome
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('OP não encontrada');

  // normaliza: alguns joins vêm como array
  const desenho = Array.isArray(data.desenho) ? data.desenho[0] : data.desenho;

  return { ...data, desenho };
}

export async function setOpFields(opId: string, patch: { qtd_total: number | null; freq_n: number | null }) {
  const { data, error } = await supabase
    .from('ops')
    .update(patch)
    .eq('id', opId)
    .select('id, amostras, qtd_total, freq_n')
    .single();
  if (error) throw error;
  return data;
}

export async function forceConcludeOp(id: string) {
  const { error } = await supabase
    .from('ops')
    .update({ status: 'concluida', concluida_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export type MedicaoRow = {
  id: string;
  peca_idx: number;
  valor: number;
  ok: boolean | null;   // <= aqui
  medido_em: string;
  cota: { tag: string } | null;
  autor: { full_name: string | null } | null;
};

export async function listOpsAbertas() {
  const { data, error } = await supabase
    .from('ops')
    .select('id, status, desenho:desenho_id ( id, nome, imagem_path ), amostras, qtd_total, freq_n, created_at')
    .neq('status', 'concluida')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data?.map((o: any) => ({
    ...o,
    desenhoNome: Array.isArray(o.desenho) ? o.desenho[0]?.nome : o.desenho?.nome ?? '-',
  })) as any[];
}

export async function getOpOperador(id: string) {
  // OP, desenho (com URL assinada), cotas do desenho (com pos)
  const { data: op, error } = await supabase
    .from('ops')
    .select('id, status, desenho:desenho_id ( id, nome, imagem_path ), amostras, qtd_total, freq_n')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!op) throw new Error('OP não encontrada');

  const desenho = Array.isArray(op.desenho) ? op.desenho[0] : op.desenho;
  const url = desenho?.imagem_path ? await signedUrlDesenho(desenho.imagem_path) : null;

  const { data: cotas, error: e2 } = await supabase
    .from('cotas_criticas')
    .select('id, tag, pos_x, pos_y')
    .eq('desenho_id', desenho.id)
    .order('created_at', { ascending: true });
  if (e2) throw e2;

  return { op, desenho, url, cotas };
}

export async function inserirMedicao(payload: {
  op_id: string;
  cota_id: string;
  peca_idx: number;
  valor: number;
}) {
  const { data, error } = await supabase
    .from('op_medicoes')
    .insert(payload)
    .select(
      // 👇 inclui cota_id "plano" para o cálculo de conclusão
      'id, peca_idx, valor, ok, medido_em, cota_id, cota:cota_id ( tag ), autor:medido_por ( full_name )'
    )
    .single();
  if (error) throw error;
  return data;
}

export async function listarMedicoesDaOp(op_id: string) {
  const { data, error } = await supabase
    .from('op_medicoes')
    .select('id, peca_idx, valor, ok, medido_em, cota_id, cota:cota_id ( tag ), autor:medido_por ( full_name )')
    .eq('op_id', op_id)
    .order('medido_em', { ascending: false });
  if (error) throw error;
  return data;
}
export { listarMedicoesDaOp as listOpMedicoes };

export async function concluirOp(op_id: string) {
  const { error } = await supabase
    .from('ops')
    .update({ status: 'concluida' })
    .eq('id', op_id);
  if (error) throw error;
}