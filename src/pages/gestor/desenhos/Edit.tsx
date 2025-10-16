import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon, Button, Card, Group, Image, Loader, Modal, Stack, Table,
  Text, TextInput, NumberInput, rem
} from '@mantine/core';
import { IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import PageHeader from '../../../components/PageHeader';
import { notifications } from '@mantine/notifications';

type Desenho = { id: string; codigo: string; nome: string; imagem_url: string };
type Cota = {
  id: string; desenho_id: string; etiqueta: string;
  x_percent: number; y_percent: number;
  observacao: string | null;
  nominal: number | null; tol_menos: number | null; tol_mais: number | null; unidade: string | null;
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function nextEtiquetaFrom(cotas: Cota[]) {
  const used = new Set(cotas.map(c => c.etiqueta.toUpperCase()));
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  return `P${cotas.length + 1}`;
}
function fmt(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** Converte string/number (com vírgula ou ponto) para number|null */
function parseNum(v: string | number | null | undefined): number | null {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = v.replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export default function DesenhosEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [desenho, setDesenho] = useState<Desenho | null>(null);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // criação
  const [creating, setCreating] = useState(false);
  const [newEtiqueta, setNewEtiqueta] = useState('');
  const [newObs, setNewObs] = useState('');
  const [newNominal, setNewNominal] = useState<string | number | null>(null);
  const [newTolMais, setNewTolMais] = useState<string | number | null>(null);
  const [newTolMenos, setNewTolMenos] = useState<string | number | null>(null);
  const [newUnidade, setNewUnidade] = useState('mm');

  // edição (completo)
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editEtiqueta, setEditEtiqueta] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editNominal, setEditNominal] = useState<string | number | null>(null);
  const [editTolMais, setEditTolMais] = useState<string | number | null>(null);
  const [editTolMenos, setEditTolMenos] = useState<string | number | null>(null);
  const [editUnidade, setEditUnidade] = useState('mm');

  // drag
  const [dragId, setDragId] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  // carregar desenho + cotas
  useEffect(() => {
    (async () => {
      if (!id) return; // segurança
      setLoading(true);
      setNotFound(false);

      // 1) Desenho
      const d = await supabase
        .from('desenhos')
        .select('id,codigo,nome,imagem_url')
        .eq('id', id)
        .maybeSingle();

      if (d.error) {
        notifications.show({ color: 'red', title: 'Erro ao carregar desenho', message: d.error.message || '' });
        setDesenho(null);
        setCotas([]);
        setLoading(false);
        return;
      }
      if (!d.data) {
        setNotFound(true);
        setDesenho(null);
        setCotas([]);
        setLoading(false);
        return;
      }
      setDesenho(d.data as Desenho);

      // 2) Cotas do desenho
      const c = await supabase
        .from('cotas')
        .select('id,desenho_id,etiqueta,x_percent,y_percent,observacao,nominal,tol_menos,tol_mais,unidade')
        .eq('desenho_id', id)
        .order('etiqueta', { ascending: true });

      if (!c.error && c.data) {
        setCotas((c.data as Cota[]).slice().sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)));
      } else {
        setCotas([]);
        if (c.error) {
          notifications.show({ color: 'red', title: 'Erro ao carregar cotas', message: c.error.message });
        }
      }

      setLoading(false);
    })();
  }, [id]);

  const suggested = useMemo(() => nextEtiquetaFrom(cotas), [cotas]);

  // clique na imagem → abrir modal de criação com coordenadas predefinidas
  function handleImageClick(e: React.MouseEvent) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    setLocalPos((p) => ({ ...p, __new__: { x, y } }));
    setNewEtiqueta(suggested);
    setNewObs('');
    setNewNominal(null);
    setNewTolMais(null);
    setNewTolMenos(null);
    setNewUnidade('mm');
    setCreating(true);
  }

  async function confirmCreate() {
    const pos = (localPos as any)['__new__'];
    if (!desenho || !pos || !newEtiqueta) return;
    const payload = {
      desenho_id: desenho.id,
      etiqueta: newEtiqueta.toUpperCase(),
      x_percent: pos.x,
      y_percent: pos.y,
      observacao: newObs || null,
      nominal: parseNum(newNominal),
      tol_mais: parseNum(newTolMais),
      tol_menos: parseNum(newTolMenos),
      unidade: (newUnidade || 'mm').trim() || 'mm'
    };
    const { data, error } = await supabase.from('cotas').insert(payload).select('*').single();
    if (error) {
      notifications.show({ color: 'red', title: 'Erro ao criar cota', message: error.message });
    } else {
      setCotas((c) => [...c, data as Cota].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)));
      notifications.show({ color: 'teal', title: 'Cota criada', message: `Etiqueta ${data!.etiqueta}` });
    }
    setCreating(false);
    setLocalPos((p) => { const { __new__, ...rest } = p as any; return rest; });
  }

  async function deleteCota(id: string) {
    const { error } = await supabase.from('cotas').delete().eq('id', id);
    if (error) {
      notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message });
    } else {
      setCotas((c) => c.filter((x) => x.id !== id));
      notifications.show({ color: 'teal', title: 'Excluída', message: 'Cota removida' });
    }
  }

  // drag
  function startDrag(cotaId: string, e?: React.PointerEvent) {
    setDragId(cotaId);
    draggedRef.current = false;
    if (e) dragStartRef.current = { x: e.clientX, y: e.clientY };
  }
  function onMove(e: React.PointerEvent) {
    if (!dragId || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    setLocalPos((p) => ({ ...p, [dragId]: { x, y } }));

    const s = dragStartRef.current;
    if (s && !draggedRef.current) {
      const dx = Math.abs(e.clientX - s.x);
      const dy = Math.abs(e.clientY - s.y);
      if (dx + dy > 4) draggedRef.current = true;
    }
  }
  async function endDrag() {
    if (!dragId) return;
    const pos = localPos[dragId];
    if (pos) {
      const { error } = await supabase.from('cotas').update({ x_percent: pos.x, y_percent: pos.y }).eq('id', dragId);
      if (error) notifications.show({ color: 'red', title: 'Erro ao mover', message: error.message });
      else setCotas((c) => c.map(ct => ct.id === dragId ? { ...ct, x_percent: pos.x, y_percent: pos.y } : ct));
    }
    setDragId(null);
    setTimeout(() => {
      draggedRef.current = false;
      dragStartRef.current = null;
    }, 0);
  }

  async function updateCota(id: string, patch: Partial<Cota>) {
    const { error } = await supabase.from('cotas').update(patch).eq('id', id);
    if (error) {
      notifications.show({ color: 'red', title: 'Erro ao atualizar cota', message: error.message });
      throw error;
    }

    // Atualiza lista local e mantém ordenação por etiqueta
    setCotas(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, ...patch } : c));
      return next.slice().sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
    });

    // Destaque visual por 1.5s
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1500);

    notifications.show({ color: 'teal', title: 'Cota atualizada', message: 'Dados salvos.' });
  }

  // abrir modal de edição completo
  function openEdit(c: Cota) {
    setEditId(c.id);
    setEditEtiqueta(c.etiqueta.toUpperCase());
    setEditObs(c.observacao || '');
    setEditNominal(c.nominal);
    setEditTolMais(c.tol_mais);
    setEditTolMenos(c.tol_menos);
    setEditUnidade(c.unidade || 'mm');
    setEditOpen(true);
  }

  async function confirmEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      const patch: Partial<Cota> = {
        etiqueta: (editEtiqueta || '').toUpperCase(),
        observacao: editObs || null,
        nominal: parseNum(editNominal),
        tol_mais: parseNum(editTolMais),
        tol_menos: parseNum(editTolMenos),
        unidade: (editUnidade || 'mm').trim() || 'mm'
      };
      await updateCota(editId, patch);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card withBorder radius="lg">
        <Group justify="center" py="xl"><Loader /></Group>
      </Card>
    );
  }

  if (notFound) {
    return (
      <>
        <PageHeader
          title="Desenho não encontrado"
          subtitle="Verifique o link ou tente novamente"
          rightSection={<Button variant="default" onClick={() => nav('/gestor/desenhos')}>Voltar</Button>}
        />
        <Card withBorder radius="lg">
          <Group justify="center" py="xl">
            <Text c="dimmed">Nenhum registro com esse ID.</Text>
          </Group>
        </Card>
      </>
    );
  }

  if (!desenho) {
    return (
      <Card withBorder radius="lg">
        <Group justify="center" py="xl"><Text c="dimmed">Não foi possível carregar o desenho.</Text></Group>
      </Card>
    );
  }

  // posição a ser renderizada (local override se estiver arrastando)
  function posOf(c: Cota) {
    const over = localPos[c.id];
    return over ?? { x: c.x_percent, y: c.y_percent };
  }

  return (
    <>
      <PageHeader
        title={`${desenho.codigo} — ${desenho.nome}`}
        subtitle="Clique para criar cotas. Arraste para reposicionar."
        rightSection={<Button variant="default" onClick={() => nav('/gestor/desenhos')}>Voltar</Button>}
      />

      <Group align="flex-start" gap="md" wrap="nowrap">
        {/* Área da imagem com overlay */}
        <Card withBorder radius="lg" p="sm" style={{ flex: 2, minWidth: rem(420) }}>
          <div
            ref={wrapRef}
            onClick={handleImageClick}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            style={{ position: 'relative', width: '100%', touchAction: 'none' }}
          >
            <Image src={desenho.imagem_url} alt={desenho.nome} radius="md" fit="contain" />
            {/* pins */}
            {cotas.map((c) => {
              const p = posOf(c);
              return (
                <button
                  key={c.id}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag(c.id, e); }}
                  style={{
                    position: 'absolute',
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    background: 'linear-gradient(180deg, #6366f1, #22c55e)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 999,
                    width: rem(28),
                    height: rem(28),
                    fontSize: rem(13),
                    fontWeight: 700,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                    cursor: 'grab',
                    touchAction: 'none'
                  }}
                  title={`Cota ${c.etiqueta}`}
                >
                  {c.etiqueta}
                </button>
              );
            })}
            {/* "preview" do ponto novo */}
            {'__new__' in localPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(localPos as any)['__new__'].x * 100}%`,
                  top: `${(localPos as any)['__new__'].y * 100}%`,
                  transform: 'translate(-50%, -100%)',
                  width: rem(20),
                  height: rem(20),
                  borderRadius: 999,
                  background: 'rgba(99,102,241,0.6)',
                  outline: '3px solid rgba(99,102,241,0.25)'
                }}
              />
            )}
          </div>
        </Card>

        {/* Lateral com tabela das cotas (somente leitura + ações) */}
        <Card withBorder radius="lg" p="md" style={{ flex: 1, minWidth: rem(360) }}>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Cotas do desenho</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => {
                setLocalPos((p) => ({ ...p, __new__: { x: 0.5, y: 0.5 } }));
                setNewEtiqueta(suggested);
                setNewObs('');
                setNewNominal(null);
                setNewTolMais(null);
                setNewTolMenos(null);
                setNewUnidade('mm');
                setCreating(true);
              }}
            >
              Nova cota
            </Button>
          </Group>

          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 70 }}>Etiqueta</Table.Th>
                <Table.Th style={{ width: 120 }}>Nominal</Table.Th>
                <Table.Th style={{ width: 100 }}>+Tol</Table.Th>
                <Table.Th style={{ width: 100 }}>-Tol</Table.Th>
                <Table.Th style={{ width: 80 }}>Unid.</Table.Th>
                <Table.Th style={{ width: 90, textAlign: 'right' }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cotas.map((c) => (
                <Table.Tr
                  key={c.id}
                  style={highlightId === c.id ? { backgroundColor: 'rgba(16,185,129,0.10)' } : undefined}
                >
                  <Table.Td><Text fw={700}>{c.etiqueta}</Text></Table.Td>
                  <Table.Td>{fmt(c.nominal)}</Table.Td>
                  <Table.Td>{fmt(c.tol_mais)}</Table.Td>
                  <Table.Td>{fmt(c.tol_menos)}</Table.Td>
                  <Table.Td>{c.unidade || 'mm'}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap={6}>
                      <ActionIcon variant="subtle" onClick={() => openEdit(c)} title="Editar">
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={async () => {
                          const ok = window.confirm(`Excluir cota ${c.etiqueta}?`);
                          if (ok) await deleteCota(c.id);
                        }}
                        title="Excluir cota"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {cotas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}><Text c="dimmed">Nenhuma cota cadastrada.</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>
      </Group>

      {/* Modal de criação */}
      <Modal opened={creating} onClose={() => setCreating(false)} title="Nova cota" centered>
        <Stack>
          <TextInput label="Etiqueta" placeholder="A" value={newEtiqueta}
            onChange={(e) => setNewEtiqueta(e.currentTarget.value.toUpperCase())} maxLength={3} />
          <TextInput label="Observação (opcional)" placeholder="Descrição breve"
            value={newObs} onChange={(e) => setNewObs(e.currentTarget.value)} />
          <Group grow>
            <NumberInput label="Nominal" value={newNominal as any} onChange={setNewNominal}
              decimalSeparator="," thousandSeparator="." step={0.01} />
            <NumberInput label="+Tol" value={newTolMais as any} onChange={setNewTolMais}
              decimalSeparator="," thousandSeparator="." step={0.01} />
            <NumberInput label="-Tol" value={newTolMenos as any} onChange={setNewTolMenos}
              decimalSeparator="," thousandSeparator="." step={0.01} />
          </Group>
          <TextInput label="Unidade" value={newUnidade} onChange={(e) => setNewUnidade(e.currentTarget.value)} />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={confirmCreate}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de edição (completo) */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Editar cota" centered>
        <Stack>
          <TextInput label="Etiqueta" placeholder="A" value={editEtiqueta}
            onChange={(e) => setEditEtiqueta(e.currentTarget.value.toUpperCase())} maxLength={3} />
          <TextInput label="Observação (opcional)" placeholder="Descrição breve"
            value={editObs} onChange={(e) => setEditObs(e.currentTarget.value)} />
          <Group grow>
            <NumberInput label="Nominal" value={editNominal as any} onChange={setEditNominal}
              decimalSeparator="," thousandSeparator="." step={0.01} />
            <NumberInput label="+Tol" value={editTolMais as any} onChange={setEditTolMais}
              decimalSeparator="," thousandSeparator="." step={0.01} />
            <NumberInput label="-Tol" value={editTolMenos as any} onChange={setEditTolMenos}
              decimalSeparator="," thousandSeparator="." step={0.01} />
          </Group>
          <TextInput label="Unidade" value={editUnidade} onChange={(e) => setEditUnidade(e.currentTarget.value)} />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={confirmEdit} loading={saving}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
