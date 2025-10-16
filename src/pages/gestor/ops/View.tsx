import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Group, Image, Loader, ScrollArea, Table, Text, Switch, Modal, rem } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';
import { notifications } from '@mantine/notifications';

type OP = {
  id: string;
  codigo: string;
  status: 'aberta' | 'concluida';
  desenho_id: string;
  qty: number | null;
  freq: number | null;
  created_at: string | null;
  params_origem: 'gestor' | 'operador' | null;
};
type Desenho = { id: string; codigo: string; nome: string; imagem_url: string };
type Cota = { id: string; etiqueta: string; nominal: number | null; tol_menos: number | null; tol_mais: number | null; unidade?: string | null };
type Amostra = { id: string; indice: number };
type Med = { amostra_id: string; cota_id: string; valor: number };

function fmtBR(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OPsView() {
  const { opId } = useParams();
  const nav = useNavigate();

  const [op, setOp] = useState<OP | null>(null);
  const [desenho, setDesenho] = useState<Desenho | null>(null);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [loading, setLoading] = useState(true);
  const [apenasFora, setApenasFora] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // OP
      const oq = await supabase
        .from('ops')
        .select('id,codigo,status,desenho_id,qty,freq,created_at,params_origem')
        .eq('id', opId)
        .single();
      if (oq.error || !oq.data) {
        notifications.show({ color: 'red', title: 'OP não encontrada', message: oq.error?.message });
        nav('/gestor/ops');
        return;
      }
      setOp(oq.data as OP);

      // Desenho
      const dq = await supabase
        .from('desenhos')
        .select('id,codigo,nome,imagem_url')
        .eq('id', oq.data.desenho_id)
        .single();
      if (!dq.error && dq.data) setDesenho(dq.data as Desenho);

      // Cotas (com tolerâncias)
      const cq = await supabase
        .from('cotas')
        .select('id,etiqueta,nominal,tol_menos,tol_mais,unidade')
        .eq('desenho_id', oq.data.desenho_id)
        .order('etiqueta', { ascending: true });
      if (!cq.error && cq.data) setCotas(cq.data as Cota[]);

      // Amostras
      const aq = await supabase
        .from('op_amostras')
        .select('id,indice')
        .eq('op_id', opId)
        .order('indice', { ascending: true });
      if (!aq.error && aq.data) setAmostras(aq.data as Amostra[]);

      // Medições
      const ids = (aq.data ?? []).map((a: any) => a.id);
      const mq =
        ids.length > 0
          ? await supabase.from('medicoes').select('amostra_id,cota_id,valor').in('amostra_id', ids)
          : { data: [], error: null };
      if (!mq.error && mq.data) setMeds(mq.data as Med[]);

      setLoading(false);
    })();
  }, [opId, nav]);

  // gcd p/ inferir frequência
  function gcd(a: number, b: number): number {
    let x = Math.abs(a), y = Math.abs(b);
    while (y) [x, y] = [y, x % y];
    return x;
  }

  const qtyInferida = useMemo(() => {
    if (amostras.length === 0) return null;
    return Math.max(...amostras.map(a => a.indice));
  }, [amostras]);

  const freqInferida = useMemo(() => {
    const idx = amostras.map(a => a.indice).sort((a, b) => a - b);
    if (idx.length < 1) return null;
    return idx.reduce((acc, n) => (acc === 0 ? n : gcd(acc, n)), 0) || null;
  }, [amostras]);

  const qtyMostrar = op?.qty ?? qtyInferida;
  const freqMostrar = op?.freq ?? freqInferida;
  const origem = op?.params_origem ?? (amostras.length ? 'operador' : null);

  // Map (amostraId -> { cotaId -> valor })
  const matrix = useMemo(() => {
    const byAmostra = new Map<string, Map<string, number>>();
    for (const m of meds) {
      const row = byAmostra.get(m.amostra_id) ?? new Map<string, number>();
      row.set(m.cota_id, Number(m.valor));
      byAmostra.set(m.amostra_id, row);
    }
    return byAmostra;
  }, [meds]);

  const totals = useMemo(() => {
    const totalEsperado = amostras.length * cotas.length;
    const totalLidos = meds.length;
    const pct = totalEsperado > 0 ? Math.round((totalLidos / totalEsperado) * 100) : 0;
    return { totalEsperado, totalLidos, pct };
  }, [amostras.length, cotas.length, meds.length]);

  // tolerância
  function dentroDaTolerancia(c: Cota, v: number) {
    if (c.nominal == null || c.tol_mais == null || c.tol_menos == null) return null;
    const min = Number(c.nominal) - Number(c.tol_menos);
    const max = Number(c.nominal) + Number(c.tol_mais);
    return v >= min && v <= max;
  }
  function specStr(c: Cota) {
    if (c.nominal == null) return '';
    const p = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mais = c.tol_mais != null ? ` +${p(Number(c.tol_mais))}` : '';
    const menos = c.tol_menos != null ? ` / -${p(Number(c.tol_menos))}` : '';
    const u = c.unidade || 'mm';
    return `${p(Number(c.nominal))}${u}${mais}${menos}`;
  }

  // Resumo por cota (lidos/ok/fora/%fora)
  const statsPorCota = useMemo(() => {
    return cotas.map((c) => {
      let lidos = 0, ok = 0, fora = 0;
      for (const a of amostras) {
        const v = matrix.get(a.id)?.get(c.id);
        if (v != null) {
          lidos++;
          const d = dentroDaTolerancia(c, v);
          if (d === true) ok++;
          else if (d === false) fora++;
        }
      }
      const pctFora = lidos ? Math.round((fora * 100) / lidos) : 0;
      return { id: c.id, etiqueta: c.etiqueta, lidos, ok, fora, pctFora, spec: specStr(c) };
    }).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [cotas, amostras, matrix]);

  function downloadCSV() {
    if (!op) return;
    const header = ['Peça', ...cotas.map(c => `Cota ${c.etiqueta}`)];
    const lines = [header.join(';')];

    for (const a of amostras) {
      const row: string[] = [String(a.indice)];
      const map = matrix.get(a.id);
      for (const c of cotas) {
        const v = map?.get(c.id);
        row.push(v != null ? fmtBR(v) : '');
      }
      lines.push(row.join(';'));
    }
    lines.push('');
    lines.push(['Totais', `Lidos: ${totals.totalLidos} de ${totals.totalEsperado} (${totals.pct}%)`].join(';'));

    // ADIÇÃO: BOM + CRLF
    const bom = '\ufeff';
    const csvText = bom + lines.join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${op.codigo}-medicoes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !op || !desenho) {
    return (
      <Card withBorder radius="lg">
        <Group justify="center" py="xl"><Loader /></Group>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`${op.codigo} — ${desenho.codigo} / ${desenho.nome}`}
        subtitle={`Status: ${op.status} — Criada em: ${op.created_at?.slice(0,19).replace('T',' ')}`}
        rightSection={
          <Group>
            <Button variant="light" leftSection={<IconDownload size={16} />} onClick={downloadCSV}>Exportar CSV</Button>
            <Button variant="default" onClick={() => nav('/gestor/ops')}>Voltar</Button>
          </Group>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(330px, 0.9fr) minmax(520px, 1.4fr)',
          gridTemplateRows: 'auto auto',
          alignItems: 'start',
          gap: rem(12)
        }}
      >
        {/* ESQUERDA — Desenho + badges (imagem um pouco menor) */}
        <Card withBorder radius="lg" p="xs" style={{ gridRow: '1 / span 2' }}>
          <Image
            src={desenho.imagem_url}
            alt={desenho.nome}
            radius="md"
            fit="contain"
            h={420}
            onClick={() => setImgOpen(true)}
            style={{ cursor: 'zoom-in' }}
            title="Clique para ampliar"
          />
          <Group gap="sm" mt="xs">
            <Badge variant="light" color={op.qty != null ? 'indigo' : 'grape'}>QTY: {qtyMostrar ?? '-'}</Badge>
            <Badge variant="light" color={op.freq != null ? 'indigo' : 'grape'}>FREQ: {freqMostrar ?? '-'}</Badge>
            {origem && (
              <Badge variant="outline" color={origem === 'operador' ? 'grape' : 'indigo'}>
                Origem: {origem === 'operador' ? 'Operador' : 'Gestor'}{op?.params_origem ? '' : ' (inferida)'}
              </Badge>
            )}
            <Badge color="teal" variant="light">Leituras: {totals.totalLidos}/{totals.totalEsperado} ({totals.pct}%)</Badge>
          </Group>
        </Card>

        {/* DIREITA — Resumo por cota + Matriz empilhados */}
        <Card withBorder radius="lg" p="md" style={{ gridRow: 1 }}>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Resumo por cota</Text>
                <Switch
                  size="sm"
                  checked={apenasFora}
                  onChange={(e) => setApenasFora(e.currentTarget.checked)}
                  label="Realçar apenas fora"
                />
            </Group>
            <ScrollArea type="auto">
              <Table striped highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 80 }}>Cota</Table.Th>
                    <Table.Th style={{ width: 110 }}>Leituras</Table.Th>
                    <Table.Th style={{ width: 90 }}>OK</Table.Th>
                    <Table.Th style={{ width: 90 }}>Fora</Table.Th>
                    <Table.Th style={{ width: 100 }}>% Fora</Table.Th>
                      <Table.Th>Especificação</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {statsPorCota.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td><Text fw={700}>{s.etiqueta}</Text></Table.Td>
                      <Table.Td>{s.lidos}</Table.Td>
                      <Table.Td><Text c="teal" fw={600}>{s.ok}</Text></Table.Td>
                      <Table.Td><Text c={s.fora > 0 ? 'red' : 'dimmed'} fw={700}>{s.fora}</Text></Table.Td>
                      <Table.Td>
                        <Badge color={s.pctFora > 0 ? 'red' : 'teal'} variant="light">
                          {s.pctFora}%
                        </Badge>
                      </Table.Td>
                        <Table.Td><Text c="dimmed" size="sm">{s.spec || '—'}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                  {statsPorCota.length === 0 && (
                    <Table.Tr><Table.Td colSpan={6}><Text c="dimmed">Sem cotas.</Text></Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>

            {/* Matriz Peça × Cota */}
        <Card withBorder radius="lg" p="md" style={{ gridRow: 2 }}>
              <Text fw={600} mb="xs">Medições (Peça × Cota)</Text>
            <ScrollArea w="100%" type="auto">
              <Table striped highlightOnHover stickyHeader withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      style={{
                        position: 'sticky',
                        left: 0,
                        background: 'var(--mantine-color-body)',
                        zIndex: 2,
                        width: 90
                      }}
                        >
                          Peça
                    </Table.Th>
                    {cotas.map((c) => (
                      <Table.Th key={c.id} style={{ whiteSpace: 'nowrap' }}>
                        Cota {c.etiqueta}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {amostras.map((a) => {
                    const map = matrix.get(a.id);
                    return (
                      <Table.Tr key={a.id}>
                        <Table.Td
                          style={{
                            position: 'sticky',
                            left: 0,
                            background: 'var(--mantine-color-body)',
                            zIndex: 1,
                            fontWeight: 600
                          }}
                        >
                          {a.indice}
                        </Table.Td>
                        {cotas.map((c) => {
                          const v = map?.get(c.id);
                          if (v == null) return (
                            <Table.Td key={c.id} style={{ whiteSpace: 'nowrap' }}>
                              <Text c="dimmed">–</Text>
                            </Table.Td>
                          );
                          const ok = dentroDaTolerancia(c, v);
                          const txt = fmtBR(v);
                          const faded = apenasFora && ok === true;
                          return (
                            <Table.Td key={c.id} style={{ whiteSpace: 'nowrap', opacity: faded ? 0.35 : 1 }}>
                              {ok === null ? (
                                txt
                              ) : (
                                <span
                                  style={{
                                    background: ok ? '#dcfce7' : '#fee2e2',
                                    padding: '2px 6px',
                                    borderRadius: 6,
                                    fontWeight: ok ? 500 : 700
                                  }}
                                    title={ok ? 'Dentro da tolerância' : 'Fora da tolerância'}
                                >
                                  {txt}
                                </span>
                              )}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    );
                  })}
                  {amostras.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={1 + cotas.length}><Text c="dimmed">Sem amostras.</Text></Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
      </div>
      <Modal
        opened={imgOpen}
        onClose={() => setImgOpen(false)}
        fullScreen
        overlayProps={{ blur: 2, opacity: 0.35 }}
        padding="md"
        title={`${desenho.codigo} — ${desenho.nome}`}
        >
        <Image
            src={desenho.imagem_url}
            alt={desenho.nome}
            fit="contain"
            // ocupa praticamente a tela inteira, respeitando o header do Modal
            h={`calc(100vh - ${rem(140)})`}
            style={{ userSelect: 'none' }}
        />
      </Modal>
    </>
  );
}
