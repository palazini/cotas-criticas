import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

function normalizeComma(s: string) {
  return s.replace('.', ',').replace(/[^\d,]/g, '');
}

export default function Numpad({
  opened,
  initial,
  onClose,
  onConfirm,
  label = 'Valor'
}: {
  opened: boolean;
  initial?: string;
  onClose: () => void;
  onConfirm: (valorStr: string) => void;
  label?: string;
}) {
  const [val, setVal] = useState(initial || '');

  useEffect(() => {
    if (opened) setVal(initial ? normalizeComma(initial) : '');
  }, [opened, initial]);

  function press(ch: string) {
    if (ch === 'back') setVal((s) => s.slice(0, -1));
    else if (ch === 'clear') setVal('');
    else if (ch === ',') {
      setVal((s) => (s.includes(',') ? s : (s || '0') + ','));
    } else {
      setVal((s) => (s + ch).replace(/[^\d,]/g, ''));
    }
  }

  function confirm() {
    // força 2 casas (se tiver vírgula)
    let s = val;
    if (!s) return onConfirm('');
    if (!s.includes(',')) s = s + ',00';
    const [i, d = ''] = s.split(',');
    const dec = (d + '00').slice(0, 2);
    onConfirm(`${i},${dec}`);
  }

  return (
    <Modal opened={opened} onClose={onClose} title={label} centered size="md">
      <Stack>
        <TextInput value={val} onChange={(e) => setVal(normalizeComma(e.currentTarget.value))} />

        <Stack gap="xs">
          {[
            ['7', '8', '9'],
            ['4', '5', '6'],
            ['1', '2', '3'],
            [',', '0', 'back'],
          ].map((row, idx) => (
            <Group key={idx} grow>
              {row.map((k) => (
                <Button key={k} onClick={() => press(k)} variant="light">
                  {k === 'back' ? '⌫' : k}
                </Button>
              ))}
            </Group>
          ))}
          <Group justify="space-between" mt="xs">
            <Button variant="default" onClick={() => press('clear')}>Limpar</Button>
            <Button onClick={confirm}>OK</Button>
          </Group>
        </Stack>
      </Stack>
    </Modal>
  );
}
