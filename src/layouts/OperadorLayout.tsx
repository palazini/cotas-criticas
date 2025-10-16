import { AppShell, Group, Title, Button, Text } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';

export default function OperadorLayout() {
  const { signOut, user } = useAuth();
  const nav = useNavigate();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Title order={4}>Cotas Críticas — Operador</Title>
          <Group gap="sm">
            <Text c="dimmed" size="sm">{user?.email}</Text>
            <Button variant="light" leftSection={<IconLogout size={16} />} onClick={() => signOut().then(() => nav('/login'))}>
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
