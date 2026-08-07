# Plano — Corrigir bloqueio constante do app (401 em todas as telas)

## 1. Diagnóstico (concluído)

### O que foi verificado

| Verificação | Resultado |
|---|---|
| Containers `tebarrot-api` / `tebarrot-db` | Up, saudáveis |
| `GET /api/health` (local e via túnel) | `{"status":"ok","db":"ok"}` |
| Cloudflare Tunnel → `estoque.puratienda.store` | Funcionando |
| `POST /api/auth/login` via túnel | **200 OK**, retorna JWT válido |
| `GET /api/armazens` **com** token | **200 OK**, retorna dados |
| `GET /api/produtos` **com** token | **200 OK**, retorna dados |
| Rate limiting / WAF / bloqueio de IP | **Não existe** — nenhum `429`, nenhum middleware de rate limit no código |
| `CLOUDFLARE_ACCESS_ENABLED` | `false` → middleware do Cloudflare Access está desativado |

### Conclusão

**Não há bloqueio de rede, firewall, WAF ou rate limiting.** A infraestrutura está 100% funcional.

O que os logs mostram durante o teste do usuário (todas as requisições do `Expo/CFNetwork/Darwin`):

```
"GET /api/produtos"          401 39
"GET /api/armazens"          401 39
"GET /api/produtos/saldos"   401 39
"GET /api/movimentacoes"     401 39
"POST /api/armazens"         401 39
```

E, de forma decisiva: **não existe um único `POST /api/auth/login` vindo do app** nos logs. Os únicos logins com sucesso (`200`) foram os testes via PowerShell.

**Causa raiz:** o app abriu direto nas telas internas usando um token do `AsyncStorage` que está **expirado ou inválido**, e o `401` resultante **não é tratado em lugar nenhum**.

O mecanismo exato, em `mobile-app/src/App.js:29-30`:

```js
const { token } = await api.obterSessao();
setRotaInicial(token ? 'Armazens' : 'Login');
```

A checagem é apenas *"existe uma string salva?"* — nunca *"esse token ainda é válido?"*. Como `JWT_EXPIRES_IN=12h`, qualquer sessão com mais de 12 horas produz exatamente este comportamento:

1. Token expirado continua salvo no `AsyncStorage`.
2. O app pula o Login e vai para `Armazens`.
3. O interceptor (`api.js:50-56`) anexa o token morto em toda requisição.
4. A API responde `401` em tudo.
5. O interceptor de resposta (`api.js:58-68`) **trata `403` mas ignora `401`** → nunca limpa a sessão nem redireciona.
6. O usuário fica preso: não consegue fazer nada e não recebe a tela de login. **É o "bloqueio constante" relatado.**

Agrava o problema: `syncQueue` roda em background e também falha silenciosamente contra o mesmo token morto.

---

## 2. Solução proposta

Três correções pequenas e cirúrgicas, todas no app. **Nenhuma mudança na API, no Docker ou na rede** — o backend já está correto.

### Correção A — Interceptor que trata 401 (essencial)

`mobile-app/src/services/api.js`

Adicionar tratamento de `401` no interceptor de resposta: ao receber `401`, limpar a sessão do `AsyncStorage` e notificar o app para voltar ao Login.

```js
// callback registrado pelo App.js para reagir à expiração
let onSessaoExpirada = null;
function registrarOnSessaoExpirada(cb) { onSessaoExpirada = cb; }

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // Sessão expirada/inválida: limpa e devolve o usuário ao Login.
    // Exceção: falha no próprio login é credencial errada, não expiração.
    const ehRotaLogin = error.config?.url?.includes('/auth/login');
    if (status === 401 && !ehRotaLogin) {
      await encerrarSessao();
      if (onSessaoExpirada) onSessaoExpirada();
    }

    if (status === 403) {
      error.message = 'Apenas gestores podem alterar o catálogo';
    } else if (error.response?.data?.erro) {
      // NOTA: a API responde { erro }, mas o código lê { error } — bug de
      // chave que faz toda mensagem do servidor ser descartada. Corrigir junto.
      error.message = error.response.data.erro;
    }
    return Promise.reject(error);
  }
);
```

> Observação: aproveitar para corrigir o bug de chave `error.response.data.error` → `.erro`. A API sempre devolve `{ erro: ... }` (ver `authController.js`, `errorHandler.js`), então hoje **nenhuma** mensagem de erro do servidor chega ao usuário.

