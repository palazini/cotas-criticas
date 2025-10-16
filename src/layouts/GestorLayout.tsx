import { AppShell, NavLink, ScrollArea, Title, Group, Text, Button, Image } from '@mantine/core';
import { IconListDetails, IconFolder, IconHome2, IconLogout } from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';

export default function GestorLayout() {
  const { signOut, user } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group justify="space-between" px="md" h="100%">
          <Group gap="sm" align="center">
            <Link to="/gestor" title="Ir para o painel do Gestor" style={{ display: 'block', lineHeight: 0 }}>
              <Image
                src="/ci-logo.png"
                alt="CI"
                h={45}
                fit="contain"
                draggable={false}
                style={{ display: 'block' }}
              />
            </Link>
            <Title order={4}>Cotas Críticas — Gestor</Title>
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

      <AppShell.Navbar p="sm">
        <ScrollArea type="scroll">
          <NavLink
            label="Início"
            leftSection={<IconHome2 size={16} />}
            active={pathname === '/gestor'}
            onClick={() => nav('/gestor')}
          />
          <NavLink
            label="Desenhos"
            leftSection={<IconFolder size={16} />}
            active={pathname.startsWith('/gestor/desenhos')}
            onClick={() => nav('/gestor/desenhos')}
          />
          <NavLink
            label="OPs"
            leftSection={<IconListDetails size={16} />}
            active={pathname.startsWith('/gestor/ops')}
            onClick={() => nav('/gestor/ops')}
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
