import { AppShell, Burger, Group, Button, Title, NavLink, ScrollArea, Avatar, Menu } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout, IconLayoutDashboard, IconBox, IconSettings, IconRulerMeasure } from '@tabler/icons-react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from '../auth/useProfile'

export default function AppLayout() {
  const [opened, { toggle }] = useDisclosure()
  const { signOut, user } = useAuth()
  const { role, profile } = useProfile()
  const loc = useLocation()

  const isActive = (path: string) => loc.pathname.startsWith(path)

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header withBorder>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Cotas Críticas</Title>
          </Group>
          <Group>
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button variant="subtle" leftSection={<Avatar radius="xl" size="sm">{(profile?.full_name?.[0] ?? 'U').toUpperCase()}</Avatar>}>
                  {profile?.full_name ?? user?.email}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconSettings size={18} />}>Configurações (em breve)</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={18} />} onClick={signOut}>
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          <NavLink
            component={Link}
            to="/operador"
            active={isActive('/operador')}
            label="Operador"
            leftSection={<IconRulerMeasure size={18} />}
          />
          {role === 'gestor' && (
            <>
              <NavLink
                component={Link}
                to="/gestor/ops"
                active={isActive('/gestor/ops')}
                label="OP's"
                leftSection={<IconLayoutDashboard size={18} />}
              />
              <NavLink
                component={Link}
                to="/gestor/desenhos"
                active={isActive('/gestor/desenhos')}
                label="Desenhos"
                leftSection={<IconBox size={18} />}
              />
            </>
          )}
        </AppShell.Section>
        <AppShell.Section>
          <small style={{ opacity: 0.6, paddingLeft: 8 }}>v0.1.0</small>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