### Correção B — Validar o token na inicialização (essencial)

`mobile-app/src/App.js`

Em vez de apenas checar se a string existe, verificar se ainda é válida antes de decidir a rota inicial. Duas opções:

- **B1 (mais simples):** decodificar o `exp` do JWT localmente e comparar com o horário atual. Sem chamada de rede, instantâneo.
- **B2 (mais robusto):** fazer uma chamada leve autenticada (ex.: `GET /api/armazens`) e cair para o Login se retornar `401`. Confirma também que o backend aceita o token, mas custa uma requisição no boot.

Recomendo **B1** como padrão (rápido e offline-friendly), com a Correção A cobrindo qualquer caso residual em runtime.

```js
const { token } = await api.obterSessao();
const valido = token && !api.tokenExpirado(token);
if (token && !valido) await api.encerrarSessao();
setRotaInicial(valido ? 'Armazens' : 'Login');
```

Também registrar aqui o callback da Correção A, usando uma `navigationRef` para redirecionar ao Login de qualquer tela.

### Correção C — Não sincronizar sem sessão válida (recomendado)

`mobile-app/src/services/syncQueue.js`

O `flushQueue` hoje trata `401` como "erro definitivo 4xx" e **marca os itens da fila como erro**, mesmo sendo apenas sessão expirada — risco de sujar/descartar contagens legítimas que o operador fez offline.

Ajustar para: se o status for `401`, **interromper o lote sem marcar erro** e preservar os itens para depois do próximo login.

```js
const status = err?.response?.status;
if (status === 401) break;             // sessão expirada: preserva a fila intacta
const erroDefinitivo = status >= 400 && status < 500;
if (!erroDefinitivo) break;
```

---

## 3. Ação imediata (destrava o teste agora, sem alterar código)

No app: **Mais → Sair** (`MaisScreen`, que já chama `encerrarSessao()`) e fazer login de novo.

Credenciais válidas confirmadas no banco:

| Usuário | Senha | Papel |
|---|---|---|
| `Artur` | `9241` | admin |
| `operador1` | `1234` | operador |

Se a tela "Mais" não estiver acessível por causa dos 401, reinstalar/limpar os dados do Expo Go também resolve (limpa o `AsyncStorage`).

---

## 4. Ordem de execução sugerida

1. **Ação imediata** — logout + login para destravar o teste manual agora.
2. **Correção A** — interceptor 401 + fix da chave `.erro` (resolve a causa raiz em runtime).
3. **Correção B** — validação do token no boot (evita entrar em tela protegida com token morto).
4. **Correção C** — proteger a fila offline do 401.
5. **Reteste** — logar, deixar expirar (ou reduzir `JWT_EXPIRES_IN` temporariamente para `1m` para forçar o cenário) e confirmar que o app retorna ao Login em vez de travar.

---

## 5. Observações de segurança (fora do escopo do bug, registrar como dívida)

Não bloqueiam este plano, mas convém tratar depois:

- `JWT_SECRET=troque_este_segredo_por_uma_string_longa_e_aleatoria` — segredo padrão de exemplo em uso; trocar antes de qualquer exposição real.
- Senhas armazenadas em **texto plano** no Postgres (decisão explícita documentada no `authController.js`, mas vale reavaliar — `bcrypt` é barato de adicionar).
- Dois usuários com `username` e `senha` **vazios** na tabela (`Administrador`, `Operador Teste`) — não conseguem logar (o controller exige ambos os campos), mas é sujeira que convém limpar.
- A API está publicamente exposta via túnel com `CLOUDFLARE_ACCESS_ENABLED=false`, ou seja, sem a camada de proteção na borda. Considerar reativar o Cloudflare Access em produção.
- Não há rate limiting em `/api/auth/login` — endpoint público sujeito a brute force. Um `express-rate-limit` só nessa rota seria prudente.

---

## 6. Resposta direta à pergunta "como fazer o app receber requisições sem ser bloqueado"

Não é preciso liberar nada na rede: **nada está bloqueando.** O que existe é uma sessão expirada que o app não sabe detectar nem renovar. O caminho é fazer o app **reconhecer o 401 e reautenticar**, que é exatamente o que as Correções A e B implementam. Com `JWT_EXPIRES_IN=12h`, sem essas correções o problema volta a acontecer todo dia.
