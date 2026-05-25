# CMO Agent para o Studio — Inlevor

## 1. Visão geral

Este documento descreve a ideia, a arquitetura e o plano de implementação de um **CMO Agent** dentro do Studio da plataforma Inlevor.

O objetivo não é criar apenas um gerador de posts com IA. A proposta é criar uma camada estratégica capaz de:

- entender a empresa;
- entender o portfólio atual de empreendimentos;
- consultar a base de conhecimento interna;
- buscar oportunidades externas na web;
- cruzar mercado, produtos e posicionamento;
- sugerir campanhas;
- criar calendário editorial;
- gerar briefs;
- gerar conteúdos;
- revisar aderência à marca;
- aprender com performance.

A definição central do produto é:

> O CMO Agent da Inlevor deve transformar dados, portfólio, mercado e estratégia em execução de marketing imobiliário.

---

## 2. Conceito principal

O CMO Agent não deve ser apenas um botão mágico de geração de conteúdo.

O botão pode existir na interface, mas ele deve acionar uma sequência de capacidades estratégicas.

Exemplo de botões possíveis dentro do Studio:

```txt
[ Analisar empresa ]
[ Analisar portfólio atual ]
[ Buscar oportunidades na web ]
[ Gerar plano CMO do mês ]
[ Gerar calendário editorial ]
[ Gerar briefs ]
[ Revisar conteúdos ]
```

No MVP, pode começar com um botão principal:

```txt
[ Gerar Plano CMO do Mês ]
```

Por trás desse botão, o sistema deve:

```txt
1. Carregar o perfil da empresa
2. Carregar os produtos ativos
3. Consultar a base de conhecimento/Qdrant
4. Consultar materiais internos e facts
5. Buscar oportunidades externas na web
6. Cruzar mercado + portfólio + posicionamento
7. Sugerir campanhas
8. Sugerir calendário
9. Gerar briefs
10. Revisar aderência às regras da marca
```

---

## 3. Princípio importante: produto SaaS configurável

Tudo deve ser pensado para que, no futuro, o produto possa ser vendido para outras empresas.

Portanto, nada específico da Inlevor deve ficar hardcoded no código.

Exemplos de informações que **não devem ficar fixas no código**:

```txt
Inlevor
Vila Mariana
Moema
Perdizes
alto padrão
não mencionar studios
não mencionar HIS/HMP
tom sofisticado
São Paulo
```

Essas informações devem ser configuráveis por UI e salvas no banco, sempre vinculadas a um `orgId`.

Cada empresa deve poder configurar:

```txt
nome
posicionamento
público-alvo
segmentos de atuação
regiões atendidas
tom de voz
proposta de valor
assuntos proibidos
assuntos preferenciais
objetivos comerciais
canais de marketing
prioridades comerciais
```

---

## 4. Company Profile

### 4.1. O que é

O `Company Profile` é o perfil estratégico da empresa.

Ele responde:

```txt
Quem é a empresa?
O que ela vende?
Para quem ela vende?
Como ela deve se comunicar?
Quais assuntos deve evitar?
Quais regiões atende?
Quais objetivos comerciais possui?
```

Esse perfil deve ser usado por todos os agentes e funções do CMO.

---

### 4.2. Exemplo para a Inlevor

```json
{
  "name": "Inlevor",
  "positioning": "Curadoria de empreendimentos residenciais de alto padrão em São Paulo",
  "audience": [
    "famílias de alta renda",
    "compradores de imóveis premium",
    "investidores patrimoniais",
    "clientes buscando upgrade residencial"
  ],
  "marketSegment": [
    "alto padrão",
    "empreendimentos residenciais",
    "lançamentos imobiliários",
    "bairros nobres de São Paulo"
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
    "promessa de valorização garantida",
    "descrição repetitiva de plantas",
    "linguagem popular demais"
  ],
  "preferredTone": "sofisticado, consultivo, objetivo e comercialmente elegante",
  "valueProposition": "Selecionar e apresentar os melhores empreendimentos de alto padrão para clientes que buscam localização, qualidade, arquitetura, lifestyle e segurança na decisão de compra."
}
```

---

