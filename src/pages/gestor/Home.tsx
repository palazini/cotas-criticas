import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  ThemeIcon,
} from '@mantine/core';
import { IconPlus, IconRulerMeasure, IconClipboardList, IconFolder } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type OPView = {
  id: string;
  codigo: string;
  status: 'aberta' | 'concluida';
  desenho_id: string;
  desenho_codigo: string;
  desenho_nome: string;
  created_at: string | null;
  qty: number | null;
  freq: number | null;
  progresso_pct: number | null;
};

type QualityRow = { op_id: string; lidos: number; fora: number; pct_fora: number };

export default function GestorHome() {
  const nav = useNavigate();

  // métricas topo
  const [loading, setLoading] = useState(true);
  const [desenhosCount, setDesenhosCount] = useState(0);
  const [opsAbertasCount, setOpsAbertasCount] = useState(0);
  const [opsConcluidas30Count, setOpsConcluidas30Count] = useState(0);

  // listas (já vindas da view)
  const [opsAbertas, setOpsAbertas] = useState<OPView[]>([]);
  const [opsConcluidas, setOpsConcluidas] = useState<OPView[]>([]);

  // qualidade (% fora) por OP concluída (view)
  const [qualidade, setQualidade] = useState<Record<string, QualityRow>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);

      // ----- MÉTRICAS GERAIS (podem continuar nas tabelas base) -----
      const hoje = new Date();
      const d30 = new Date(hoje);
      d30.setDate(hoje.getDate() - 30);

      const [qDes, qAbertas, qConc30] = await Promise.all([
        supabase.from('desenhos').select('id', { head: true, count: 'exact' }),
        supabase.from('ops').select('id', { head: true, count: 'exact' }).eq('status', 'aberta'),
        supabase
          .from('ops')
          .select('id', { head: true, count: 'exact' })
          .eq('status', 'concluida')
          .gte('created_at', d30.toISOString()),
      ]);

      setDesenhosCount(qDes.count || 0);
      setOpsAbertasCount(qAbertas.count || 0);
      setOpsConcluidas30Count(qConc30.count || 0);

      // ----- LISTAS (agora direto da VIEW) -----
      const [abertas, concluidas] = await Promise.all([
        supabase
          .from('ops_view')
          .select('id,codigo,status,desenho_id,desenho_codigo,desenho_nome,created_at,qty,freq,progresso_pct')
          .eq('status', 'aberta')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('ops_view')
          .select('id,codigo,status,desenho_id,desenho_codigo,desenho_nome,created_at,qty,freq,progresso_pct')
          .eq('status', 'concluida')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const abertasRows = (abertas.data || []) as OPView[];
      const conclRows = (concluidas.data || []) as OPView[];

      setOpsAbertas(abertasRows);
      setOpsConcluidas(conclRows);

      // ----- QUALIDADE (view ops_quality_view) para as concluídas listadas -----
      const ids = conclRows.map((o) => o.id);
      if (ids.length) {
        const qres = await supabase
          .from('ops_quality_view')
          .select('op_id,lidos,fora,pct_fora')
          .in('op_id', ids);
        if (!qres.error && qres.data) {
          const map: Record<string, QualityRow> = {};
          for (const r of qres.data as QualityRow[]) map[r.op_id] = r;
          setQualidade(map);
        }
      } else {
        setQualidade({});
      }

      setLoading(false);
    })();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Desenhos',
        value: desenhosCount,
        icon: <IconFolder size={20} />,
        onClick: () => nav('/gestor/desenhos'),
      },
      {
        label: 'OPs abertas',
        value: opsAbertasCount,
        icon: <IconClipboardList size={20} />,
        onClick: () => nav('/gestor/ops?t=abertas'),
      },
      {
        label: 'Concluídas (30d)',
        value: opsConcluidas30Count,
        icon: <IconRulerMeasure size={20} />,
        onClick: () => nav('/gestor/ops?t=concluidas'),
      },
    ],
    [desenhosCount, opsAbertasCount, opsConcluidas30Count, nav],
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>Painel do Gestor</Title>
        <Group>
          <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => nav('/gestor/desenhos/novo')} disabled>
            Novo desenho
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => nav('/gestor/ops/nova')}>
            Nova OP
          </Button>
        </Group>
      </Group>

      {/* Métricas topo */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {cards.map((c) => (
          <Card key={c.label} withBorder radius="lg" p="md" style={{ cursor: 'pointer' }} onClick={c.onClick}>
            <Group align="center" gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light">
                {c.icon}
              </ThemeIcon>
              <Stack gap={2}>
                <Text c="dimmed" size="sm">
                  {c.label}
                </Text>
                <Text fw={700} fz={28}>
                  {loading ? '—' : c.value}
                </Text>
              </Stack>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Duas colunas: Abertas recentes | Concluídas recentes com qualidade */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>OPs abertas recentes</Text>
            <Button variant="subtle" size="compact-sm" onClick={() => nav('/gestor/ops?t=abertas')}>
              Ver todas
            </Button>
          </Group>

          {loading ? (
            <Group justify="center" py="lg">
              <Loader />
            </Group>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 140 }}>Código</Table.Th>
                  <Table.Th>Desenho</Table.Th>
                  <Table.Th style={{ width: 120 }}>Progresso</Table.Th>
                  <Table.Th style={{ width: 180 }}>Criada em</Table.Th>
                  <Table.Th style={{ width: 90 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {opsAbertas.map((op) => (
                  <Table.Tr key={op.id}>
                    <Table.Td>
                      <Badge variant="light">{op.codigo}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {op.desenho_codigo} — {op.desenho_nome}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={(op.progresso_pct ?? 0) === 100 ? 'teal' : 'indigo'}>
                        {op.progresso_pct ?? 0}%
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed">{op.created_at?.slice(0, 19).replace('T', ' ')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" onClick={() => nav(`/gestor/ops/${op.id}`)}>
                        Abrir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {opsAbertas.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed">Nenhuma OP aberta.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Últimas OPs concluídas</Text>
            <Button variant="subtle" size="compact-sm" onClick={() => nav('/gestor/ops?t=concluidas')}>
              Ver todas
            </Button>
          </Group>

          {loading ? (
            <Group justify="center" py="lg">
              <Loader />
            </Group>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 140 }}>Código</Table.Th>
                  <Table.Th>Desenho</Table.Th>
                  <Table.Th style={{ width: 120 }}>% fora</Table.Th>
                  <Table.Th style={{ width: 180 }}>Concluída em</Table.Th>
                  <Table.Th style={{ width: 90 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {opsConcluidas.map((op) => {
                  const q = qualidade[op.id];
                  return (
                    <Table.Tr key={op.id}>
                      <Table.Td>
                        <Badge variant="light" color="teal">
                          {op.codigo}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text c="dimmed" size="sm">
                          {op.desenho_codigo} — {op.desenho_nome}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {q ? (
                          <Badge color={q.pct_fora > 0 ? 'red' : 'teal'} variant="light">
                            {q.pct_fora}% {q.lidos ? `(${q.fora}/${q.lidos})` : ''}
                          </Badge>
                        ) : (
                          <Text c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text c="dimmed">{op.created_at?.slice(0, 19).replace('T', ' ')}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button size="xs" variant="light" onClick={() => nav(`/gestor/ops/${op.id}`)}>
                          Ver
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {opsConcluidas.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed">Sem OPs concluídas recentemente.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
