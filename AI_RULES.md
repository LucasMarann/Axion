# AI_RULES.md — Regras de Desenvolvimento do App (Fonte de Verdade: MVP.md, PRD.md, Features.md)

Este projeto será construído **estritamente** com base nos arquivos:
- `MVP.md` (escopo executável do MVP e o que fica fora)
- `PRD.md` (visão de produto, requisitos e critérios de sucesso)
- `Features.md` (checklist geral; usar para planejar pós-MVP sem antecipar)

Qualquer feature fora do MVP **não deve** ser implementada sem confirmação explícita.

---

## 1) Tech Stack (5–10 pontos)

- **React + TypeScript** para toda a UI e lógica de front-end.
- **React Router** para roteamento (rotas centralizadas em `src/App.tsx`).
- **Tailwind CSS** para estilo (layout responsivo e mobile-first por padrão).
- **shadcn/ui** + **Radix UI** para componentes acessíveis e consistentes.
- **lucide-react** para ícones.
- **Arquitetura por pastas**:
  - Páginas em `src/pages/`
  - Componentes em `src/components/`
  - Lógica/utilitários em `src/lib/` ou `src/utils/` (preferir `src/lib/` para utilidades centrais)
- **Toasts/feedback**: usar o sistema de toast já presente no projeto (shadcn/ui) para eventos importantes.
- **Sem backend no front**: para autenticação, dados e permissões reais, usar integração com **Supabase** quando necessário (evitar “mock” permanente para features de segurança/roles).

---

## 2) Regras de escopo (produto)

- Implementar **somente** o que está dentro do **MVP** (ver `MVP.md`) sem adicionar “extras” por iniciativa própria.
- Sempre respeitar os itens **FORA DO MVP** (não implementar sem pedido explícito).
- Prioridade de construção (alto nível):
  1. Acesso & Perfis (cliente/dono/motorista) + controle de acesso
  2. Entregas & rastreio (status, timeline)
  3. Visibilidade (mapa simplificado p/ cliente com delay; real-time p/ dono)
  4. IA mínima viável (ETA simples + risco de atraso + 1 insight)
  5. Notificações do MVP
  6. Métricas essenciais

---

## 3) Regras de bibliotecas: o que usar para quê

### UI / Componentes
- **Usar shadcn/ui** como primeira escolha para componentes (Button, Card, Dialog, Sheet, Tabs, Table, Badge, Alert, Toast etc.).
- **Usar Radix UI apenas via shadcn/ui** quando possível (evitar uso direto se já houver componente shadcn equivalente).
- **Ícones**: somente `lucide-react`.

### Estilos
- **Tailwind CSS** para todo styling.
- Evitar CSS customizado; só criar CSS adicional quando Tailwind não resolver bem.
- **Design responsivo obrigatório** (mobile-first), especialmente para a interface do cliente final.

### Estado e dados no front-end
- Manter simples: **React hooks** (`useState`, `useMemo`, `useEffect`) e props.
- Evitar adicionar bibliotecas de estado global (Redux/Zustand) sem necessidade clara e pedido explícito.
- Para “data fetching” e cache: não adicionar libs novas sem pedido; se houver backend, preferir chamadas diretas e padrões simples.

### Roteamento e páginas
- **React Router** obrigatoriamente.
- Rotas definidas **somente** em `src/App.tsx`.
- Página principal deve ser `src/pages/Index.tsx`.

### Notificações e feedback
- Usar **Toast** (shadcn/ui) para:
  - sucesso/erro ao salvar/atualizar
  - falhas de autenticação/permissão
  - mudanças relevantes (ex.: status/ETA, alertas de risco)
- Não criar sistemas paralelos de notificação.

### Autenticação, perfis e segurança (quando entrar)
- Se o app precisar de:
  - login real
  - banco de dados
  - regras de acesso por perfil
  - sessões/tokens
  - dados sensíveis (CPF, logs, rastreio)
  
  então **usar Supabase** como base (Auth + DB + policies).
- Não implementar “segurança fake” apenas no front para features críticas.

### Mapas e rotas
- Não adicionar biblioteca de mapas sem alinhamento explícito (o MVP define “mapa simplificado” e “rota planejada vs executada”).
- Quando for implementar mapa, escolher uma abordagem que:
  - permita **delay de localização** para cliente
  - permita **precisão total** para dono
  - não exponha localização exata ao cliente final

---

## 4) Regras de implementação (qualidade e manutenção)

- Criar **um arquivo por componente** (não colocar componentes novos dentro de arquivos existentes).
- Manter componentes com ~100 linhas ou menos; se crescer, propor refatoração.
- Não editar arquivos de `shadcn/ui`; criar wrappers/novos componentes se precisar alterar comportamento/estilo.
- Sem “TODO” e sem placeholders: toda feature implementada deve estar **funcional** e visível na UI.
- Evitar overengineering: implementar o mínimo necessário para cumprir o item do MVP em questão.

---

## 5) Regras específicas do produto (do MVP/PRD)

- **Delay obrigatório de localização para cliente**: qualquer visualização do cliente deve respeitar esse princípio.
- **Dono** tem visão quase em tempo real e mais detalhada.
- **IA do MVP** deve ser simples, explicável e acionável:
  - ETA simples (distância/velocidade/histórico básico)
  - classificação de risco (normal / em risco / atrasada)
  - 1 insight por rota em linguagem natural
- **Métricas desde o início** (quando começarem a existir eventos): rastreios, acessos do dono, notificações, on-time, erro de ETA.

---

## 6) Regra de “fonte de verdade” e decisões

- Em caso de conflito:
  1. `MVP.md` manda (escopo executável)
  2. `PRD.md` orienta (visão/requisitos)
  3. `Features.md` organiza (roadmap/checklist)
- Qualquer nova decisão de produto deve ser registrada ou confirmada antes de codar.