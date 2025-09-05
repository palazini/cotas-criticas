import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Text, Group, Badge, Button } from '@mantine/core';
import { listOpsAbertas } from '../../services/ops';
import { notifications } from '@mantine/notifications';

export default function OperadorHome() {
  const [rows, setRows] = useState<any[]>([]);
  const nav = useNavigate();

  async function load() {
    try {
      setRows(await listOpsAbertas());
    } catch (e:any) {
      notifications.show({ color:'red', title:'Erro', message:e.message });
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <Card withBorder radius="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={700} size="lg">OPs em andamento</Text>
        <Button variant="light" onClick={load}>Atualizar</Button>
      </Group>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{width:160}}>OP</Table.Th>
            <Table.Th>Desenho</Table.Th>
            <Table.Th style={{width:140}}>Qtd/Freq</Table.Th>
            <Table.Th style={{width:140}}>Status</Table.Th>
            <Table.Th style={{width:80}} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(r => (
            <Table.Tr key={r.id}>
              <Table.Td><Text fw={600}>{r.id}</Text></Table.Td>
              <Table.Td>{r.desenhoNome}</Table.Td>
              <Table.Td>{r.qtd_total ?? '—'} / {r.freq_n ?? '—'}</Table.Td>
              <Table.Td>
                <Badge color={r.status === 'concluida' ? 'green' : 'yellow'} variant="light">
                  {r.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Button size="xs" onClick={() => nav(`/operador/medir/${r.id}`)}>Abrir</Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {!rows.length && (
            <Table.Tr><Table.Td colSpan={5}><Text c="dimmed">Nenhuma OP aberta.</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