### 4.3. UI recomendada

Criar tela:

```txt
Studio > CMO > Perfil da Empresa
```

Campos sugeridos:

```txt
Nome da empresa
Posicionamento
Proposta de valor
Público-alvo
Segmentos de atuação
Regiões atendidas
Tom de voz
Estilo de comunicação
Assuntos proibidos
Assuntos preferenciais
Objetivos comerciais
Canais de marketing
```

Exemplo visual:

```txt
Perfil da Empresa

Nome:
[ Inlevor ]

Posicionamento:
[ Curadoria de empreendimentos residenciais de alto padrão em São Paulo ]

Público-alvo:
[ famílias de alta renda ]
[ compradores de imóveis premium ]
[ investidores patrimoniais ]

Regiões prioritárias:
[ Vila Mariana ]
[ Moema ]
[ Perdizes ]
[ Ibirapuera ]

Assuntos proibidos:
[ studios ]
[ HIS ]
[ HMP ]
[ promessa de valorização garantida ]

Tom de voz:
[ sofisticado, consultivo, objetivo e comercialmente elegante ]

Proposta de valor:
[ Selecionar e apresentar os melhores empreendimentos... ]

[ Salvar Perfil ]
```

---

### 4.4. Tipo sugerido

```ts
export type CompanyProfile = {
  id: string;
  orgId: string;

  name: string;
  positioning: string;
  valueProposition: string;

  audience: string[];
  marketSegment: string[];
  regions: string[];

  preferredTone: string;
  contentStyle: string[];

  forbiddenTopics: string[];
  preferredTopics: string[];

  commercialGoals: string[];
  channels?: string[];

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 5. Fontes de conhecimento do CMO Agent

O CMO Agent deve cruzar quatro mundos:

```txt
Quem somos
+
O que vendemos
+
O que o mercado está falando
+
O que devemos comunicar agora
```

Tecnicamente, isso corresponde a:

```txt
Company Profile
+
Product Inventory
+
Qdrant / KB
+
Market Radar
+
Editorial Strategy
```

---

## 6. Product Inventory

### 6.1. Conceito

O `Product Inventory` é a fonte estruturada dos produtos que a empresa tem disponíveis hoje.

Para a Inlevor, isso deve vir do sistema já cadastrado, não diretamente do Qdrant.

O sistema estruturado responde:

```txt
Quais produtos existem hoje?
Quais estão ativos?
Qual bairro?
Qual cidade?
Qual construtora?
Qual slug?
Qual status?
Qual prioridade comercial?
Qual categoria?
Quais imagens?
Quais descrições?
```

---

### 6.2. Diferença entre sistema e Qdrant

Regra fundamental:

```txt
Produtos disponíveis = banco estruturado
Conhecimento profundo = Qdrant
Oportunidades externas = web
Estratégia = CMO Agent
Execução = Studio
```

O CMO Agent não deve perguntar ao Qdrant:

```txt
Quais produtos temos?
```

Ele deve perguntar ao banco estruturado:

```txt
Quais produtos estão ativos?
```

Depois deve consultar o Qdrant para entender:

```txt
O que sabemos profundamente sobre esses produtos?
```

---

### 6.3. Exemplo de item de inventário

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

### 6.4. Exemplo prático

Produto no sistema:

```json
{
  "id": "the-palace-royal",
  "name": "The Palace Royal",
  "city": "São Paulo",
  "neighborhood": "Vila Mariana",
  "status": "active",
  "segment": "alto padrão",
  "builder": "Setin",
  "priority": "high",
  "slug": "/sao-paulo/vila-mariana/the-palace-royal",
  "kbScopeId": "project__the-palace-royal"
}
```

O sistema sabe:

```txt
Esse projeto existe.
Está ativo.
Está na Vila Mariana.
É prioridade alta.
```

O Qdrant deve responder:

```txt
Qual é o conceito do projeto?
Quais diferenciais aparecem no book?
Qual narrativa comercial pode ser usada?
Qual estilo arquitetônico?
Qual lifestyle?
Quais pontos de localização podem ser explorados?
```

---

## 7. Qdrant / KB

O Qdrant deve ser usado como base de conhecimento semântica.

Ele pode conter:

```txt
PDFs
books
materiais comerciais
descrições
conceitos
diferenciais
arquitetura
lazer
localização
memorial
argumentos de venda
facts extraídos
```

O Qdrant não deve ser a única fonte de verdade sobre produtos ativos.

Ele deve complementar a fonte estruturada.

---

## 8. Busca externa / Web Radar

### 8.1. Conceito

O `Market Radar` ou `Web Radar` é o módulo responsável por buscar oportunidades externas.

Ele deve pesquisar temas relacionados ao perfil da empresa, ao portfólio atual e ao mercado.

Exemplos de buscas:

```txt
mercado imobiliário de alto padrão em São Paulo
tendências de moradia premium
bairros nobres de São Paulo
arquitetura residencial de alto padrão
construtoras premium em São Paulo
tecnologia no mercado imobiliário
blockchain no mercado imobiliário
inteligência artificial no setor imobiliário
mobilidade urbana em bairros consolidados
branded residences
wellness residencial
```

---

### 8.2. Tipos de oportunidade

O radar deve classificar oportunidades por tipo:

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

### 8.3. Exemplo de oportunidade

```json
{
  "title": "Bairros completos como diferencial no alto padrão",
  "source": "web",
  "scope": "bairro",
  "fitScore": 92,
  "relatedRegions": ["Vila Mariana", "Moema", "Perdizes"],
  "suggestedContents": [
    "Por que bairros consolidados seguem fortes no alto padrão?",
    "O novo morar das famílias em São Paulo",
    "Como localização, serviços e mobilidade impactam a decisão de compra"
  ]
}
```

---

## 9. Conteúdo fora do escopo direto dos produtos

O CMO Agent deve poder sugerir conteúdos que não falam diretamente de um empreendimento específico.

Isso é importante para construir autoridade.

Se o Studio falar apenas de produto, vira catálogo.

Se o Studio fala de produto, bairro, arquitetura, mercado, tecnologia, construtoras, comportamento e lifestyle, vira uma plataforma de autoridade.

Tipos de conteúdo possíveis:

```txt
produto
bairro
mercado
arquitetura
construtoras
lifestyle
tecnologia
investimento patrimonial
educativo
institucional
```

Exemplos:

```json
{
  "title": "Como a arquitetura autoral influencia o alto padrão em São Paulo",
  "scope": "arquitetura",
  "objective": "autoridade",
  "relatedProjects": ["Villa Versace Ibirapuera", "The Palace Royal"],
  "channel": "blog"
}
```

```json
{
  "title": "Blockchain no mercado imobiliário: o que pode mudar na compra de imóveis?",
  "scope": "tecnologia",
  "objective": "autoridade institucional",
  "relatedProjects": [],
  "channel": "blog"
}
```

---

## 10. Content Fit Score

Para evitar que o agente fuja demais do negócio, cada sugestão deve receber um score de aderência.

Exemplo:

```txt
Tema: arquitetura residencial de alto padrão
Aderência: 95/100
Motivo: conecta diretamente com o público premium e com os produtos da empresa.
```

```txt
Tema: blockchain no mercado imobiliário
Aderência: 65/100
Motivo: bom para autoridade e inovação, mas não deve dominar o calendário comercial.
```

```txt
Tema: decoração popular para apartamentos pequenos
Aderência: 20/100
Motivo: desalinhado com o posicionamento premium e com o portfólio da empresa.
```

Tipo sugerido:

```ts
export type ContentFitScore = {
  score: number;
  reason: string;
  risks: string[];
  recommendedUse: "primary" | "secondary" | "avoid";
};
```

---

## 11. Portfolio DNA

### 11.1. Conceito

O `Portfolio DNA` é uma leitura estratégica do portfólio atual da empresa.

Ele deve ser gerado a partir de:

```txt
produtos ativos do sistema
+
materiais no Qdrant
+
Company Profile
```

O objetivo é responder:

```txt
Qual é o perfil dos produtos que temos hoje?
Quais bairros dominamos?
Quais padrões aparecem nos empreendimentos?
Qual público eles atendem?
Quais ângulos de comunicação fazem sentido?
Quais lacunas existem?
```

---

### 11.2. Exemplo de Portfolio DNA

```json
{
  "segment": "alto padrão residencial",
  "mainCities": ["São Paulo"],
  "mainNeighborhoods": [
    "Vila Mariana",
    "Moema",
    "Perdizes",
    "Ibirapuera",
    "Aclimação"
  ],
  "commonAttributes": [
    "bairros consolidados",
    "projetos familiares",
    "arquitetura autoral",
    "lazer completo",
    "construtoras reconhecidas",
    "proximidade de serviços",
    "lifestyle urbano premium"
  ],
  "audienceFit": [
    "famílias em upgrade residencial",
    "compradores de alto padrão",
    "clientes que valorizam localização",
    "clientes que buscam segurança na decisão de compra"
  ],
  "excludedSegments": ["studios", "HIS", "HMP", "compactos populares"]
}
```

---

### 11.3. Tipo sugerido

```ts
export type PortfolioSnapshot = {
  id: string;
  orgId: string;

  generatedAt: Date;

  activeProductsCount: number;
  mainCities: string[];
  mainNeighborhoods: string[];
  mainSegments: string[];
  commonAttributes: string[];
  audienceFit: string[];
  excludedSegments: string[];
  strategicSummary: string;

  relatedProductIds: string[];

  createdAt: Date;
};
```

---

## 12. Distribuição editorial sugerida

Para a Inlevor, uma distribuição inicial recomendada seria:

```txt
40% conteúdo de território/bairro
30% conteúdo de produto/empreendimento
20% conteúdo de autoridade
10% conteúdo institucional/educativo
```

Essa distribuição deve ser configurável por empresa no futuro.

---

### 12.1. Conteúdo de território

Exemplos:

```txt
Vila Mariana
Moema
Perdizes
Ibirapuera
Aclimação
Vila Nova Conceição
```

Objetivo:

```txt
Atrair clientes que ainda estão escolhendo região.
```

---

### 12.2. Conteúdo de produto

Exemplos:

```txt
empreendimentos ativos
lançamentos
curadorias por bairro
projetos prioritários
```

Objetivo:

```txt
Gerar lead e intenção comercial.
```

---

### 12.3. Conteúdo de autoridade

Exemplos:

```txt
arquitetura
construtoras
mercado imobiliário
tecnologia
blockchain
IA no setor imobiliário
lifestyle
urbanismo
```

Objetivo:

```txt
Fortalecer marca e confiança.
```

---

### 12.4. Conteúdo institucional

Exemplos:

```txt
curadoria Inlevor
processo de escolha
atendimento
tecnologia aplicada à compra
segurança na decisão
```

Objetivo:

```txt
Explicar por que comprar com a empresa.
```

---

## 13. Arquitetura geral

```txt
Studio CMO
│
├── UI de Configuração
│   ├── Perfil da empresa
│   ├── Tom de voz
│   ├── Regras editoriais
│   ├── Canais
│   ├── Pilares
│   └── Objetivos comerciais
│
├── Product Inventory Connector
│   ├── produtos ativos
│   ├── bairros
│   ├── construtoras
│   ├── status
│   ├── prioridade comercial
│   └── slugs
│
├── KB / Qdrant Connector
│   ├── books
│   ├── PDFs
│   ├── descrições
│   ├── facts
│   ├── diferenciais
│   └── contexto profundo
│
├── Market Radar
│   ├── web
│   ├── tendências
│   ├── notícias
│   ├── bairros
│   ├── construtoras
│   ├── arquitetura
│   └── tecnologia
│
├── Strategy Engine
│   ├── diagnóstico
│   ├── oportunidades
│   ├── campanhas
│   ├── públicos
│   ├── canais
│   └── prioridades
│
├── Editorial Engine
│   ├── calendário
│   ├── pautas
│   ├── briefs
│   ├── CTAs
│   └── formatos
│
├── Content Engine
│   ├── blog
│   ├── Instagram
│   ├── reels
│   ├── stories
│   ├── newsletter
│   └── landing pages
│
└── Review & Performance Engine
    ├── guardrails
    ├── revisão de marca
    ├── qualidade
    ├── métricas
    └── aprendizado
