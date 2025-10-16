import { Group, Title, Text, Box } from '@mantine/core';

export default function PageHeader({
  title,
  subtitle,
  rightSection,
}: {
  title: string;
  subtitle?: string;
  rightSection?: React.ReactNode;
}) {
  return (
    <Box mb="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{title}</Title>
          {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
        </div>
        {rightSection}
      </Group>
    </Box>
  );
}
