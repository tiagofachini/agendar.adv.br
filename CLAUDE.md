# CLAUDE.md — Guia de trabalho para este projeto

## Estilo de trabalho
**Compromisso:** Essas diretrizes priorizam a cautela em vez da velocidade. Para tarefas triviais, use seu bom senso.

## 1. Pense Antes de Codificar

**Não assuma nada. Não esconda dúvidas. Exponha os trade-offs.**

Antes de implementar:

* Declare explicitamente suas suposições. Se estiver incerto, pergunte.
* Se houver múltiplas interpretações possíveis, apresente todas — não escolha em silêncio.
* Se existir uma abordagem mais simples, diga. Conteste quando for necessário.
* Se algo não estiver claro, pare. Nomeie exatamente o que está confuso. Pergunte.

## 2. Simplicidade em Primeiro Lugar

**Código mínimo que resolve o problema. Nada especulativo.**

* Nenhuma funcionalidade além do que foi solicitado.
* Nenhuma abstração para código de uso único.
* Nenhuma “flexibilidade” ou “configurabilidade” que não tenha sido pedida.
* Nenhum tratamento de erro para cenários impossíveis.
* Se você escrever 200 linhas e poderia ser 50, reescreva.

Pergunte a si mesmo: “Um engenheiro sênior diria que isso está supercomplicado?” Se a resposta for sim, simplifique.

## 3. Alterações Cirúrgicas

**Toque apenas no que precisa. Limpe apenas a sua própria bagunça.**

Ao editar código existente:

* Não “melhore” código adjacente, comentários ou formatação.
* Não refatore coisas que não estão quebradas.
* Mantenha o estilo existente, mesmo que você faria diferente.
* Se notar código morto não relacionado, mencione — não delete.

Quando suas alterações criarem “órfãos”:

* Remova imports, variáveis ou funções que **suas alterações** tornaram inutilizadas.
* Não remova código morto que já existia, a menos que seja solicitado.

O teste: Toda linha alterada deve ser diretamente rastreável ao pedido do usuário.

## 4. Execução Orientada por Objetivos

**Defina critérios de sucesso. Itere até verificar.**

Transforme as tarefas em objetivos verificáveis:

* “Adicionar validação” → “Escreva testes para entradas inválidas e depois faça-os passar”
* “Corrigir o bug” → “Escreva um teste que reproduza o bug e depois faça-o passar”
* “Refatorar X” → “Garanta que os testes passem antes e depois da refatoração”

Para tarefas com múltiplos passos, apresente um plano breve:
Critérios de sucesso fortes permitem que você itere de forma independente. Critérios fracos (“faça funcionar”) exigem esclarecimentos constantes.
**Essas diretrizes estão funcionando quando:** houver menos alterações desnecessárias nos diffs, menos reescritas por supercomplicação e as perguntas de esclarecimento aparecerem **antes** da implementação, e não depois de erros.


- **Commit e push a cada entrega concluída** — nunca deixe mudanças relevantes sem versionar.
- **Build antes de commitar** (`npm run build`) para garantir que nenhum erro de compilação vai para produção.
- Quando uma tarefa depende de ação manual do usuário em serviços externos (Supabase, GitHub, DNS), forneça o **link direto de cada ferramenta** e a instrução exata do que deve ser feito — não peça para o usuário "ir lá e configurar".
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
- Criadas em `supabase/functions/<nome>/index.ts` e versionadas no repositório.
- **Deploy via Dashboard** (modelo padrão): https://supabase.com/dashboard/project/nfgexlsfmyfypueslzxo/functions
  1. Clicar em "Create a new function" (ou editar a existente)
  2. Usar o nome exato da pasta (ex: `appointments`)
  3. Colar o conteúdo do `index.ts` correspondente
  4. Clicar em "Deploy function"
- As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente no ambiente — não precisam ser configuradas manualmente.
- Variáveis externas (ex: `RESEND_API_KEY`) configurar em: https://supabase.com/dashboard/project/nfgexlsfmyfypueslzxo/functions (aba "Secrets")
- Sempre validar inputs **antes** de consumir APIs pagas (Resend, Asaas, etc.) — nunca consumir crédito para depois falhar em validação.

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
