import { AppShell, Group, Title, Button, Text, Image } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';

export default function OperadorLayout() {
  const { signOut, user } = useAuth();
  const nav = useNavigate();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Group gap="sm" align="center">
            <Link to="/operador" title="Ir para o painel do Operador" style={{ display: 'block', lineHeight: 0 }}>
              <Image
                src="/ci-logo.png"
                alt="CI"
                h={45}
                fit="contain"
                draggable={false}
                style={{ display: 'block' }}
              />
            </Link>
            <Title order={4}>Cotas Críticas</Title>
          </Group>

          <Group gap="sm">
            <Text c="dimmed" size="sm">{user?.email}</Text>
            <Button
              variant="light"
              leftSection={<IconLogout size={16} />}
              onClick={() => signOut().then(() => nav('/login'))}
            >
              Sair
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
