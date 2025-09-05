import { useEffect, useState } from 'react';
import { Card, Group, Button, SimpleGrid, Text, Image, Stack, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { listDesenhos, deleteDesenho, type Desenho } from '../../services/desenhos';
import { signedUrlDesenho } from '../../services/storage';
import { useNavigate } from 'react-router-dom';

export default function DesenhosList() {
  const [rows, setRows] = useState<(Desenho & { url?: string })[]>([]);
  const nav = useNavigate();

  async function load() {
    try {
      const ds = await listDesenhos();
      // cria URLs assinadas (quando houver imagem)
      const withUrls = await Promise.all(ds.map(async (d) => {
        if (d.imagem_path) {
          try { return { ...d, url: await signedUrlDesenho(d.imagem_path) }; }
          catch { return d; }
        }
        return d;
      }));
      setRows(withUrls);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    try {
      await deleteDesenho(id);
      notifications.show({ color: 'green', title: 'Desenho apagado' });
      await load();
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="xl" fw={700}>Desenhos</Text>
        <Button leftSection={<IconPlus size={18}/>} onClick={() => nav('/gestor/desenhos/new')}>Novo Desenho</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
        {rows.map((d) => (
          <Card key={d.id} withBorder radius="lg" shadow="sm" p="sm">
            <Card.Section>
              <Image src={d.url} alt={d.nome} h={160} fallbackSrc="https://placehold.co/600x400?text=Sem+Imagem" />
            </Card.Section>
            <Group justify="space-between" mt="sm">
              <Text fw={600}>{d.nome}</Text>
              <Group gap="xs">
                <ActionIcon variant="subtle" onClick={() => nav(`/gestor/desenhos/${d.id}`)} title="Abrir">
                  <IconExternalLink size={18}/>
                </ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={() => remove(d.id)} title="Apagar">
                  <IconTrash size={18}/>
                </ActionIcon>
              </Group>
            </Group>
          </Card>
        ))}
        {!rows.length && (
          <Card withBorder radius="lg"><Text c="dimmed">Nenhum desenho ainda.</Text></Card>
        )}
      </SimpleGrid>
    </Stack>
  );
}