```

---

## 14. Papéis dos projetos atuais

### 14.1. `inlevor`

Deve ser a fonte de:

```txt
produtos
empreendimentos
bairros
construtoras
slugs
status
prioridades comerciais
materiais vinculados ao empreendimento
```

É a fonte estruturada do inventário.

---

### 14.2. `api_inlevor`

Deve ser o cérebro técnico de conhecimento.

Responsável por:

```txt
retrieval
Qdrant
facts
orquestração de contexto
consulta semântica
integração com web/Tavily, se aplicável
```

Endpoints já esperados ou desejados:

```txt
/ai/retrieve
/ai/retrieve/orchestrated
/kb/retrieve
/kb/sources
/kb/projects/facts
/kb/qdrant
/kb/metrics
```

---

### 14.3. `blog-inlevor`

Deve ser o local do Studio e do CMO.

Responsável por:

```txt
interface do CMO
configurações
agenda editorial
campanhas
briefs
conteúdos
curadoria
métricas
aprovação humana
```

---

## 15. Novas telas sugeridas

Dentro do `blog-inlevor`:

```txt
/dashboard/studio/cmo
/dashboard/studio/cmo/company-profile
/dashboard/studio/cmo/portfolio
/dashboard/studio/cmo/opportunities
/dashboard/studio/cmo/campaigns
/dashboard/studio/cmo/calendar
/dashboard/studio/cmo/briefs
/dashboard/studio/cmo/performance
```

Menu sugerido:

```txt
Studio
├── CMO
├── Criar com IA
├── Agenda
├── Briefs
├── Biblioteca
├── Curadoria
├── KB Market
├── Métricas
└── Configurações
```

---

## 16. Coleções sugeridas no Firestore

```txt
studio_company_profiles
studio_portfolio_snapshots
studio_market_opportunities
studio_cmo_strategies
studio_cmo_campaigns
studio_cmo_briefs
studio_cmo_reviews
studio_cmo_performance_notes
```

Todas devem conter `orgId`.

---

### 16.1. `studio_company_profiles`

Guarda o perfil da empresa.

---

### 16.2. `studio_portfolio_snapshots`

Guarda uma leitura estratégica do portfólio em determinada data.

Exemplo:

```json
{
  "orgId": "inlevor",
  "generatedAt": "2026-05-21",
  "activeProductsCount": 42,
  "mainNeighborhoods": ["Vila Mariana", "Moema", "Perdizes"],
  "mainSegments": ["alto padrão", "famílias", "bairros consolidados"],
  "portfolioDNA": "A empresa possui forte presença em bairros consolidados de São Paulo..."
}
```

---

### 16.3. `studio_market_opportunities`

Guarda oportunidades encontradas na web ou na análise interna.

Exemplo:

```json
{
  "orgId": "inlevor",
  "title": "Bairros completos como diferencial no alto padrão",
  "source": "web",
  "scope": "bairro",
  "fitScore": 92,
  "relatedRegions": ["Vila Mariana", "Moema", "Perdizes"],
  "suggestedContents": [
    "Por que bairros consolidados seguem fortes no alto padrão?",
    "O novo morar das famílias em São Paulo"
  ]
}
```

---

### 16.4. `studio_cmo_strategies`

Guarda planos estratégicos mensais ou trimestrais.

```ts
export type CmoStrategy = {
  id: string;
  orgId: string;

  period: string;
  objective: string;
  diagnosis: string;
  marketContext: string;

  priorityAudiences: string[];
  priorityRegions: string[];
  priorityProjects: string[];
  contentPillars: string[];
  recommendedChannels: string[];
  risks: string[];

  status: "draft" | "approved" | "archived";

  createdAt: Date;
  updatedAt: Date;
};
```

---

### 16.5. `studio_cmo_campaigns`

Guarda campanhas.

```ts
export type CmoCampaign = {
  id: string;
  orgId: string;
  strategyId: string;

  name: string;
  objective: string;
  audience: string;
  region?: string;
  linkedProjectIds?: string[];
  channels: string[];

  startDate: Date;
  endDate: Date;

  status: "draft" | "active" | "completed" | "paused";

  createdAt: Date;
  updatedAt: Date;
};
```

---

### 16.6. `studio_cmo_briefs`

Guarda briefs.

```ts
export type CmoBrief = {
  id: string;
  orgId: string;
  campaignId?: string;
  scheduleItemId?: string;

  title: string;
  channel: string;
  objective: string;
  audience: string;
  angle: string;
  keyMessages: string[];
  cta: string;
  guardrails: string[];

  requiredSources: {
    kb: boolean;
    web: boolean;
    projectFacts: boolean;
  };

  status: "draft" | "approved" | "in_production" | "published";

  createdAt: Date;
  updatedAt: Date;
};
```

---

## 17. Endpoints/API routes sugeridas

Dentro do `blog-inlevor`:

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

### 17.1. `POST /api/studio/cmo/portfolio/analyze`

Responsável por gerar o `Portfolio DNA`.

Entrada:

```json
{
  "orgId": "inlevor"
}
```

Processo:

```txt
1. Buscar Company Profile
2. Buscar produtos ativos do sistema
3. Consultar Qdrant para contexto profundo dos produtos
4. Gerar resumo estratégico do portfólio
5. Salvar em studio_portfolio_snapshots
```

---

### 17.2. `POST /api/studio/cmo/opportunities/search`

Responsável por buscar oportunidades externas.

Entrada:

```json
{
  "orgId": "inlevor",
  "portfolioSnapshotId": "snapshot_123"
}
```

Processo:

```txt
1. Carregar Company Profile
2. Carregar Portfolio DNA
3. Montar queries de busca
4. Buscar na web
5. Classificar oportunidades por fitScore
6. Salvar em studio_market_opportunities
```

---

### 17.3. `POST /api/studio/cmo/strategy/generate`

Responsável por gerar o plano CMO.

Entrada:

```json
{
  "orgId": "inlevor",
  "period": "2026-06",
  "objective": "aumentar leads qualificados para alto padrão em São Paulo"
}
```

Saída esperada:

```json
{
  "strategyId": "strategy_123",
  "diagnosis": "...",
  "campaigns": [],
  "recommendedChannels": [],
  "risks": [],
  "nextActions": []
}
```

---

### 17.4. `POST /api/studio/cmo/calendar/generate`

Gera calendário a partir da estratégia.

Entrada:

```json
{
  "orgId": "inlevor",
  "strategyId": "strategy_123",
  "month": "2026-06"
}
```

Saída:

```json
{
  "items": [
    {
      "title": "Vila Mariana: o bairro completo para famílias exigentes",
      "channel": "blog",
      "theme": "bairros_nobres",
      "scheduledAt": "2026-06-03T09:00:00-03:00",
      "campaignId": "campaign_123"
    }
  ]
}
```

---

## 18. Funções/capabilities internas

Não criar apenas prompts soltos.

Criar funções claras:

```txt
analyzeCompanyProfile
loadProductInventory
analyzePortfolioDNA
findMarketOpportunities
scoreContentFit
generateCmoStrategy
generateCampaignPlan
generateEditorialCalendar
generateContentBrief
reviewContentGuardrails
analyzePerformance
```

---

## 19. Fluxo ideal de uso

```txt
1. Usuário entra no Studio > CMO

