import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, Group, NumberInput, Progress, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getOp, listOpMedicoes, setOpFields, forceConcludeOp } from '../../services/ops';
import { supabase } from '../../lib/supabase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { IconDownload } from '@tabler/icons-react';

export default function OpDetail() {
  const { id = '' } = useParams();
  const [op, setOp] = useState<any | null>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [qtd, setQtd] = useState<number | ''>('');
  const [freq, setFreq] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);

  async function exportarExcel() {
    try {
        if (!op) throw new Error('OP não carregada.');

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Relatório', {
        properties: { defaultRowHeight: 18 },
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        });

        // Cabeçalho
        ws.mergeCells('A1', 'F1');
        ws.getCell('A1').value = `Relatório de Medições — OP ${op.id}`;
        Object.assign(ws.getCell('A1'), {
        font: { size: 16, bold: true },
        alignment: { horizontal: 'left', vertical: 'middle' },
        });

        ws.addRow([]);
        ws.addRow(['Desenho', (Array.isArray(op.desenho) ? op.desenho[0]?.nome : op.desenho?.nome) ?? '-']);
        ws.addRow(['Quantidade total', op.qtd_total ?? '—']);
        ws.addRow(['Frequência', op.freq_n ?? '—']);
        ws.addRow(['Amostras', (op.amostras ?? []).join(', ') || '—']);
        ws.addRow([]);

        // Tabela
        const header = ['Peça', 'Cota', 'Valor', 'Resultado', 'Quem', 'Quando'];
        const headerRow = ws.addRow(header);
        headerRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
        c.font = { bold: true };
        c.border = { top:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'}, bottom:{style:'thin'} };
        c.alignment = { horizontal: 'center' };
        });

        meds.forEach((m: any) => {
        const row = ws.addRow([
            `#${m.peca_idx}`,
            m.cota?.tag ?? '',
            typeof m.valor === 'number' ? m.valor : '',
            m.ok === true ? 'OK' : m.ok === false ? 'NG' : '',
            m.autor?.full_name ?? '',
            m.medido_em ? new Date(m.medido_em).toLocaleString() : ''
        ]);
        row.getCell(3).numFmt = '0.000';
        const r = row.getCell(4);
        r.alignment = { horizontal: 'center' };
        if (r.value === 'OK') {
            r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3F9D8' } };
            r.font = { color: { argb: 'FF2B8A3E' }, bold: true };
        } else if (r.value === 'NG') {
            r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE3E3' } };
            r.font = { color: { argb: 'FFD64545' }, bold: true };
        }
        row.eachCell((c) => (c.border = { top:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'}, bottom:{style:'thin'} }));
        });

        // Larguras
        ws.columns = [
        { width: 10 },  // Peça
        { width: 16 },  // Cota
        { width: 12 },  // Valor
        { width: 12 },  // Resultado
        { width: 28 },  // Quem
        { width: 24 },  // Quando
        ];

        // Download
        const ab = await wb.xlsx.writeBuffer();
        saveAs(
        new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `op-${op.id}-medicoes.xlsx`
        );
    } catch (e: any) {
        notifications.show({ color: 'red', title: 'Erro ao exportar', message: e.message });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const d = await getOp(id);
      setOp(d);
      if (d?.qtd_total) setQtd(d.qtd_total); else setQtd('');
      if (d?.freq_n) setFreq(d.freq_n); else setFreq('');
      const m = await listOpMedicoes(id);
      setMeds(m);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao carregar OP', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // realtime: medições & a própria OP
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`op:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'op_medicoes', filter: `op_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  async function salvarQtdFreq() {
    try {
      await setOpFields(id, {
        qtd_total: typeof qtd === 'number' ? qtd : null,
        freq_n: typeof freq === 'number' ? freq : null,
      });
      await load();
      notifications.show({ color: 'green', title: 'Atualizado', message: 'Amostras recalculadas' });
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  async function concluir() {
    try {
      await forceConcludeOp(id);
      await load();
      notifications.show({ color: 'green', title: 'Concluída', message: 'OP marcada como concluída' });
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  const pct = (() => {
    const totalAmostras = op?.amostras?.length ?? 0;
    const totalDone = new Set(meds.map(m => `${m.cota?.tag}-${m.peca_idx}`)).size;
    if (!totalAmostras) return 0;
    return Math.min(100, Math.round(100 * totalDone / Math.max(1, totalAmostras)));
  })();

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <div>
          <Title order={3}>OP {id}</Title>
          <Text c="dimmed">
            {op?.desenho ? (Array.isArray(op.desenho) ? op.desenho[0]?.nome : op.desenho?.nome) : '-'}
          </Text>
        </div>

        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={exportarExcel}
          >
            Exportar Excel
          </Button>

          <Badge color={op?.status === 'concluida' ? 'green' : 'yellow'} size="lg" variant="light">
            {op?.status === 'concluida' ? 'Concluída' : 'Em andamento'}
          </Badge>

          {op?.status !== 'concluida' && (
            <Button onClick={concluir}>Forçar conclusão</Button>
          )}
        </Group>
      </Group>

      <Card withBorder radius="lg">
        <Stack gap="sm">
          <Text fw={600}>Amostragem</Text>
          <Group grow>
            <NumberInput label="Quantidade total" value={qtd} onChange={(v) => setQtd(typeof v === 'number' ? v : '')} min={1} />
            <NumberInput label="Frequência" value={freq} onChange={(v) => setFreq(typeof v === 'number' ? v : '')} min={1} />
          </Group>
          <Group>
            <Button onClick={salvarQtdFreq} disabled={loading}>Salvar</Button>
            <Text c="dimmed">Amostras: {op?.amostras?.join(', ') || '—'}</Text>
          </Group>
          <div>
            <Progress value={pct} size="lg" />
            <Text size="xs" c="dimmed">{pct}% (aprox.)</Text>
          </div>
        </Stack>
      </Card>

      <Card withBorder radius="lg">
        <Text fw={600} mb="sm">Medições</Text>
        <Table striped highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 100 }}>Peça</Table.Th>
              <Table.Th>Cota</Table.Th>
              <Table.Th style={{ width: 160 }}>Valor</Table.Th>
              <Table.Th style={{ width: 120 }}>Resultado</Table.Th>
              <Table.Th style={{ width: 220 }}>Quem/Quando</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {meds.map((m) => (
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
      </Card>
    </Stack>
  );
}
