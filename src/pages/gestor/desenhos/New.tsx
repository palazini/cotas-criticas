import { useMemo, useState } from 'react';
import { Button, Card, FileInput, Group, Image, Stack, TextInput, Textarea } from '@mantine/core';
import { IconCheck, IconPhotoPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { supabase } from '../../../lib/supabase';

function slug(s: string) {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export default function DesenhosNew() {
  const nav = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : ''), [arquivo]);

  async function onSalvar() {
    if (!arquivo || !codigo || !nome) return;
    setSaving(true);
    try {
      // 1) Upload no Storage
      const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `desenhos/${slug(codigo)}_${Date.now()}.${ext}`;
      const up = await supabase.storage.from('desenhos').upload(path, arquivo, { upsert: false });
      if (up.error) throw up.error;

      // 2) URL pública
      const { data: pub } = supabase.storage.from('desenhos').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // 3) Insert na tabela
      const { error: insErr } = await supabase.from('desenhos').insert({
        codigo, nome, descricao, imagem_url: publicUrl,
      });
      if (insErr) throw insErr;

      notifications.show({ color: 'teal', icon: <IconCheck />, title: 'Desenho salvo', message: `${codigo} - ${nome}` });
      nav('/gestor/desenhos');
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao salvar', message: e.message || String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Cadastrar desenho" subtitle="Envie a imagem técnica e os metadados básicos" />
      <Card withBorder radius="lg">
        <Stack>
          <TextInput label="Código" placeholder="DSN-001" value={codigo} onChange={(e) => setCodigo(e.currentTarget.value)} />
          <TextInput label="Nome" placeholder="Flange RTJ Ø180" value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
          <Textarea label="Descrição (opcional)" minRows={2} value={descricao} onChange={(e) => setDescricao(e.currentTarget.value)} />

          <FileInput label="Imagem do desenho (PNG/JPG)" placeholder="Selecione um arquivo" leftSection={<IconPhotoPlus size={16} />} accept="image/*" value={arquivo} onChange={setArquivo} />
          {preview && <Image src={preview} alt="preview" radius="md" fit="contain" h={320} />}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => nav('/gestor/desenhos')}>Cancelar</Button>
            <Button disabled={!codigo || !nome || !arquivo} loading={saving} onClick={onSalvar}>Salvar</Button>
          </Group>
        </Stack>
      </Card>
    </>
  );
}
