import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Table,
  Text,
  Stack
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';
import { notifications } from '@mantine/notifications';

type OPRow = {
  id: string;
  codigo: string;
  status: 'aberta' | 'concluida';
  created_at: string | null;
  qty: number | null;
  freq: number | null;
  desenho_codigo: string | null;
  desenho_nome: string | null;
};

export default function OPsList() {
  const nav = useNavigate();
  const loc = useLocation();

  const [filtro, setFiltro] = useState<'todas' | 'abertas' | 'concluidas'>('todas');
  const [rows, setRows] = useState<OPRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de exclusão
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [target, setTarget] = useState<OPRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ler ?t=abertas|concluidas|todas
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const t = params.get('t');
    if (t === 'abertas' || t === 'concluidas' || t === 'todas') {
      setFiltro(t);
    }
  }, [loc.search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ops_view')
        .select('id,codigo,status,created_at,qty,freq,desenho_codigo,desenho_nome')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const safe = (data as any[]).map((d) => ({
          id: d.id,
          codigo: d.codigo,
          status: d.status,
          created_at: d.created_at,
          qty: d.qty,
          freq: d.freq,
          desenho_codigo: d.desenho_codigo ?? null,
          desenho_nome: d.desenho_nome ?? null,
        })) as OPRow[];
        setRows(safe);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((op) =>
    filtro === 'todas' ? true : filtro === 'abertas' ? op.status === 'aberta' : op.status === 'concluida'
  );

  function openConfirm(op: OPRow, e: React.MouseEvent) {
    e.stopPropagation();
    setTarget(op);
    setConfirmOpen(true);
  }

  async function onConfirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      const del = await supabase.from('ops').delete().eq('id', target.id);
      if (del.error) {
        notifications.show({ color: 'red', title: 'Erro ao excluir OP', message: del.error.message });
        setDeleting(false);
        return;
      }
      // atualiza UI
      setRows((prev) => prev.filter((r) => r.id !== target.id));
      notifications.show({
        color: 'teal',
        title: 'OP excluída',
        message: `${target.codigo} foi removida (amostras e medições relacionadas também foram apagadas).`,
      });
      setConfirmOpen(false);
      setTarget(null);
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Falha na exclusão', message: err?.message || String(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="OPs"
        subtitle="Acompanhe OPs abertas e concluídas"
        rightSection={
          <Button leftSection={<IconPlus size={16} />} onClick={() => nav('/gestor/ops/nova')}>
            Abrir nova OP
          </Button>
        }
      />

      <Card withBorder radius="lg">
        <Group justify="space-between" mb="sm">
          <Text c="dimmed" size="sm">
            Total: {rows.length}
          </Text>
          <SegmentedControl
            value={filtro}
            onChange={(v) => setFiltro(v as typeof filtro)}
            data={[
              { label: 'Todas', value: 'todas' },
              { label: 'Abertas', value: 'abertas' },
              { label: 'Concluídas', value: 'concluidas' },
            ]}
          />
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 140 }}>Código</Table.Th>
                <Table.Th>Desenho</Table.Th>
                <Table.Th style={{ width: 120 }}>Qty/Freq</Table.Th>
                <Table.Th style={{ width: 120 }}>Status</Table.Th>
                <Table.Th style={{ width: 200 }}>Criada em</Table.Th>
                <Table.Th style={{ width: 90, textAlign: 'right' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((op) => {
                const isClickable = op.status === 'concluida';
                const desenhoStr =
                  op.desenho_codigo && op.desenho_nome
                    ? `${op.desenho_codigo} — ${op.desenho_nome}`
                    : '— sem desenho —';

                return (
                  <Table.Tr
                    key={op.id}
                    onClick={() => isClickable && nav(`/gestor/ops/${op.id}`)}
                    style={{ cursor: isClickable ? 'pointer' : 'default', opacity: isClickable ? 1 : 0.9 }}
                    title={isClickable ? 'Ver detalhes' : 'Disponível após conclusão'}
                  >
                    <Table.Td>
                      <Badge variant="light">{op.codigo}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c={op.desenho_codigo ? 'dimmed' : 'red'} size="sm">
                        {desenhoStr}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {op.qty ?? '-'} / {op.freq ?? '-'}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={op.status === 'aberta' ? 'indigo' : 'teal'} variant="light">
                        {op.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed">{op.created_at?.slice(0, 19).replace('T', ' ')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          title="Excluir OP"
                          onClick={(e) => openConfirm(op, e)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {filtered.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed">Nenhuma OP.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal de confirmação */}
      <Modal
        opened={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Excluir OP"
        centered
      >
        {target ? (
          <Stack gap="sm">
            <Text>
              Tem certeza que deseja excluir a OP <strong>{target.codigo}</strong>?
            </Text>
            <Text c="red" size="sm">
              Esta ação removerá também <strong>todas as amostras</strong> e <strong>medições</strong> relacionadas
              (via exclusão em cascata).
            </Text>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button color="red" onClick={onConfirmDelete} loading={deleting}>
                Excluir
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