2. Configura o Perfil da Empresa
   - nome
   - posicionamento
   - público
   - regiões
   - tom de voz
   - assuntos proibidos
   - objetivos

3. Clica em [Atualizar leitura do portfólio]
   - sistema lê produtos ativos
   - consulta Qdrant
   - gera Portfolio DNA

4. Clica em [Buscar oportunidades]
   - sistema busca tendências na web
   - cruza com portfólio
   - classifica oportunidades

5. Clica em [Gerar Plano CMO]
   - sistema gera diagnóstico
   - campanhas
   - canais
   - calendário sugerido
   - riscos
   - próximos passos

6. Usuário aprova ou ajusta

7. Sistema gera calendário

8. Sistema gera briefs

9. Sistema gera conteúdos

10. Sistema revisa guardrails

11. Humano aprova publicação

12. Performance alimenta próximos ciclos
```

---

## 20. Guardrails importantes

Para a Inlevor, os guardrails iniciais devem incluir:

```txt
Não mencionar studios.
Não mencionar HIS/HMP.
Não prometer valorização garantida.
Não prometer rentabilidade.
Não repetir descrição técnica de planta quando já existir área específica no site.
Não focar em metragem, dormitórios e vagas no texto principal de marketing.
Não usar linguagem popular demais.
Não criar dados de mercado sem fonte.
Não tratar produto externo como produto interno.
Não misturar produtos ativos com produtos arquivados.
```

Esses guardrails devem ser configuráveis por empresa.

---

## 21. Multiempresa / SaaS

Tudo deve usar `orgId`.

Exemplos:

```ts
CompanyProfile.orgId;
ProductInventoryItem.orgId;
PortfolioSnapshot.orgId;
MarketOpportunity.orgId;
CmoStrategy.orgId;
CmoCampaign.orgId;
CmoBrief.orgId;
```

No Qdrant, os metadados também devem preservar isolamento:

```json
{
  "orgId": "inlevor",
  "scopeId": "project__the-palace-royal",
  "kbDomain": "project",
  "city": "sao-paulo",
  "neighborhood": "vila-mariana"
}
```

Cada empresa deve ter:

```txt
seu perfil
seus produtos
suas regras
seus canais
seu tom de voz
seu calendário
suas campanhas
seus materiais
seu escopo no Qdrant
```

---

## 22. MVP recomendado

### Entrega 1 — Company Profile via UI

Criar tela:

```txt
Studio > CMO > Perfil da Empresa
```

Campos:

```txt
nome
posicionamento
público-alvo
segmentos
regiões
tom de voz
proposta de valor
assuntos proibidos
assuntos preferenciais
objetivos comerciais
```

Essa entrega transforma o produto em configurável.

---

### Entrega 2 — Product Inventory Reader

Criar função que lê os produtos ativos do sistema.

Retorno esperado:

```json
[
  {
    "id": "projeto-x",
    "name": "Projeto X",
    "city": "São Paulo",
    "neighborhood": "Moema",
    "status": "active",
    "priority": "high",
    "builder": "Construtora Y",
    "slug": "/sao-paulo/moema/projeto-x"
  }
]
```

Essa função não precisa de IA.

---

### Entrega 3 — Portfolio DNA

Criar botão:

```txt
[ Analisar portfólio ]
```

Usa:

```txt
produtos ativos
+
Qdrant
+
Company Profile
```

Gera:

```txt
perfil do portfólio
bairros fortes
atributos comuns
públicos prováveis
ângulos de conteúdo
lacunas
prioridades
```

---

### Entrega 4 — Market Opportunity Radar

Criar botão:

```txt
[ Buscar oportunidades ]
```

Ele busca na web e classifica:

```txt
oportunidade
aderência ao portfólio
risco
tema
canal recomendado
projetos relacionados
```

---

### Entrega 5 — CMO Plan Generator

Criar botão:

```txt
[ Gerar Plano CMO ]
```

Ele junta:

```txt
Company Profile
Portfolio DNA
Market Opportunities
Editorial Settings
Product Inventory
Qdrant
```

E entrega:

```txt
diagnóstico
campanhas
calendário
briefs
recomendações
```

---

## 23. Exemplo de saída esperada do CMO

```txt
Diagnóstico CMO — Junho

