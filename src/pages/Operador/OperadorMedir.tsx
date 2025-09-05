import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Table, Text, Title, TextInput, Chip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getOpOperador, inserirMedicao, listarMedicoesDaOp, setOpFields, concluirOp } from '../../services/ops';
import ImagePinBoard from '../../components/ImagePinBoard';
import NumericKeypad from '../../components/NumericKeypad';

export default function OperadorMedir() {
  const { id = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [op, setOp] = useState<any|null>(null);
  const [url, setUrl] = useState<string|null>(null);
  const [cotas, setCotas] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);

  // seleção
  const [peca, setPeca] = useState<number | null>(null);
  const [cotaSel, setCotaSel] = useState<{ id: string; tag: string } | null>(null);
  const [valorStr, setValorStr] = useState<string>('');

  const [qtd, setQtd] = useState<number | ''>('');
  const [freq, setFreq] = useState<number | ''>('');

  const totalCotas = cotas.length;

  // hook de navegação
  const nav = useNavigate();

  // mapa de conclusão por peça (contando cotas distintas medidas)
  const doneMap = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const med of meds) {
      const set = m.get(med.peca_idx) ?? new Set<string>();
      // conta por cota_id (distintas)
      if (med.cota_id) set.add(med.cota_id);
      m.set(med.peca_idx, set);
    }
    return m; // Map<peca_idx, Set<cota_id>>
  }, [meds]);

  const isPieceDone = (idx: number) => (doneMap.get(idx)?.size ?? 0) >= totalCotas && totalCotas > 0;
  const allDone = useMemo(() => (op?.amostras ?? []).every((n: number) => isPieceDone(n)), [op?.amostras, doneMap, totalCotas]);

  // 3.1) cotas já medidas na peça atual (evita duplicar pela mesma cota)
  const measuredCotasCurrentPiece = useMemo(() => {
    const s = new Set<string>();
    for (const m of meds) {
      if (m.peca_idx === peca && m.cota_id) s.add(m.cota_id);
    }
    return s; // Set<string>
  }, [meds, peca]);

  async function load() {
    try {
      setLoading(true);
      const { op, desenho, url, cotas } = await getOpOperador(id);
      setOp(op);
      setQtd(op.qtd_total ?? '');
      setFreq(op.freq_n ?? '');
      setUrl(url);
      setCotas(cotas.filter((c:any)=> c.pos_x != null && c.pos_y != null)); // só cotas com ponto
      setMeds(await listarMedicoesDaOp(id));
      const am = op.amostras as number[] | null;
      setPeca(am?.[0] ?? null);
    } catch (e:any) {
      notifications.show({ color:'red', title:'Erro', message:e.message });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  const amostras = (op?.amostras ?? []) as number[];
  const optionsPecas = amostras.map(n => ({ value: String(n), label: `Peça #${n}` }));

  async function salvar() {
    const raw = (valorStr ?? '').replace(',', '.').trim();
    const parsed = Number(raw);
    if (!cotaSel?.id || !peca || !isFinite(parsed)) {
        notifications.show({ color:'yellow', title:'Valor inválido', message:'Digite um número válido.' });
        return;
    }
    try {
      const novo = await inserirMedicao({ op_id: id, cota_id: cotaSel.id, peca_idx: peca, valor: parsed });
      setMeds(prev => [novo, ...prev]);
      setValorStr('');
      setCotaSel(null);

      // checa se a peça atual concluiu
      const currentSet = new Set<string>([...(doneMap.get(peca)?.values() ?? [])]);
      if (novo.cota_id) currentSet.add(novo.cota_id);
      const pieceJustCompleted = currentSet.size >= totalCotas && totalCotas > 0;

      if (pieceJustCompleted) {
          notifications.show({ color: 'green', title: `Peça #${peca} concluída` });
          // avança para a próxima peça pendente
          const next = amostras.find((n: number) => n !== peca && !isPieceDone(n));
          if (next != null) setPeca(next);
      } else {
          notifications.show({ color: 'green', title: 'Salvo' });
      }
      } catch (e:any) {
      notifications.show({ color:'red', title:'Erro ao salvar', message:e.message });
    }
  }

  return (
    <Stack>
      <Group justify="space-between" align="center">
            <div>
                <Title order={3}>OP {id}</Title>
                <Text c="dimmed">{op?.desenho?.[0]?.nome ?? op?.desenho?.nome ?? '-'}</Text>
            </div>

            <Group gap="sm">
                <Badge color="blue" variant="light">
                Peças: {amostras?.join(', ') || '—'}
                </Badge>

                {allDone && (
                <Button
                    color="green"
                    onClick={async () => {
                      try {
                        await concluirOp(id);
                        notifications.show({ color: 'green', title: 'OP entregue' });
                        nav('/operador'); // 👈 volta para a tela inicial do operador
                      } catch (e: any) {
                        notifications.show({ color: 'red', title: 'Erro ao entregar', message: e.message });
                      }
                    }}
                >
                    Entregar
                </Button>
                )}
            </Group>
        </Group>

      {(!op?.amostras || (op.amostras as number[])?.length === 0) && (
        <Card withBorder radius="lg">
            <Stack gap="sm">
            <Text fw={600}>Definir amostragem</Text>
            <Group grow>
                <NumberInput
                label="Quantidade total"
                value={qtd}
                onChange={(v)=> setQtd(typeof v === 'number' ? v : '')}
                min={1}
                />
                <NumberInput
                label="Frequência"
                value={freq}
                onChange={(v)=> setFreq(typeof v === 'number' ? v : '')}
                min={1}
                />
            </Group>
            <Group>
                <Button
                onClick={async () => {
                    try {
                    if (typeof qtd !== 'number' || typeof freq !== 'number') return;
                    const updated = await setOpFields(id, { qtd_total: qtd, freq_n: freq });
                    // otimista: atualiza op + amostras na tela
                    setOp((prev:any) => ({ ...prev, qtd_total: qtd, freq_n: freq, amostras: updated.amostras }));
                    // define peça inicial
                    const am = updated.amostras as number[] | null;
                    setPeca(am?.[0] ?? null);
                    notifications.show({ color:'green', title:'Amostragem definida' });
                    } catch (e:any) {
                    notifications.show({ color:'red', title:'Erro', message:e.message });
                    }
                }}
                disabled={typeof qtd !== 'number' || typeof freq !== 'number'}
                >
                Gerar amostras
                </Button>
                <Text c="dimmed">Ex.: se qtd = 12 e freq = 3 → peças #3,6,9,12.</Text>
            </Group>
            </Stack>
        </Card>
      )}

      {/* Peças (seleção + status) */}
    <Card withBorder radius="lg">
        <Stack gap="xs">
            <Text fw={600}>Peças</Text>
            <Group gap="xs">
            {amostras.map((n: number) => (
                <Chip
                key={n}
                checked={peca === n}
                onChange={() => setPeca(n)}
                color={isPieceDone(n) ? 'green' : 'blue'}
                variant={isPieceDone(n) ? 'light' : 'outline'}
                radius="md"
                >
                #{n} {isPieceDone(n) ? '✅' : ''}
                </Chip>
            ))}
            {!amostras?.length && <Text c="dimmed">Defina a amostragem acima.</Text>}
            </Group>
        </Stack>
    </Card>

      <Group align="start" grow>
        <Card withBorder radius="lg">
          <Stack>
            <ImagePinBoard
              // mantemos a API atual (src + pins com x/y), mas agora REPASSANDO o measuredSet
              src={url}
              height={520}
              pins={cotas.map((c:any) => ({ id: c.id, x: c.pos_x, y: c.pos_y, label: c.tag }))}
              measuredSet={measuredCotasCurrentPiece} // 👈 cotas já medidas da peça selecionada (para estilizar em cinza)
              onPinClick={(p:any)=> {
                const c = cotas.find((x:any)=> x.id === p.id);
                if (c) setCotaSel({ id: c.id, tag: c.tag });
              }}
            />
          </Stack>
        </Card>

        <Card withBorder radius="lg">
          <Stack gap="sm">
            <Text fw={600}>Lançar medição</Text>
            <Select
              label="Peça"
              placeholder="Selecione a peça"
              data={optionsPecas}
              value={peca ? String(peca) : null}
              onChange={(v)=> setPeca(v ? Number(v) : null)}
              searchable
            />
            <Text c="dimmed">Clique em um ponto do desenho para escolher a cota.</Text>

            <Text fw={600} mt="md">Histórico</Text>
            <Table striped highlightOnHover stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{width:100}}>Peça</Table.Th>
                  <Table.Th>Cota</Table.Th>
                  <Table.Th style={{width:140}}>Valor</Table.Th>
                  <Table.Th style={{width:120}}>Resultado</Table.Th>
                  <Table.Th style={{width:220}}>Quem/Quando</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meds.map((m:any) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>#{m.peca_idx}</Table.Td>
                    <Table.Td>{m.cota?.tag ?? '-'}</Table.Td>
                    <Table.Td>{m.valor?.toFixed(3)}</Table.Td>
                    <Table.Td>
                      <Badge color={m.ok === true ? 'green' : m.ok === false ? 'red' : 'gray'} variant="light">
                        {m.ok === true ? 'OK' : m.ok === false ? 'NG' : '—'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{m.autor?.full_name ?? '—'}</Text>
                      <Text size="xs" c="dimmed">{new Date(m.medido_em).toLocaleString()}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!meds.length && (
                  <Table.Tr><Table.Td colSpan={5}><Text c="dimmed">Sem medições ainda.</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      </Group>

      {/* Modal de valor */}
      <Modal
        opened={!!cotaSel}
        onClose={() => { setCotaSel(null); setValorStr(''); }}
        title={cotaSel ? `Cotar: ${cotaSel.tag} — Peça #${peca ?? '—'}` : ''}
        radius="lg"
        size="lg"
        >
        <Stack gap="md">
            {/* display do valor */}
            <TextInput
            label="Valor medido"
            value={valorStr}
            onChange={(e) => setValorStr(e.currentTarget.value)}
            placeholder="Digite ou use o teclado abaixo"
            size="xl"
            styles={{
                input: { fontSize: 24, height: 56, fontWeight: 700, textAlign: 'right' },
                label: { fontSize: 14 }
            }}
            />
            {/* teclado numérico grande */}
            <NumericKeypad
            value={valorStr}
            onChange={setValorStr}
            allowNegative={false}      // mude para true se precisar
            onEnter={salvar}
            />
            <Group justify="end" mt="xs">
            <Button variant="light" onClick={() => { setCotaSel(null); setValorStr(''); }}>Cancelar</Button>
            <Button onClick={salvar} disabled={!valorStr.trim()}>Salvar</Button>
            </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
