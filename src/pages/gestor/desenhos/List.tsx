import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Table,
  Text,
  Stack,
  SegmentedControl,
} from '@mantine/core';
import { IconPlus, IconTrash, IconArchive, IconArchiveOff } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';
import { notifications } from '@mantine/notifications';

type Row = {
  id: string;
  codigo: string;
  nome: string;
  updated_at: string | null;
  imagem_url?: string | null;
  archived: boolean;
};

export default function DesenhosList() {
  const nav = useNavigate();

  const [tab, setTab] = useState<'ativos' | 'arquivados'>('ativos');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de confirmação de delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const [refCount, setRefCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Carregar lista conforme a aba
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('desenhos')
        .select('id,codigo,nome,updated_at,imagem_url,archived')
        .eq('archived', tab === 'arquivados')
        .order('updated_at', { ascending: false });
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, [tab]);

  // extrai o caminho dentro do bucket 'desenhos' a partir da URL pública
  function extractStoragePath(publicUrl?: string | null): string | null {
    if (!publicUrl) return null;
    const marker = '/desenhos/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length);
  }

  // Arquivar / Reativar
  async function toggleArchive(d: Row, e: React.MouseEvent) {
    e.stopPropagation();
    const targetArchived = !d.archived;
    const { error } = await supabase
      .from('desenhos')
      .update({ archived: targetArchived })
      .eq('id', d.id);
    if (error) {
      notifications.show({ color: 'red', title: 'Erro', message: error.message });
      return;
    }
    // como a aba filtra por archived, tiramos da lista atual
    setRows(prev => prev.filter(x => x.id !== d.id));
    notifications.show({
      color: targetArchived ? 'indigo' : 'teal',
      title: targetArchived ? 'Desenho arquivado' : 'Desenho reativado',
      message: d.codigo,
    });
  }

  async function openConfirm(d: Row, e: React.MouseEvent) {
    e.stopPropagation();
    setTarget(d);
    setRefCount(null);
    setConfirmOpen(true);

    // Conta quantas OPs referenciam o desenho
    const countRes = await supabase
      .from('ops')
      .select('id', { head: true, count: 'exact' })
      .eq('desenho_id', d.id);
    setRefCount(countRes.count ?? 0);
  }

  async function onConfirmDelete() {
    if (!target) return;
    setDeleting(true);

    try {
      // 1) Se houver OPs vinculadas, tenta desvincular (set desenho_id = null)
      if ((refCount ?? 0) > 0) {
        const up = await supabase
          .from('ops')
          .update({ desenho_id: null })
          .eq('desenho_id', target.id);
        if (up.error) {
          notifications.show({
            color: 'red',
            title: 'Não foi possível desvincular OPs',
            message:
              'Verifique se ops.desenho_id permite NULL e/ou ajuste a FK para ON DELETE SET NULL.',
          });
          setDeleting(false);
          return;
        }
      }

      // 2) Remove arquivo no Storage (se houver)
      const path = extractStoragePath(target.imagem_url);
      if (path) {
        const rm = await supabase.storage.from('desenhos').remove([path]);
        if (rm.error) {
          notifications.show({
            color: 'orange',
            title: 'Aviso ao remover arquivo',
            message: `Não foi possível remover o arquivo do Storage (${rm.error.message}).`,
          });
        }
      }

      // 3) Deleta o desenho (cotas caem com ON DELETE CASCADE)
      const del = await supabase.from('desenhos').delete().eq('id', target.id);
      if (del.error) {
        notifications.show({
          color: 'red',
          title: 'Erro ao apagar desenho',
          message: del.error.message,
        });
        setDeleting(false);
        return;
      }

      // 4) Atualiza UI e fecha
      setRows((prev) => prev.filter((x) => x.id !== target.id));
      notifications.show({
        color: 'teal',
        title: 'Desenho apagado',
        message: `${target.codigo} removido com sucesso.`,
      });
      setConfirmOpen(false);
      setTarget(null);
    } catch (err: any) {
      notifications.show({
        color: 'red',
        title: 'Falha na exclusão',
        message: err?.message || String(err),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Desenhos"
        subtitle="Catálogo de desenhos com suas cotas críticas"
        rightSection={
          <Group>
            <SegmentedControl
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              data={[
                { label: 'Ativos', value: 'ativos' },
                { label: 'Arquivados', value: 'arquivados' },
              ]}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={() => nav('/gestor/desenhos/novo')}>
              Cadastrar desenho
            </Button>
          </Group>
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
                <Table.Th style={{ width: 140, textAlign: 'right' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((d) => (
                <Table.Tr
                  key={d.id}
                  onClick={() => nav(`/gestor/desenhos/${encodeURIComponent(d.id)}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>
                    <Badge variant="light">
                      {d.codigo}
                    </Badge>
                    {d.archived && (
                      <Badge ml="xs" color="gray" variant="light">Arquivado</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{d.nome}</Table.Td>
                  <Table.Td><Text c="dimmed">{d.updated_at?.slice(0, 19).replace('T', ' ')}</Text></Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap="xs" onClick={(e) => e.stopPropagation()}>
                      {d.archived ? (
                        <ActionIcon
                          variant="subtle"
                          title="Reativar desenho"
                          onClick={(e) => toggleArchive(d, e)}
                        >
                          <IconArchiveOff size={16} />
                        </ActionIcon>
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          title="Arquivar desenho"
                          onClick={(e) => toggleArchive(d, e)}
                        >
                          <IconArchive size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        title="Apagar desenho"
                        onClick={(e) => openConfirm(d, e)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}><Text c="dimmed">Nenhum desenho {tab === 'arquivados' ? 'arquivado' : 'ativo'}.</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal de confirmação de exclusão */}
      <Modal
        opened={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Confirmar exclusão"
        centered
      >
        {target ? (
          <Stack gap="sm">
            <Text>
              Você está prestes a apagar o desenho <strong>{target.codigo}</strong>.
            </Text>

            {refCount === null ? (
              <Group gap="xs" align="center">
                <Loader size="sm" />
                <Text c="dimmed" size="sm">Verificando OPs relacionadas...</Text>
              </Group>
            ) : refCount > 0 ? (
              <Text c="red" size="sm">
                Encontramos <strong>{refCount}</strong> OP(s) vinculada(s) a este desenho.
                Ao confirmar, tentaremos <strong>desvincular as OPs</strong> (deixar sem desenho) e, em seguida,
                <strong> apagar</strong> o desenho e o arquivo no Storage.
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                Não há OPs vinculadas. O desenho e o arquivo no Storage serão removidos.
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancelar</Button>
              <Button color="red" onClick={onConfirmDelete} loading={deleting} disabled={refCount === null}>Apagar</Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
