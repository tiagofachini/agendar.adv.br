# CLAUDE.md — Guia de trabalho para este projeto

## Estilo de trabalho

- **Planeje antes de executar** tarefas com múltiplos arquivos ou impacto em banco. Para tarefas simples, execute diretamente.
- **Commit e push a cada entrega concluída** — nunca deixe mudanças relevantes sem versionar.
- **Build antes de commitar** (`npm run build`) para garantir que nenhum erro de compilação vai para produção.
- Quando uma tarefa depende de ação manual do usuário em serviços externos (Supabase, GitHub, DNS), forneça o **link direto** e a instrução exata do que deve ser feito — não peça para o usuário "ir lá e configurar".
- Comunique o que está fazendo em frases curtas. Ao terminar, resuma o que mudou e o que ainda depende do usuário.

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + React Router v6 |
| Estilo | Tailwind CSS + shadcn/ui + Framer Motion |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Edge Functions | Supabase Functions (Deno/TypeScript) |
| E-mail transacional | Resend (`notificacoes@[dominio]`) |
| Hosting | Hostinger — Apache com `.htaccess` |
| CI/CD | GitHub Actions (`.github/workflows/`) |

---

## Git

- Branch de desenvolvimento: definida no início de cada sessão.
- Nunca commitar em `main` diretamente sem passar pelo fluxo de build.
- Mensagens de commit descritivas no formato `tipo: descrição curta`.
- Sempre `git push -u origin <branch>` após cada commit relevante.
- O arquivo `public/.htaccess` é copiado automaticamente para `dist/` pelo Vite — commitar ambos não é necessário pois `dist/` está no `.gitignore`.

---

## Supabase — padrões obrigatórios

### Tabelas e RLS
- Toda tabela nova recebe `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Policies separadas por operação (`FOR INSERT`, `FOR SELECT`, etc.) e por role (`anon`, `authenticated`).
- Dados sensíveis (PII: e-mail, telefone, nome) bloqueados para `anon` via SELECT — lidos apenas por RPCs `SECURITY DEFINER`.

### RPCs (funções SQL)
- Usar `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` em toda função que precisa bypassar RLS ou acessar dados protegidos.
- `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated` sempre após criar a função.
- Migrations incrementais: usar `CREATE OR REPLACE FUNCTION` quando o tipo de retorno não muda; usar `DROP FUNCTION IF EXISTS ... CASCADE` explicitamente **antes** do `CREATE OR REPLACE` quando o tipo de retorno muda — e colocar o DROP no início do arquivo, não no meio.

### Migrations SQL
- Arquivos em `supabase/sql/` — um arquivo por feature.
- Sempre idempotentes: usar `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`.
- Quando o Supabase Dashboard rejeitar por conflito de tipo de retorno, a solução é rodar o DROP como query separada antes de rodar o arquivo completo.
- Link direto para o SQL editor: `https://supabase.com/dashboard/project/<PROJECT_REF>/sql/new`

### Edge Functions
- Criadas em `supabase/functions/<nome>/index.ts`.
- Deploy manual pelo usuário: `npx supabase functions deploy <nome> --project-ref <PROJECT_REF>`.
- Variáveis de ambiente configuradas no Dashboard: `https://supabase.com/dashboard/project/<PROJECT_REF>/functions`.
- Sempre validar inputs **antes** de consumir APIs pagas (Anthropic, Resend, etc.) — nunca consumir crédito para depois falhar em validação.

---

## Hospedagem Apache (Hostinger)

O arquivo `public/.htaccess` é a configuração do servidor. Padrão para SPAs React:

```apache
# MIME types
<IfModule mod_headers.c>
  <FilesMatch "^sitemap\.xml$">
    Header set Content-Type "application/xml; charset=UTF-8"
  </FilesMatch>
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 301: www → não-www (canônico — deve vir antes do fallback SPA)
  RewriteCond %{HTTP_HOST} ^www\.seu-dominio\.com\.br$ [NC]
  RewriteRule ^(.*)$ https://seu-dominio.com.br/$1 [R=301,L]

  # Não redirecionar arquivos e diretórios reais
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Fallback SPA
  RewriteRule ^ /index.html [L]
</IfModule>
```

---

## SEO

- Toda página de conteúdo deve ter `<link rel="canonical" href="https://dominio.com/caminho" />` via `react-helmet` apontando para o domínio **sem www**.
- Páginas de resultado de busca/filtro dinâmico: `<meta name="robots" content="noindex, follow" />`.
- O redirect www → não-www no `.htaccess` é obrigatório para evitar o aviso "Cópia sem página canônica selecionada pelo usuário" no Search Console.
- Sitemap gerado automaticamente no build por `tools/generate-sitemap.js`.

---

## Código — regras gerais

- Sem comentários explicando o que o código faz — apenas quando o **porquê** é não óbvio.
- Sem abstrações antecipadas: três linhas repetidas são melhores que uma abstração prematura.
- Sem tratamento de erro para cenários impossíveis — confiar nas garantias do framework e do banco.
- Validações acontecem **antes** de qualquer chamada a serviço externo pago.
- Nunca gerar ou adivinhar URLs — usar apenas as fornecidas pelo usuário ou presentes no código.

---

## Componentes UI recorrentes

- `shadcn/ui`: Button, Input, Card, Badge, Select, Accordion, AlertDialog, Tooltip — importar de `@/components/ui/`.
- Ícones: `lucide-react`.
- Animações: `framer-motion` (`motion.div`, `AnimatePresence`).
- Toasts: `useToast` de `@/components/ui/use-toast`.
- Rotas protegidas: `<ProtectedRoute />` wrappando rotas admin.
- Auth context: `useAuth()` de `@/contexts/SupabaseAuthContext`.

---

## Quando o usuário precisa agir externamente

Sempre fornecer:
1. O link direto (não o caminho genérico)
2. A instrução exata (colar o arquivo X, executar o comando Y)
3. O que verificar para confirmar que funcionou

Exemplos de links úteis:
- SQL Editor: `https://supabase.com/dashboard/project/<REF>/sql/new`
- Edge Functions: `https://supabase.com/dashboard/project/<REF>/functions`
- Auth settings: `https://supabase.com/dashboard/project/<REF>/auth/url-configuration`
- GitHub Secrets: `https://github.com/<USER>/<REPO>/settings/secrets/actions`
- Search Console: `https://search.google.com/search-console`
