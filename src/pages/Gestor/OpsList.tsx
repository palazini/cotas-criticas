import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Progress, Table, Text, TextInput, NumberInput, Modal, Stack, Select } from '@mantine/core';
import { IconPlus, IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { listOpsWithProgress, createOp } from '../../services/ops';
import { listDesenhos } from '../../services/desenhos';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function OpsList() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [id, setId] = useState('');
  const [desenhoId, setDesenhoId] = useState('');
  const [qtd, setQtd] = useState<number | ''>('');
  const [freq, setFreq] = useState<number | ''>('');
  const [desenhos, setDesenhos] = useState<{ value: string; label: string }[]>([]);

  const nav = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await listOpsWithProgress();
      setRows(data);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao carregar OPs', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    (async () => {
      const ds = await listDesenhos();
      setDesenhos(ds.map(d => ({ value: d.id, label: d.nome })));
    })();
  }, []);

  // realtime ops + medições
  useEffect(() => {
    const ch = supabase
      .channel('ops:listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'op_medicoes' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function onCreate() {
    if (!id || !desenhoId) {
      notifications.show({ color: 'yellow', title: 'Campos obrigatórios', message: 'Informe ID e Desenho' });
      return;
    }
    try {
      await createOp({ id, desenho_id: desenhoId, qtd_total: typeof qtd === 'number' ? qtd : undefined, freq_n: typeof freq === 'number' ? freq : undefined });
      notifications.show({ color: 'green', title: 'OP criada', message: id });
      setOpen(false);
      setId(''); setDesenhoId(''); setQtd(''); setFreq('');
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao criar OP', message: e.message });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="xl" fw={700}>OP’s</Text>
        <Group>
          <Button leftSection={<IconRefresh size={18}/>} variant="light" onClick={load} loading={loading}>Atualizar</Button>
          <Button leftSection={<IconPlus size={18}/>} onClick={() => setOpen(true)}>Nova OP</Button>
        </Group>
      </Group>

      <Card withBorder radius="lg" shadow="sm" p="sm">
        <Table highlightOnHover stickyHeader striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{width:180}}>OP</Table.Th>
              <Table.Th>Desenho</Table.Th>
              <Table.Th style={{width:160}}>Qtd/Freq</Table.Th>
              <Table.Th style={{width:240}}>Progresso</Table.Th>
              <Table.Th style={{width:140}}>Status</Table.Th>
              <Table.Th style={{width:80}} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td><Text fw={600}>{r.id}</Text><Text c="dimmed" size="xs">{new Date(r.created_at).toLocaleString()}</Text></Table.Td>
                <Table.Td>{Array.isArray(r.desenho) ? r.desenho[0]?.nome : r.desenho?.nome ?? '-'}</Table.Td>
                <Table.Td>{r.qtd_total ?? '—'}/{r.freq_n ?? '—'}</Table.Td>
                <Table.Td>
                  <Progress value={r.progress?.pct ?? 0} size="lg" transitionDuration={300} />
                  <Text size="xs" c="dimmed">{r.progress?.total_done ?? 0} / {r.progress?.total_required ?? 0} ({r.progress?.pct ?? 0}%)</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={r.status === 'concluida' ? 'green' : 'yellow'} variant="light">
                    {r.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="subtle" onClick={() => nav(`/gestor/ops/${r.id}`)} title="Abrir">
                    <IconExternalLink size={18}/>
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {!rows.length && !loading && (
              <Table.Tr><Table.Td colSpan={6}><Text c="dimmed">Nenhuma OP ainda.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={open} onClose={() => setOpen(false)} title="Nova OP" radius="lg">
        <Stack>
          <TextInput label="ID da OP" placeholder="OP-2025-0001" value={id} onChange={(e)=>setId(e.currentTarget.value)} />
          <Select label="Desenho" placeholder="Selecione…" data={desenhos} value={desenhoId} onChange={(v)=>setDesenhoId(v ?? '')} searchable />
          <div style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
            <NumberInput label="Quantidade total (opcional)" value={qtd} onChange={(v)=>setQtd(typeof v==='number'? v: '')} min={1} />
            <NumberInput label="Frequência (opcional)" value={freq} onChange={(v)=>setFreq(typeof v==='number'? v: '')} min={1} />
          </div>
          <Group justify="end"><Button onClick={onCreate}>Criar</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
