import { useState } from 'react';
import { Button, Card, FileInput, Stack, TextInput, Group, Text, Image } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createDesenho } from '../../services/desenhos';
import { uploadDesenhoFile, signedUrlDesenho } from '../../services/storage';
import { useNavigate } from 'react-router-dom';

export default function DesenhoNew() {
  const [nome, setNome] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  function onFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function salvar() {
    if (!nome) { notifications.show({ color: 'yellow', title: 'Informe o nome' }); return; }
    setSaving(true);
    try {
      // 1) cria o desenho (para ter o id) — sem imagem_path inicialmente
      const id = await createDesenho({ nome, imagem_path: null });

      // 2) se tiver arquivo, faz upload e atualiza o registro
      let path: string | null = null;
      if (file) {
        path = await uploadDesenhoFile(file, id);
        const { error } = await (await import('../../lib/supabase')).supabase
          .from('desenhos').update({ imagem_path: path }).eq('id', id);
        if (error) throw error;
      }

      notifications.show({ color: 'green', title: 'Desenho criado' });
      // vai para o detalhe
      nav(`/gestor/desenhos/${id}`);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card withBorder radius="lg">
      <Stack>
        <Text fw={600}>Novo Desenho</Text>
        <TextInput label="Nome" placeholder="Válvula XYZ - Rev A" value={nome} onChange={(e)=>setNome(e.currentTarget.value)} />
        <FileInput label="Imagem (opcional)" placeholder="Selecione um arquivo…" value={file} onChange={onFile} accept="image/*" />
        {preview && <Image src={preview} alt="preview" w={260} radius="md" />}
        <Group justify="end">
          <Button onClick={salvar} loading={saving}>Salvar</Button>
        </Group>
      </Stack>
    </Card>
  );
}
