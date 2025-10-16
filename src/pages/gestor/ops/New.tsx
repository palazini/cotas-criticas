import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';
import { notifications } from '@mantine/notifications';

type DesenhoOpt = { value: string; label: string };

function buildAmostrasIndices(qty?: number | null, freq?: number | null): number[] {
  if (!qty || !freq || qty <= 0 || freq <= 0) return [];
  const out: number[] = [];
  for (let i = freq; i <= qty; i += freq) out.push(i);
  return out;
}

// helper: NumberInput -> number|null
const toIntOrNull = (v: string | number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export default function OPsNew() {
  const nav = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [desenhoId, setDesenhoId] = useState<string | null>(null);
  const [qty, setQty] = useState<number | null>(null);
  const [freq, setFreq] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [opts, setOpts] = useState<DesenhoOpt[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('desenhos')
        .select('id,codigo,nome')
        .eq('archived', false)                // << só desenhos ATIVOS
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setOpts(data.map((d) => ({ value: d.id, label: `${d.codigo} — ${d.nome}` })));
      }
    })();
  }, []);

  const previewAmostras = useMemo(() => buildAmostrasIndices(qty, freq), [qty, freq]);

  async function onSalvar() {
    if (!codigo || !desenhoId) return;
    setSaving(true);
    try {
      const hasParams = (qty != null && qty > 0) || (freq != null && freq > 0);

      // cria a OP
      const { data: opData, error: opErr } = await supabase
        .from('ops')
        .insert({
          codigo,
          desenho_id: desenhoId,
          qty: qty ?? null,
          freq: freq ?? null,
          status: 'aberta',
          params_origem: hasParams ? 'gestor' : null,
        })
        .select('id')
        .single();
      if (opErr) throw opErr;

      // gera amostras (opcional)
      if (previewAmostras.length > 0) {
        const rows = previewAmostras.map((indice) => ({ op_id: opData.id, indice }));
        const { error: amErr } = await supabase.from('op_amostras').insert(rows);
        if (amErr) throw amErr;
      }

      notifications.show({ color: 'teal', icon: <IconCheck />, title: 'OP criada', message: codigo });
      nav('/gestor/ops');
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message || String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Abrir nova OP" subtitle="Vincule um desenho e, opcionalmente, defina qty/freq" />
      <Card withBorder radius="lg">
        <Stack>
          <TextInput
            label="Código da OP"
            placeholder="OP-24531"
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
          />
          <Select
            label="Desenho"
            placeholder={opts.length ? 'Selecione...' : 'Nenhum desenho ativo (veja Arquivados)'}
            data={opts}
            value={desenhoId}
            onChange={setDesenhoId}
            searchable
            disabled={opts.length === 0}
          />
          <Group grow>
            <NumberInput
              label="Quantidade (qty)"
              placeholder="ex.: 12"
              value={qty ?? ''}
              onChange={(v) => setQty(toIntOrNull(v))}
              min={1}
              allowDecimal={false}
            />
            <NumberInput
              label="Frequência (freq)"
              placeholder="ex.: 4"
              value={freq ?? ''}
              onChange={(v) => setFreq(toIntOrNull(v))}
              min={1}
              allowDecimal={false}
            />
          </Group>

          {previewAmostras.length > 0 && (
            <Text>Amostras geradas: <strong>{previewAmostras.join(', ')}</strong></Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => nav('/gestor/ops')}>
              Cancelar
            </Button>
            <Button onClick={onSalvar} loading={saving} disabled={!codigo || !desenhoId}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Card>
    </>
  );
}
