import { useState } from 'react'
import type { FormEvent } from 'react';
import { TextInput, PasswordInput, Paper, Title, Button, Stack, Group, Anchor } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useAuth } from '../auth/AuthProvider'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signInEmail } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signInEmail(email, password)
    setLoading(false)
    if (error) {
      notifications.show({ color: 'red', title: 'Falha no login', message: error.message ?? 'Credenciais inválidas' })
    } else {
      notifications.show({ color: 'green', title: 'Bem-vindo!', message: 'Login realizado com sucesso.' })
      nav('/', { replace: true })
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <Paper w={360} p="lg" shadow="xl" radius="lg" withBorder>
        <Stack>
          <Title order={3} ta="center">Cotas Críticas</Title>
          <form onSubmit={onSubmit}>
            <Stack>
              <TextInput label="Email" placeholder="gestor@empresa.com" value={email} onChange={(e)=>setEmail(e.currentTarget.value)} required />
              <PasswordInput label="Senha" placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.currentTarget.value)} required />
              <Button type="submit" loading={loading}>Entrar</Button>
              <Group justify="space-between">
                <Anchor size="sm" c="dimmed">Esqueci minha senha</Anchor>
                <Anchor size="sm" c="dimmed">Criar conta (somente convites)</Anchor>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </div>
  )
}
