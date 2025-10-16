import { useEffect, useState } from 'react';
import { Badge, Button, Card, Group, Loader, Table, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';

type Row = { id: string; codigo: string; nome: string; updated_at: string | null };

export default function DesenhosList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('desenhos')
        .select('id,codigo,nome,updated_at')
        .order('updated_at', { ascending: false });
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Desenhos"
        subtitle="Catálogo de desenhos com suas cotas críticas"
        rightSection={
          <Button leftSection={<IconPlus size={16} />} onClick={() => nav('/gestor/desenhos/novo')}>
            Cadastrar desenho
          </Button>
        }
      />

      <Card withBorder radius="lg">
        {loading ? (
          <Group justify="center" py="xl"><Loader /></Group>
        ) : (
          <Table striped highlightOnHover withColumnBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 140 }}>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th style={{ width: 180 }}>Atualizado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((d) => (
                <Table.Tr
                  key={d.id}
                  onClick={() => nav(`/gestor/desenhos/${d.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td><Badge variant="light">{d.codigo}</Badge></Table.Td>
                  <Table.Td>{d.nome}</Table.Td>
                  <Table.Td><Text c="dimmed">{d.updated_at?.slice(0, 19).replace('T', ' ')}</Text></Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}><Text c="dimmed">Nenhum desenho cadastrado.</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
