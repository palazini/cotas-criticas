import { useEffect, useState } from 'react';
import { Badge, Card, Group, Loader, Table, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { supabase } from '../../lib/supabase';

type Row = {
  id: string;
  codigo: string;
  status: 'aberta' | 'concluida';
  created_at: string | null;
  desenho_codigo: string;
  desenho_nome: string;
  // opcional, caso queira exibir depois:
  // progresso_pct: number | null;
};

export default function OperadorList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ops_view')
        .select('id,codigo,status,created_at,desenho_codigo,desenho_nome') // ,progresso_pct
        .eq('status', 'aberta')
        .order('created_at', { ascending: false });
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHeader title="OPs Abertas" subtitle="Toque para iniciar a cotação" />
      <Card withBorder radius="lg">
        {loading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 160 }}>Código</Table.Th>
                <Table.Th>Desenho</Table.Th>
                <Table.Th style={{ width: 140 }}>Status</Table.Th>
                <Table.Th style={{ width: 200 }}>Criada em</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((op) => (
                <Table.Tr
                  key={op.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => nav(`/operador/op/${op.id}`)}
                >
                  <Table.Td><Badge variant="light">{op.codigo}</Badge></Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {op.desenho_codigo} — {op.desenho_nome}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={op.status === 'aberta' ? 'indigo' : 'teal'} variant="light">
                      {op.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text c="dimmed">{op.created_at?.slice(0, 19).replace('T', ' ')}</Text></Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}><Text c="dimmed">Nenhuma OP aberta.</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
