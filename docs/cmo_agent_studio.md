# CMO Agent para o Studio — Inlevor

## 1. Visão geral

O CMO Agent é a camada estratégica do Studio da Inlevor.
Ele não é um gerador solto de posts. Ele organiza contexto, perfil da empresa, portfólio, mercado e agenda editorial para chegar em briefs e rascunhos com mais precisão.

Objetivo do produto:

> transformar dados, portfólio, mercado e estratégia em execução de marketing imobiliário.

### O que o CMO precisa fazer

- entender a empresa;
- entender o portfólio atual;
- consultar a base de conhecimento;
- buscar sinais externos na web;
- cruzar mercado, produto e posicionamento;
- sugerir campanhas e calendário;
- gerar briefs;
- gerar rascunhos;
- revisar aderência à marca;
- aprender com performance.

---

## 2. Fluxo atual do Studio

O fluxo da interface foi desenhado para ser linear:

```txt
Hub CMO
→ Perfil da empresa
→ Workspace completo
→ Pautas e calendário
→ Briefs
→ Rascunho
→ Editor final
```

### Rotas principais

- `/dashboard/studio/cmo`
- `/dashboard/studio/cmo/company-profile`
- `/dashboard/studio/cmo/workspace`
- `/dashboard/studio/cmo/portfolio`
- `/dashboard/studio/cmo/briefs`
- `/dashboard/studio/cmo/draft`

### Princípio de UX

- mostrar primeiro um resumo curto;
- deixar edição detalhada em blocos colapsáveis;
- evitar textos longos ocupando a tela inteira;
- manter os botões de ação claros e sequenciais;
- separar visualmente leitura, edição e execução.

---

## 3. Hub do CMO

O hub em `/dashboard/studio/cmo` é a porta de entrada.
Ele deve responder rapidamente:

- onde começar;
- qual é o fluxo recomendado;
- quais atalhos existem;
- qual rota leva a cada etapa.

### Entradas principais

- `Workspace completo`
- `Perfil da empresa`
- `Portfólio`
- `Briefs`

### Fluxo recomendado

1. configurar o perfil da empresa;
2. abrir o workspace;
3. analisar portfólio e mercado;
4. gerar estratégia;
5. gerar calendário e briefs;
6. abrir o rascunho;
7. seguir para o editor final.

---

## 4. Perfil da empresa

O `Company Profile` é a base do sistema.
Ele precisa ser configurável por `orgId` e nunca hardcoded.

### O que esse perfil responde

- quem é a empresa;
- o que ela vende;
- para quem ela vende;
- como deve se comunicar;
- o que deve evitar;
- quais regiões atende;
- quais objetivos comerciais possui.

### Campos principais

- nome;
- posicionamento;
- proposta de valor;
- público-alvo;
- tom preferido;
- objetivos comerciais;
- segmentos de atuação;
- regiões atendidas;
- assuntos proibidos;
- assuntos preferenciais;
- canais;
- estilo de comunicação.

### UI recomendada

O layout atual segue esta lógica:

- resumo dos campos principais em cards;
- edição separada em um bloco `Editar perfil`;
- campos avançados em bloco colapsável;
- ações no rodapé.

Isso evita “deriorização” visual quando o conteúdo cresce.

### Exemplo conceitual

```json
{
  "name": "Inlevor",
  "positioning": "Plataforma de curadoria e inteligência imobiliária especializada em empreendimentos residenciais de alto padrão em São Paulo",
  "valueProposition": "Apoiar decisões de compra com curadoria, contexto e atendimento consultivo",
  "preferredTone": "sofisticado, consultivo, objetivo e comercialmente elegante",
  "audience": [
    "famílias de alta renda",
    "compradores de imóveis premium",
    "investidores patrimoniais",
    "clientes em upgrade residencial"
  ],
  "marketSegment": [
    "alto padrão",
    "empreendimentos residenciais",
    "lançamentos imobiliários"
  ],
  "regions": [
    "Vila Mariana",
    "Moema",
    "Perdizes",
    "Ibirapuera",
    "Aclimação",
    "Vila Nova Conceição",
    "Brooklin",
    "Pinheiros"
  ],
  "forbiddenTopics": [
    "studios",
    "HIS",
    "HMP",
    "promessa de valorização garantida"
  ],
  "preferredTopics": [
    "upgrade residencial",
    "arquitetura",
    "localização",
    "lifestyle premium"
  ],
  "commercialGoals": [
    "gerar leads qualificados",
    "aumentar agendamentos",
    "fortalecer autoridade",
    "aumentar conversão"
  ],
  "channels": [
    "blog",
    "instagram",
    "newsletter",
    "whatsapp"
  ]
}
```

---

## 5. Fontes de conhecimento

O CMO precisa cruzar cinco camadas:

```txt
Perfil da empresa
+ portfólio estruturado
+ KB / Qdrant
+ radar de mercado
+ estratégia editorial
```

### Regra de origem

- `Company Profile`: define posicionamento e guardrails;
- `Product Inventory`: define os produtos ativos;
- `KB / Qdrant`: complementa com contexto profundo;
- `Market Radar`: traz sinais externos;
- `Studio`: transforma tudo em execução.

---

## 6. Product Inventory

O inventário é a fonte estruturada dos produtos.
Ele não deve vir do Qdrant.

### O que o inventário responde

- quais produtos existem;
- quais estão ativos;
- qual bairro;
- qual cidade;
- qual construtora;
- qual slug;
- qual status;
- qual prioridade comercial;
- quais materiais estão vinculados.

### Exemplo

