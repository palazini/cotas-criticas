import { useEffect, useState } from 'react';
import {
  Box, Button, Card, Group, PasswordInput, SegmentedControl,
  Stack, Text, TextInput, Title, Image, rem
} from '@mantine/core';
import { IconAt, IconLock, IconLogin } from '@tabler/icons-react';
import { useAuth } from '../app/AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mode, setMode] = useState<'gestor' | 'operador'>('operador');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { user, role, signInGestor, signInOperador } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user && role === 'gestor') nav('/gestor', { replace: true });
    if (user && role === 'operador') nav('/operador', { replace: true });
  }, [user, role, nav]);

  async function onSubmit() {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (mode === 'gestor') {
        const { error } = await signInGestor(email, pwd);
        if (error) setErrorMsg(error);
      } else {
        const { error } = await signInOperador(pin);
        if (error) setErrorMsg(error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(16px, 2vw, 32px)',
        background:
          'radial-gradient(1200px 600px at 20% 10%, rgba(28,74,145,0.10), transparent 60%), ' +
          'radial-gradient(1000px 500px at 80% 90%, rgba(11,43,86,0.10), transparent 60%), ' +
          'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
      }}
    >
      <Card
        withBorder
        shadow="xl"
        radius="xl"
        p="xl"
        style={{
          width: 'min(92vw, 460px)',
          backdropFilter: 'blur(10px)',
          background: 'rgba(255,255,255,0.75)',
          borderColor: 'rgba(255,255,255,0.6)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)'
        }}
      >
        <Stack gap="lg">
          {/* LOGO */}
          <Group justify="center">
            <Image
              src="/brand/logo-horizontal.png"   // ajuste se necessário
              alt="Logo da Empresa"
              h={42}
              fit="contain"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.05))' }}
            />
          </Group>

          {/* Título/subtítulo */}
          <Stack gap={4} align="center">
            <Title order={3} style={{ letterSpacing: 0.2 }}>Plataforma de Cotas Críticas</Title>
            <Text c="dimmed" size="sm">Acesso rápido e otimizado para tablet</Text>
          </Stack>

          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as any)}
            fullWidth
            radius="md"
            color="brand"           // usa a cor da marca
            data={[
              { label: 'Operador', value: 'operador' },
              { label: 'Gestor', value: 'gestor' },
            ]}
          />

          {mode === 'gestor' ? (
            <Stack>
              <TextInput
                label="E-mail"
                placeholder="gestor@empresa.com"
                leftSection={<IconAt size={16} />}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                autoComplete="username"
              />
              <PasswordInput
                label="Senha"
                placeholder="••••••••"
                leftSection={<IconLock size={16} />}
                value={pwd}
                onChange={(e) => setPwd(e.currentTarget.value)}
                autoComplete="current-password"
              />
            </Stack>
          ) : (
            <Stack>
              <TextInput
                label="ID do Operador (4 dígitos)"
                placeholder="0001"
                value={pin}
                onChange={(e) => {
                  const onlyDigits = e.currentTarget.value.replace(/\D/g, '').slice(0, 4);
                  setPin(onlyDigits);
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
              />
              <Text c="dimmed" size="xs">
                Seu login usa apenas o ID. O sistema converte para e-mail + senha padrão.
              </Text>
            </Stack>
          )}

          {errorMsg && (
            <Text c="red" size="sm" ta="center">
              {errorMsg}
            </Text>
          )}

          <Group justify="center">
            <Button
              size="md"
              radius="md"
              leftSection={<IconLogin size={16} />}
              loading={loading}
              onClick={onSubmit}
              color="brand"          // cor sólida da marca
              variant="filled"
              style={{ width: rem(280) }}
            >
              Entrar
            </Button>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
