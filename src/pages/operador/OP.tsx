import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon, Badge, Button, Card, Group, Image, Loader, Modal, NumberInput, Stack, Table, Text, rem
} from '@mantine/core';
import { IconCheck, IconTrash } from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';
import { supabase } from '../../lib/supabase';
import Numpad from '../../components/Numpad';
import { notifications } from '@mantine/notifications';

type OP = { id: string; codigo: string; status: 'aberta'|'concluida'; desenho_id: string; qty: number|null; freq: number|null };
type Desenho = { id: string; codigo: string; nome: string; imagem_url: string };
type Cota = {
  id: string; etiqueta: string; x_percent: number; y_percent: number;
  nominal: number | null; tol_menos: number | null; tol_mais: number | null; unidade: string | null;
};
type Amostra = { id: string; indice: number; status: 'pendente'|'concluida' };
type Med = { id: string; amostra_id: string; cota_id: string; valor: number };

function fmtDecimalBR(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OperadorOP() {
  const { opId } = useParams();
  const nav = useNavigate();

  const [op, setOp] = useState<OP | null>(null);
  const [desenho, setDesenho] = useState<Desenho | null>(null);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentAmostraId, setCurrentAmostraId] = useState<string | null>(null);

  // teclado numérico
  const [padOpen, setPadOpen] = useState(false);
  const [padTarget, setPadTarget] = useState<{ cotaId: string; label: string } | null>(null);
  const [padInitial, setPadInitial] = useState<string>('');

  // gerar amostras se faltarem
  const [genOpen, setGenOpen] = useState(false);
  const [qty, setQty] = useState<number | ''>('');
  const [freq, setFreq] = useState<number | ''>('');

  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // OP
      const opq = await supabase.from('ops').select('id,codigo,status,desenho_id,qty,freq').eq('id', opId).single();
      if (opq.error || !opq.data) {
        notifications.show({ color: 'red', title: 'OP não encontrada', message: opq.error?.message });
        nav('/operador');
        return;
      }
      setOp(opq.data as OP);

      // Desenho
      const dq = await supabase.from('desenhos').select('id,codigo,nome,imagem_url').eq('id', opq.data.desenho_id).single();
      if (!dq.error && dq.data) setDesenho(dq.data as Desenho);

      // Cotas do desenho (com tolerâncias)
      const cq = await supabase
        .from('cotas')
        .select('id,etiqueta,x_percent,y_percent,nominal,tol_menos,tol_mais,unidade')
        .eq('desenho_id', opq.data.desenho_id)
        .order('etiqueta');
      if (!cq.error && cq.data) setCotas(cq.data as Cota[]);

      // Amostras da OP
      const aq = await supabase.from('op_amostras').select('id,indice,status').eq('op_id', opId).order('indice');
      let amostrasIds: string[] = [];
      if (!aq.error && aq.data) {
        setAmostras(aq.data as Amostra[]);
        if (aq.data.length > 0) {
          setCurrentAmostraId(aq.data[0].id);
          amostrasIds = aq.data.map((a: any) => a.id);
        }
      }

      // Mediçõess da OP (todas, para contagem) — só consulta se houver IDs
      if (amostrasIds.length > 0) {
        const mq = await supabase
          .from('medicoes')
          .select('id,amostra_id,cota_id,valor')
          .in('amostra_id', amostrasIds);
        if (!mq.error && mq.data) setMeds(mq.data as Med[]);
      } else {
        setMeds([]);
      }

      setLoading(false);
    })();
  }, [opId, nav]);

  // contagem por amostra
  const medsByAmostra = useMemo(() => {
    const map = new Map<string, Med[]>();
    for (const m of meds) {
      const arr = map.get(m.amostra_id) ?? [];
      arr.push(m);
      map.set(m.amostra_id, arr);
    }
    return map;
  }, [meds]);

  const currentAmostra = useMemo(() => amostras.find(a => a.id === currentAmostraId) ?? null, [amostras, currentAmostraId]);

  // gerar amostras (quando não houver)
  function buildIndices(q?: number|'', f?: number|'') {
    if (!q || !f || q <= 0 || f <= 0) return [] as number[];
    const out: number[] = [];
    for (let i = f as number; i <= (q as number); i += (f as number)) out.push(i);
    return out;
  }

  // helper para NumberInput
  const toIntOrEmpty = (v: string | number): number | '' =>
    typeof v === 'number' && Number.isFinite(v) ? v : '';

  // validação de tolerância
  function checkDentro(c: Cota, valor: number) {
    if (c.nominal == null || c.tol_mais == null || c.tol_menos == null) return null;
    const min = Number(c.nominal) - Number(c.tol_menos);
    const max = Number(c.nominal) + Number(c.tol_mais);
    return valor >= min && valor <= max;
  }
  function specStr(c: Cota) {
    if (c.nominal == null) return '';
    const u = c.unidade || 'mm';
    const p = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mais = c.tol_mais != null ? ` +${p(Number(c.tol_mais))}` : '';
    const menos = c.tol_menos != null ? ` / -${p(Number(c.tol_menos))}` : '';
    return `${p(Number(c.nominal))}${u}${mais}${menos}`;
  }

  async function confirmGerarAmostras() {
    if (!op) return;
    const idx = buildIndices(qty, freq);
    if (idx.length === 0) { setGenOpen(false); return; }

    const rows = idx.map((i) => ({ op_id: op.id, indice: i }));
    const { data: insData, error: insErr } = await supabase
      .from('op_amostras')
      .insert(rows)
      .select('id,indice,status')
      .order('indice');

    if (insErr) {
      notifications.show({ color: 'red', title: 'Erro ao gerar amostras', message: insErr.message });
      setGenOpen(false);
      return;
    }

    // grava qty/freq na OP via RPC (security definer)
    await supabase.rpc('op_set_qty_freq', {
      p_op: op.id,
      p_qty: qty === '' ? null : qty,
      p_freq: freq === '' ? null : freq,
      p_source: 'operador'
    });

    setAmostras((insData ?? []) as Amostra[]);
    if (insData && insData.length > 0) setCurrentAmostraId(insData[0].id);
    notifications.show({ color: 'teal', title: 'Amostras criadas', message: idx.join(', ') });
    setGenOpen(false);
  }

  // abrir teclado para cota
  function openPad(c: Cota) {
    if (!currentAmostra) return;
    const exist = meds.find(m => m.amostra_id === currentAmostra.id && m.cota_id === c.id);
    setPadInitial(exist ? fmtDecimalBR(Number(exist.valor)) : '');
    const extra = specStr(c);
    setPadTarget({ cotaId: c.id, label: `Cota ${c.etiqueta} — Peça ${currentAmostra.indice}${extra ? ` (${extra})` : ''}` });
    setPadOpen(true);
  }

  async function confirmPad(valorStr: string) {
    setPadOpen(false);
    if (!currentAmostra || !padTarget) return;
    if (!valorStr) return;

    const parsed = Number(valorStr.replace('.', '').replace(',', '.')); // "12,34" -> 12.34
    const row = { amostra_id: currentAmostra.id, cota_id: padTarget.cotaId, valor: parsed };

    const up = await supabase
      .from('medicoes')
      .upsert(row, { onConflict: 'amostra_id,cota_id' })
      .select('id,amostra_id,cota_id,valor')
      .single();

    if (up.error) {
      notifications.show({ color: 'red', title: 'Erro ao salvar', message: up.error.message });
    } else {
      // atualiza local
      setMeds((prev) => {
        const others = prev.filter(m => !(m.amostra_id === row.amostra_id && m.cota_id === row.cota_id));
        return [...others, up.data as Med];
      });

      const cotaRef = cotas.find(x => x.id === padTarget.cotaId)!;
      const isOk = checkDentro(cotaRef, parsed);
      notifications.show({
        color: isOk === null ? 'indigo' : isOk ? 'teal' : 'red',
        title: isOk === null ? 'Valor lançado' : isOk ? 'Dentro da tolerância' : 'Fora da tolerância',
        message: padTarget.label
      });
    }
  }

  async function excluirValor(m: Med) {
    const del = await supabase.from('medicoes').delete().eq('id', m.id);
    if (del.error) {
      notifications.show({ color: 'red', title: 'Erro ao excluir', message: del.error.message });
    } else {
      setMeds((prev) => prev.filter(x => x.id !== m.id));
    }
  }

  // todas as cotas preenchidas para todas as amostras?
  const prontoParaConcluir = useMemo(() => {
    if (cotas.length === 0 || amostras.length === 0) return false;
    for (const a of amostras) {
      const count = medsByAmostra.get(a.id)?.length ?? 0;
      if (count < cotas.length) return false;
    }
    return true;
  }, [cotas.length, amostras, medsByAmostra]);

  async function concluirOP() {
    if (!op) return;
    if (!prontoParaConcluir) {
      notifications.show({ color: 'orange', title: 'Faltam valores', message: 'Complete todas as cotas de todas as peças.' });
      return;
    }
    const upd = await supabase.from('ops').update({ status: 'concluida' }).eq('id', op.id);
    if (upd.error) {
      notifications.show({ color: 'red', title: 'Erro ao concluir', message: upd.error.message });
    } else {
      notifications.show({ color: 'teal', icon: <IconCheck />, title: 'OP concluída', message: op.codigo });
      nav('/operador');
    }
  }

  if (loading || !op || !desenho) {
    return (
      <Card withBorder radius="lg">
        <Group justify="center" py="xl"><Loader /></Group>
      </Card>
    );
  }

  // amostra corrente: histórico (com OK/Fora)
  const historico = (currentAmostra ? meds.filter(m => m.amostra_id === currentAmostra.id) : [])
    .map(m => ({ ...m, cota: cotas.find(c => c.id === m.cota_id)?.etiqueta || '?' }))
    .sort((a,b) => a.cota.localeCompare(b.cota));

  return (
    <>
      <PageHeader
        title={`${op.codigo} — ${desenho.codigo} / ${desenho.nome}`}
        subtitle={op.status === 'aberta' ? 'Clique nas cotas para lançar valores' : 'Concluída'}
        rightSection={<Button variant="default" onClick={() => nav('/operador')}>Voltar</Button>}
      />

      {/* Se não há amostras, o operador pode gerar */}
      {amostras.length === 0 && op.status === 'aberta' && (
        <Card withBorder radius="lg" mb="md">
          <Group justify="space-between">
            <Text>Esta OP não possui amostras. Gerar a partir de Qty/Freq?</Text>
            <Button onClick={() => setGenOpen(true)}>Gerar Amostras</Button>
          </Group>
        </Card>
      )}

      <Group align="flex-start" gap="md" wrap="nowrap">
        {/* imagem + pinos */}
        <Card withBorder radius="lg" p="sm" style={{ flex: 2, minWidth: rem(420) }}>
          <div ref={wrapRef} style={{ position: 'relative' }}>
            <Image src={desenho.imagem_url} alt={desenho.nome} radius="md" fit="contain" />
            {cotas.map((c) => (
              <button
                key={c.id}
                onClick={() => openPad(c)}
                style={{
                  position: 'absolute',
                  left: `${c.x_percent * 100}%`,
                  top: `${c.y_percent * 100}%`,
                  transform: 'translate(-50%, -100%)',
                  background: 'linear-gradient(180deg, #111827, #374151)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 999,
                  width: rem(32),
                  height: rem(32),
                  fontSize: rem(14),
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  cursor: 'pointer'
                }}
                title={`Cota ${c.etiqueta}`}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>
        </Card>

        {/* lateral: amostras + histórico */}
        <Card withBorder radius="lg" p="md" style={{ flex: 1, minWidth: rem(360) }}>
          <Stack gap="sm">
            <Text fw={600}>Peças da amostra</Text>
            <Group gap="xs" wrap="wrap">
              {amostras.map((a) => {
                const filled = (medsByAmostra.get(a.id)?.length ?? 0) >= cotas.length;
                const active = currentAmostraId === a.id;
                return (
                  <Badge
                    key={a.id}
                    onClick={() => setCurrentAmostraId(a.id)}
                    variant={active ? 'filled' : 'light'}
                    color={filled ? 'teal' : 'indigo'}
                    style={{ cursor: 'pointer' }}
                    size="lg"
                  >
                    {a.indice}
                  </Badge>
                );
              })}
              {amostras.length === 0 && <Text c="dimmed">Sem amostras ainda</Text>}
            </Group>

            <Text fw={600} mt="sm">
              Histórico — Peça {currentAmostra?.indice ?? '-'}
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 90 }}>Cota</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th style={{ width: 60 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {historico.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td><Text fw={700}>{m.cota}</Text></Table.Td>
                    <Table.Td>
                      {(() => {
                        const c = cotas.find(x => x.id === m.cota_id)!;
                        const ok = checkDentro(c, Number(m.valor));
                        const txt = fmtDecimalBR(Number(m.valor));
                        if (ok === null) return txt;
                        return <Text c={ok ? 'teal' : 'red'} fw={ok ? 600 : 700}>{txt} {ok ? '(OK)' : '(Fora)'}</Text>;
                      })()}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            const c = cotas.find(c => c.id === m.cota_id)!;
                            const extra = specStr(c);
                            setPadInitial(fmtDecimalBR(Number(m.valor)));
                            setPadTarget({ cotaId: c.id, label: `Cota ${c.etiqueta} — Peça ${currentAmostra?.indice}${extra ? ` (${extra})` : ''}` });
                            setPadOpen(true);
                          }}
                        >
                          ✎
                        </ActionIcon>
                        <ActionIcon color="red" variant="subtle" onClick={() => excluirValor(m)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {historico.length === 0 && (
                  <Table.Tr><Table.Td colSpan={3}><Text c="dimmed">Sem valores ainda</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            <Button
              mt="md"
              onClick={concluirOP}
              leftSection={<IconCheck size={16} />}
              disabled={!prontoParaConcluir || op.status !== 'aberta'}
            >
              Concluir OP
            </Button>
          </Stack>
        </Card>
      </Group>

      {/* modal gerar amostras */}
      <Modal opened={genOpen} onClose={() => setGenOpen(false)} title="Gerar amostras" centered>
        <Stack>
          <Text c="dimmed" size="sm">Informe quantidade total e frequência (ex.: qty=12, freq=4 ⇒ peças 4,8,12)</Text>
          <NumberInput label="Quantidade (qty)" value={qty} onChange={(v) => setQty(toIntOrEmpty(v))} min={1} allowDecimal={false} />
          <NumberInput label="Frequência (freq)" value={freq} onChange={(v) => setFreq(toIntOrEmpty(v))} min={1} allowDecimal={false} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGenOpen(false)}>Cancelar</Button>
            <Button onClick={confirmGerarAmostras}>Gerar</Button>
          </Group>
        </Stack>
      </Modal>

      {/* teclado numérico */}
      <Numpad
        opened={padOpen}
        initial={padInitial}
        onClose={() => setPadOpen(false)}
        onConfirm={confirmPad}
        label={padTarget?.label || 'Valor'}
      />
    </>
  );
}