A empresa possui forte aderência ao público de alto padrão em bairros consolidados de São Paulo. O portfólio atual concentra oportunidades em Vila Mariana, Moema e Perdizes, com projetos voltados a famílias que buscam upgrade residencial, melhor localização e experiência de moradia mais completa.

Oportunidade principal:
Criar uma campanha sobre “o novo morar em bairros completos”, conectando localização, arquitetura, rotina familiar, mobilidade, serviços e curadoria de empreendimentos premium.

Campanhas recomendadas:

1. Bairros completos para famílias exigentes
Objetivo: gerar autoridade e atrair leads em fase de escolha de região.
Canais: blog, Instagram e newsletter.
Projetos relacionados: empreendimentos ativos em Vila Mariana, Moema e Perdizes.

2. Arquitetura como diferencial no alto padrão
Objetivo: posicionar a empresa como curadora de projetos sofisticados.
Canais: blog e Instagram.
Projetos relacionados: empreendimentos com arquitetura, design ou paisagismo assinados.

3. Construtoras premium e a transformação dos bairros
Objetivo: gerar conteúdo de autoridade sobre mercado.
Canais: blog e LinkedIn.
Projetos relacionados: projetos de construtoras parceiras ou presentes no portfólio.

4. Tecnologia e confiança na compra de imóveis
Objetivo: fortalecer posicionamento institucional.
Canais: blog e newsletter.
Temas: IA, dados, curadoria, blockchain e jornada digital de compra.

