import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Group, Stack, Text, TextInput, NumberInput, Button, Table, ActionIcon, Modal, Textarea, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getDesenho, type Desenho } from '../../services/desenhos';
import { signedUrlDesenho } from '../../services/storage';
import { listCotas, createCota, updateCota, deleteCota, type Cota } from '../../services/cotas';
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';
import ImagePinBoard, { type Pin } from '../../components/ImagePinBoard';
import { supabase } from '../../lib/supabase';

export default function DesenhoDetail() {
  const { id = '' } = useParams();
  const [desenho, setDesenho] = useState<Desenho | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [open, setOpen] = useState(false);

  const [fixOpen, setFixOpen] = useState(false);
  const [fixCotaId, setFixCotaId] = useState<string | null>(null);
  const [fixTarget, setFixTarget] = useState<{ id: string; tag: string } | null>(null);

  const [form, setForm] = useState<{ tag: string; descricao: string }>({ tag: '', descricao: '' });

  async function load() {
    try {
      const d = await getDesenho(id);
      setDesenho(d);
      if (d?.imagem_path) {
        try { setUrl(await signedUrlDesenho(d.imagem_path)); } catch {}
      } else { setUrl(null); }
      setCotas(await listCotas(id));
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  useEffect(() => { load(); }, [id]);

  // realtime: cotas deste desenho
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`cotas:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotas_criticas', filter: `desenho_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  async function salvarNova() {
    if (!form.tag.trim()) { notifications.show({ color: 'yellow', title: 'Informe a tag' }); return; }
    try {
        const nova = await createCota(id, { tag: form.tag.trim(), descricao: form.descricao.trim() || null });
        setCotas((prev) => [ ...prev, nova ]);                 // 👈 otimista
        notifications.show({ color: 'green', title: 'Cota criada', message: 'Use “Fixar ponto” para posicionar.' });
        setOpen(false);
        setForm({ tag: '', descricao: '' });
    } catch (e: any) {
        notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  async function editar(c: Cota) {
    const patch: Partial<Cota> = { ...c }; delete (patch as any).id;
    try {
        const atualizada = await updateCota(c.id, patch);
        setCotas((prev) => prev.map(x => x.id === c.id ? atualizada : x));           // 👈
        notifications.show({ color: 'green', title: 'Cota atualizada' });
    } catch (e: any) {
        notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  async function remover(idCota: string) {
    try {
        await deleteCota(idCota);
        setCotas((prev) => prev.filter(c => c.id !== idCota));                       // 👈
        notifications.show({ color: 'green', title: 'Cota apagada' });
    } catch (e: any) {
        notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  const pins: Pin[] = cotas
    .filter(c => c.pos_x != null && c.pos_y != null)
    .map(c => ({ id: c.id, x: c.pos_x as number, y: c.pos_y as number, label: c.tag }));

  return (
    <Stack>
      <Group align="start" grow>
        <Card withBorder radius="lg">
          <Stack>
            <Group justify="space-between">
              <Text fw={700}>{desenho?.nome ?? '-'}</Text>
              {fixCotaId ? <Badge color="blue">Clique na imagem do modal para fixar</Badge> : null}
            </Group>
            <ImagePinBoard src={url} height={420} pins={pins} />
          </Stack>
        </Card>

        <Card withBorder radius="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Cotas</Text>
            <Button leftSection={<IconPlus size={16}/>} onClick={() => setOpen(true)}>Nova Cota</Button>
          </Group>

          <Table striped highlightOnHover stickyHeader>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th style={{ minWidth: 140 }}>Tag</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th style={{ width: 200 }}>Posição</Table.Th>
                    <Table.Th style={{ width: 90 }} />
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cotas.map((c) => (
                <CotaRow
                  key={c.id}
                  cota={c}
                  onSave={editar}
                  onDelete={() => remover(c.id)}
                  onFix={() => { setFixCotaId(c.id); setFixTarget({ id: c.id, tag: c.tag }); setFixOpen(true); }}
                  onUnfix={async () => {
                    try {
                        const atualizada = await updateCota(c.id, { pos_x: null, pos_y: null });
                        setCotas((prev) => prev.map(cc => cc.id === c.id ? atualizada : cc));        // 👈
                    } catch (e:any) {
                        notifications.show({ color:'red', title:'Erro', message:e.message });
                    }
                  }}
                />
              ))}
              {!cotas.length && (<Table.Tr><Table.Td colSpan={5}><Text c="dimmed">Sem cotas ainda.</Text></Table.Td></Table.Tr>)}
            </Table.Tbody>
          </Table>
        </Card>
      </Group>

      {/* Modal de fixação (semi-full) */}
      <Modal
        opened={fixOpen}
        onClose={() => { setFixOpen(false); setFixCotaId(null); setFixTarget(null); }}
        title={fixTarget ? `Fixar cota: ${fixTarget.tag}` : 'Fixar cota'}
        size="calc(min(90vw, 1100px))"
        radius="lg"
      >
        <Stack>
          <Text c="dimmed">Clique no ponto exato do desenho para fixar a cota.</Text>
          <div style={{ width: '100%', height: '70vh' }}>
            <ImagePinBoard
              src={url}
              pins={[]}
              onPick={async (x, y) => {
                if (!fixCotaId) return;
                try {
                    const atualizada = await updateCota(fixCotaId, { pos_x: x, pos_y: y, pos_set_at: new Date().toISOString() as any });
                    setCotas((prev) => prev.map(c => c.id === atualizada.id ? atualizada : c));  // 👈 otimista
                    setFixOpen(false);
                    setFixCotaId(null);
                    setFixTarget(null);
                    notifications.show({ color:'green', title:'Cota fixada' });
                } catch (e:any) {
                    notifications.show({ color:'red', title:'Erro ao fixar', message:e.message });
                }
              }}
            />
          </div>
          <Group justify="end">
            <Button variant="light" onClick={() => { setFixOpen(false); setFixCotaId(null); setFixTarget(null); }}>
              Cancelar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de nova cota (simplificado) */}
      <Modal opened={open} onClose={() => setOpen(false)} title="Nova Cota" radius="lg">
        <Stack>
          <TextInput label="Tag" placeholder="A, Ø20 H7, etc." value={form.tag} onChange={(e)=>setForm({...form, tag:e.currentTarget.value})} />
          <Textarea label="Descrição (opcional)" value={form.descricao} onChange={(e)=>setForm({...form, descricao: e.currentTarget.value})} />
          <Group justify="end">
            <Button onClick={salvarNova}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function CotaRow({
  cota, onSave, onDelete, onFix, onUnfix,
}: {
  cota: Cota;
  onSave: (c: Cota) => void;
  onDelete: () => void;
  onFix: () => void;
  onUnfix: () => void;
}) {
  const [edit, setEdit] = useState<Cota>(cota);
  useEffect(() => { setEdit(cota); }, [cota.id, cota.tag, cota.descricao, cota.pos_x, cota.pos_y]);

  const fixed = edit.pos_x != null && edit.pos_y != null;

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          value={edit.tag}
          onChange={(e) => setEdit({ ...edit, tag: e.currentTarget.value })}
          placeholder="A"
        />
      </Table.Td>

      <Table.Td>
        <TextInput
          value={edit.descricao ?? ''}
          onChange={(e) => setEdit({ ...edit, descricao: e.currentTarget.value })}
          placeholder="Descrição (opcional)"
        />
      </Table.Td>

      <Table.Td>
        <Group gap="xs">
          {!fixed ? (
            <Button size="xs" variant="light" onClick={onFix}>Fixar ponto</Button>
          ) : (
            <Button size="xs" variant="light" color="yellow" onClick={onUnfix}>Remover ponto</Button>
          )}
        </Group>
      </Table.Td>

      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="light" onClick={() => onSave(edit)} title="Salvar"><IconEdit size={16} /></ActionIcon>
          <ActionIcon variant="light" color="red" onClick={onDelete} title="Apagar"><IconTrash size={16} /></ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