```ts
export type ProductInventoryItem = {
  id: string;
  orgId: string;
  name: string;
  city: string;
  neighborhood: string;
  status: "active" | "inactive" | "draft" | "archived";
  segment?: string;
  builder?: string;
  priority?: "low" | "medium" | "high";
  slug?: string;
  kbScopeId?: string;
  qdrantScopeId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
```

---

## 7. KB / Qdrant

O Qdrant deve ser usado como base semântica.
Ele complementa o inventário.

### Tipos de material

- PDFs;
- books;
- materiais comerciais;
- descrições;
- conceitos;
- diferenciais;
- arquitetura;
- lazer;
- localização;
- memorial;
- argumentos de venda;
- fatos extraídos.

### O que não fazer

Não usar Qdrant como única fonte de verdade para produtos ativos.

---

## 8. Market Radar

O radar de mercado busca oportunidades externas.
Ele precisa conversar com o perfil da empresa e com o portfólio atual.

### Exemplos de busca

- mercado imobiliário de alto padrão em São Paulo;
- tendências de moradia premium;
- bairros nobres de São Paulo;
- arquitetura residencial de alto padrão;
- construtoras premium;
- tecnologia no mercado imobiliário;
- inteligência artificial no setor imobiliário;
- mobilidade urbana;
- branded residences;
- wellness residencial.

### Tipos de oportunidade

```ts
export type OpportunityScope =
  | "produto"
  | "bairro"
  | "mercado"
  | "arquitetura"
  | "construtoras"
  | "lifestyle"
  | "tecnologia"
  | "investimento"
  | "institucional"
  | "educativo";
```

---

## 9. Portfolio DNA

`Portfolio DNA` é a leitura estratégica do portfólio atual.
Ele nasce do cruzamento entre inventário, KB e perfil da empresa.

### Perguntas que responde

- qual o perfil dos produtos hoje;
- quais bairros dominamos;
- quais padrões aparecem;
- qual público eles atendem;
- quais ângulos de comunicação fazem sentido;
- quais lacunas existem.

### Exemplo

```json
{
  "segment": "alto padrão residencial",
  "mainCities": ["São Paulo"],
  "mainNeighborhoods": ["Vila Mariana", "Moema", "Perdizes", "Ibirapuera", "Aclimação"],
  "commonAttributes": [
    "bairros consolidados",
    "projetos familiares",
    "arquitetura autoral",
    "lazer completo",
    "construtoras reconhecidas",
    "proximidade de serviços"
  ],
  "audienceFit": [
    "famílias em upgrade residencial",
    "compradores de alto padrão",
    "clientes que valorizam localização"
  ],
  "excludedSegments": ["studios", "HIS", "HMP", "compactos populares"]
}
```

---

## 10. Estratégia editorial

O Studio deve transformar diagnóstico em decisão editorial.

### Saída esperada

- plano CMO;
- campanhas;
- calendário;
- pautas;
- briefs;
- rascunhos.

### Distribuição sugerida

```txt
40% território / bairro
30% produto / empreendimento
20% autoridade
10% institucional / educativo
```

Essa distribuição deve ser configurável por empresa.

---

## 11. Revisão e briefs

O fluxo de briefs foi desenhado para ser curto:

```txt
brief → rascunho → editor final
```

### Boas práticas de UI

- mostrar resumo do brief antes da edição;
- usar blocos colapsáveis para campos longos;
- separar origem do brief;
- limitar a quantidade de cards exibidos de uma vez;
- manter a ação principal visível;
- deixar `Voltar ao brief` e `Abrir no editor final` claros.

### Caminho atual

- revisar briefs em `/dashboard/studio/cmo/briefs`;
- editar o brief em `/dashboard/studio/cmo/briefs/[briefId]/edit`;
- gerar rascunho em `/dashboard/studio/cmo/draft`;
- abrir o editor final a partir do rascunho.

---

## 12. Arquitetura por domínio

### `blog-inlevor`

Deve concentrar:

- interface do Studio;
- configuração da empresa;
- agenda editorial;
- briefs;
- rascunhos;
- revisão humana;
- performance.

### `api_inlevor`

Deve concentrar:

- retrieval;
- Qdrant;
- facts;
- orquestração de contexto;
- integração com web, se aplicável.

### `inlevor`

Deve ser a fonte estruturada de:

- produtos;
- empreendimentos;
- bairros;
- construtoras;
- slugs;
- status;
- prioridades comerciais.

---

## 13. Coleções sugeridas

Todas as coleções abaixo devem conter `orgId`.

- `studio_company_profiles`
- `studio_portfolio_snapshots`
- `studio_market_opportunities`
- `studio_cmo_strategies`
- `studio_cmo_campaigns`
- `studio_cmo_briefs`
- `studio_cmo_reviews`
- `studio_cmo_performance_notes`

---

## 14. API routes sugeridas

```txt
app/api/studio/cmo/company-profile/route.ts
app/api/studio/cmo/portfolio/analyze/route.ts
app/api/studio/cmo/opportunities/search/route.ts
app/api/studio/cmo/strategy/generate/route.ts
app/api/studio/cmo/campaigns/generate/route.ts
app/api/studio/cmo/calendar/generate/route.ts
app/api/studio/cmo/briefs/generate/route.ts
app/api/studio/cmo/review/route.ts
```

---

## 15. Critérios de produto

O CMO deve evitar dois erros:

1. virar um catálogo de imóveis;
2. virar uma interface extensa e pouco legível.

### Regras práticas

- resumos curtos primeiro;
- edição avançada só quando necessário;
- controles de ação claros;
- copiar o tom da empresa;
- manter consistência entre perfil, estratégia e briefs;
- bloquear etapas quando o contexto ainda é insuficiente.

### Resultado esperado

O usuário precisa sentir que está operando um sistema editorial inteligente, e não preenchendo um formulário genérico.