Distribuição sugerida:
40% bairro/lifestyle
30% produto
20% autoridade
10% institucional
```

---

## 24. Prompt base do CMO Agent

Este prompt deve ser usado como base, mas idealmente encapsulado em funções/capabilities, não espalhado diretamente pela UI.

```txt
Você é o CMO estratégico de uma empresa do mercado imobiliário.

Seu papel não é apenas gerar posts. Seu papel é definir estratégia de marketing, priorizar campanhas e transformar conhecimento de mercado, portfólio e posicionamento em execução editorial.

Você deve considerar:
- perfil da empresa;
- público-alvo;
- portfólio atual;
- produtos ativos;
- materiais internos;
- contexto do mercado;
- oportunidades externas;
- tom de voz;
- assuntos proibidos;
- objetivos comerciais;
- canais disponíveis.

Você deve evitar:
- prometer valorização ou rentabilidade;
- inventar dados sem fonte;
- tratar produto externo como produto interno;
- recomendar temas desalinhados ao perfil da empresa;
- repetir detalhes técnicos de plantas quando isso já existir em outra seção;
- contrariar assuntos proibidos configurados no Company Profile.

Sua resposta deve conter:
1. diagnóstico;
2. oportunidades;
3. campanhas sugeridas;
4. canais recomendados;
5. calendário sugerido;
6. riscos;
7. próximos passos.
```

---

## 25. Observações para implementação com Codex

Ao implementar, seguir esta ordem:

```txt
1. Criar tipos em lib/cmo/types.ts
2. Criar camada de leitura/gravação Firestore em lib/cmo/repository.ts
3. Criar UI de Company Profile
4. Criar API route para salvar/buscar Company Profile
5. Criar Product Inventory Reader
6. Criar função analyzePortfolioDNA
7. Criar API route /portfolio/analyze
8. Criar função findMarketOpportunities
9. Criar API route /opportunities/search
10. Criar função generateCmoStrategy
11. Criar tela principal /dashboard/studio/cmo
```

Estrutura sugerida:

```txt
lib/
  cmo/
    types.ts
    repository.ts
    company-profile.ts
    product-inventory.ts
    portfolio-dna.ts
    market-radar.ts
    content-fit.ts
    strategy.ts
    campaigns.ts
    calendar.ts
    briefs.ts
    guardrails.ts
    prompts.ts

app/
  api/
    studio/
      cmo/
        company-profile/
          route.ts
        portfolio/
          analyze/
            route.ts
        opportunities/
          search/
            route.ts
        strategy/
          generate/
            route.ts
        calendar/
          generate/
            route.ts
        briefs/
          generate/
            route.ts
        review/
          route.ts

app/
  (admin)/
    dashboard/
      studio/
        cmo/
          page.tsx
          company-profile/
            page.tsx
          portfolio/
            page.tsx
          opportunities/
            page.tsx
          campaigns/
            page.tsx
          calendar/
            page.tsx
          briefs/
            page.tsx
```

---

## 26. Definição final

O CMO Agent deve ser entendido como:

> Um agente estratégico de marketing imobiliário que entende a empresa, lê o portfólio, consulta a base de conhecimento, busca oportunidades externas e transforma tudo em campanhas, calendário, briefs e conteúdo.

A Inlevor será a primeira empresa usando o produto.

Mas a arquitetura deve permitir que outras empresas configurem seus próprios perfis, produtos, regras e estratégias sem alterar código.
