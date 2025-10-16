import { useEffect, useState } from 'react';
import { Badge, Button, Card, Group, Loader, SegmentedControl, Table, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';

type OPRow = {
  id: string;
  codigo: string;
  status: 'aberta' | 'concluida';
  created_at: string | null;
  qty: number | null;
  freq: number | null;
  desenho_codigo: string;
  desenho_nome: string;
};

export default function OPsList() {
  const nav = useNavigate();
  const loc = useLocation();

  const [filtro, setFiltro] = useState<'todas' | 'abertas' | 'concluidas'>('todas');
  const [rows, setRows] = useState<OPRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (!error && data) setRows(data as OPRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((op) =>
    filtro === 'todas' ? true : filtro === 'abertas' ? op.status === 'aberta' : op.status === 'concluida'
  );

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
          <Text c="dimmed" size="sm">Total: {rows.length}</Text>
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
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((op) => {
                const isClickable = op.status === 'concluida';
                return (
                  <Table.Tr
                    key={op.id}
                    onClick={() => isClickable && nav(`/gestor/ops/${op.id}`)}
                    style={{ cursor: isClickable ? 'pointer' : 'default', opacity: isClickable ? 1 : 0.8 }}
                    title={isClickable ? 'Ver detalhes' : 'Disponível após conclusão'}
                  >
                    <Table.Td>
                      <Badge variant="light">{op.codigo}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {op.desenho_codigo} — {op.desenho_nome}
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
                  </Table.Tr>
                );
              })}
              {filtered.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed">Nenhuma OP.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
