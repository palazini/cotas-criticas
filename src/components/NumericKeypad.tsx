import { Button, Group, Stack } from '@mantine/core';

type Props = {
  value: string;
  onChange: (next: string) => void;
  allowNegative?: boolean;
  onEnter?: () => void;
};

export default function NumericKeypad({ value, onChange, allowNegative, onEnter }: Props) {
  const append = (ch: string) => onChange(value + ch);
  const backspace = () => onChange(value.slice(0, -1));
  const clear = () => onChange('');
  const toggleSign = () => {
    if (!allowNegative) return;
    if (!value) { onChange('-'); return; }
    onChange(value.startsWith('-') ? value.slice(1) : '-' + value);
  };
  const addDecimal = () => {
    if (value.includes('.') || value.includes(',')) return;
    onChange(value + '.'); // vírgula é aceita no input manual
  };

  const K = { height: 64, fontSize: 20, fontWeight: 600, borderRadius: 12 } as const;
  const Kwide = { ...K, fontSize: 16 };

  const Btn = (props: any) => <Button variant="default" {...props} />;

  return (
    <Stack gap={10}>
      <Group grow>
        <Btn style={K} onClick={() => append('7')}>7</Btn>
        <Btn style={K} onClick={() => append('8')}>8</Btn>
        <Btn style={K} onClick={() => append('9')}>9</Btn>
        <Btn style={Kwide} onClick={clear}>Limpar</Btn>
      </Group>
      <Group grow>
        <Btn style={K} onClick={() => append('4')}>4</Btn>
        <Btn style={K} onClick={() => append('5')}>5</Btn>
        <Btn style={K} onClick={() => append('6')}>6</Btn>
        <Btn style={Kwide} onClick={backspace}>⌫</Btn>
      </Group>
      <Group grow>
        <Btn style={K} onClick={() => append('1')}>1</Btn>
        <Btn style={K} onClick={() => append('2')}>2</Btn>
        <Btn style={K} onClick={() => append('3')}>3</Btn>
        <Btn style={Kwide} onClick={addDecimal}>,</Btn>
      </Group>
      <Group grow>
        <Btn style={{ ...K, flex: 2 }} onClick={() => append('0')}>0</Btn>
        {allowNegative ? <Btn style={K} onClick={toggleSign}>±</Btn> : <div style={{ flex: 1 }} />}
        <Button color="blue" style={Kwide} onClick={onEnter}>OK</Button>
      </Group>
    </Stack>
  );
}
