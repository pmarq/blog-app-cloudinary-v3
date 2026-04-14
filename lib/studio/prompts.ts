// lib/studio/prompts.ts — Content format definitions + per-format system prompts

export type ContentFormat =
  | "blog"
  | "instagram_post"
  | "instagram_carousel"
  | "newsletter"
  | "image_prompt"
  | "twitter_thread"
  | "infographic"
  | "meta_seo"
  | "property_description"
  | "press_release"
  | "video_script"
  | "faq";

export type KnowledgeSource = "qdrant" | "tavily" | "both";

export interface ContentFormatMeta {
  id: ContentFormat;
  label: string;
  emoji: string;
  description: string;
}

export const CONTENT_FORMATS: ContentFormatMeta[] = [
  {
    id: "blog",
    label: "Post para Blog",
    emoji: "📝",
    description: "SEO, headings H1/H2/H3, ~1200 palavras, CTA",
  },
  {
    id: "instagram_post",
    label: "Post Instagram",
    emoji: "📸",
    description: "Legenda + hashtags + sugestão de imagem",
  },
  {
    id: "instagram_carousel",
    label: "Carrossel Instagram",
    emoji: "🎠",
    description: "5-8 slides com títulos e textos",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    emoji: "📧",
    description: "Assunto + intro + corpo + CTA",
  },
  {
    id: "image_prompt",
    label: "Prompt de Imagem",
    emoji: "🖼️",
    description: "Para DALL-E / Midjourney / Flux",
  },
  {
    id: "twitter_thread",
    label: "Thread Twitter/X",
    emoji: "📌",
    description: "Sequência de tweets encadeados",
  },
  {
    id: "infographic",
    label: "Infográfico",
    emoji: "📊",
    description: "Estrutura de dados para design",
  },
  {
    id: "meta_seo",
    label: "Meta SEO + Schema",
    emoji: "🔍",
    description: "Título, descrição, keywords, schema JSON-LD",
  },
  {
    id: "property_description",
    label: "Descrição de Empreendimento",
    emoji: "🏠",
    description: "Texto de venda rico e sofisticado",
  },
  {
    id: "press_release",
    label: "Release para Imprensa",
    emoji: "📰",
    description: "Formato jornalístico com lead e citação",
  },
  {
    id: "video_script",
    label: "Roteiro de Vídeo/Reels",
    emoji: "🎥",
    description: "Storyboard + narração por cena",
  },
  {
    id: "faq",
    label: "FAQ Inteligente",
    emoji: "📑",
    description: "Perguntas e respostas sobre o mercado",
  },
];

const BASE_BRAND = `Marca: INLEVOR — imobiliária de alto padrão, sofisticada, focada em clientes de alta renda.
Paleta e estilo visual: preto, branco, areia, dourado discreto, fotografia com luz suave.
Nunca prometer rentabilidade garantida. Use dados com fontes sempre que disponível.
Escreva em português brasileiro (pt-BR) a menos que instruído de outra forma.`.trim();

const TONE_MAP: Record<string, string> = {
  sofisticado:
    "Tom sofisticado, elegante, vocabulário refinado, frases bem construídas.",
  acessivel:
    "Tom acessível e amigável, linguagem clara, sem jargão excessivo.",
  tecnico:
    "Tom técnico e analítico, use dados, métricas e terminologia de mercado.",
  urgente:
    "Tom urgente e direto ao ponto, crie senso de oportunidade real.",
};

const AUDIENCE_MAP: Record<string, string> = {
  investidor:
    "Público-alvo: investidores sofisticados com interesse em rentabilidade e proteção patrimonial.",
  comprador:
    "Público-alvo: compradores finais em busca do imóvel dos sonhos.",
  arquiteto:
    "Público-alvo: arquitetos, designers e profissionais do setor criativo.",
  imprensa:
    "Público-alvo: jornalistas e veículos de comunicação do setor imobiliário.",
};

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  blog: `Crie um post completo para blog.
Estrutura obrigatória:
- H1: Título principal otimizado para SEO (máx 65 chars)
- Introdução: 1-2 parágrafos instigantes
- H2: Pelo menos 4 seções com subheadings claros
- Dados e evidências de mercado quando disponível no contexto
- H2: Conclusão
- CTA final: parágrafo incentivando o leitor a entrar em contato ou conhecer empreendimentos
- Última linha: **Meta:** seguida da meta description SEO (máx 155 chars)
Extensão: ~1200 palavras. Use Markdown.`,

  instagram_post: `Crie um post completo para Instagram.
Estrutura:
- Linha de abertura impactante (gancho visual, não clickbait)
- Corpo da legenda (3-5 parágrafos curtos, com emojis estratégicos)
- CTA claro (ex: "Fale conosco pelo link na bio")
- Espaçamento entre parágrafos para leitura fácil
- Hashtags: 20-30 hashtags relevantes, mix de alta e média concorrência
- Ao final, uma linha: **Visual sugerido:** [descrição da imagem ideal]
Limite: 2200 caracteres na legenda (sem contar hashtags).`,

  instagram_carousel: `Crie um carrossel para Instagram com 5 a 8 slides.
Para cada slide, use este formato exato:
---
**Slide [N]: [Título do Slide]**
[Texto do slide — máximo 3 linhas curtas e impactantes]
---
Slide 1: Capa — título principal + subtítulo curto (gancho)
Slides 2–N-1: conteúdo progressivo, um ponto chave por slide
Slide N (último): CTA + convite para salvar/comentar/contato
Ao final, adicione: **Legenda sugerida:** [texto para o caption da publicação]`,

  newsletter: `Crie uma newsletter completa.
Estrutura obrigatória:
- **Assunto:** linha de assunto atraente (máx 60 chars, evite spam triggers)
- **Preview text:** texto de pré-cabeçalho (máx 90 chars)
- **Saudação personalizada**
- **Corpo:** 3-5 seções com subtítulos em negrito
- **Destaque:** box/seção especial com insight chave
- **CTA principal:** botão/link com ação clara
- **Rodapé:** contato + "Para cancelar inscrição, clique aqui"
Extensão: 400-600 palavras. Use Markdown.`,

  image_prompt: `Crie 3 variações de prompts para geração de imagens por IA.
Para cada prompt, inclua:
- Descrição da cena principal
- Estilo fotográfico/artístico (realista, editorial, arquitetural)
- Paleta de cores (alinhada com a marca: preto, branco, areia, dourado discreto)
- Iluminação (luz natural suave, hora dourada, luz de estúdio)
- Ângulo e composição
- Parâmetros técnicos para Midjourney/DALL-E (ex: --ar 16:9)
Formate como:
**Prompt 1 — [contexto]:**
[prompt completo em inglês]

**Prompt 2 — [contexto]:**
[prompt completo em inglês]

**Prompt 3 — [contexto]:**
[prompt completo em inglês]`,

  twitter_thread: `Crie uma thread para Twitter/X com 5 a 10 tweets.
Regras:
- Cada tweet: máx 280 caracteres
- Tweet 1: gancho forte que faça as pessoas quererem continuar lendo
- Tweets 2–N-1: conteúdo progressivo, um insight por tweet
- Numeração: comece cada tweet com "1/" "2/" etc.
- Tweet final: CTA + hashtag relevante
Formate cada tweet separado por linha em branco.`,

  infographic: `Crie a estrutura de dados para um infográfico.
**Título do Infográfico:** [título]
**Subtítulo:** [subtítulo explicativo]

**Seção 1: [título]**
- Dado/informação 1
- Dado/informação 2

**Seção 2: [título]**
- ...

**Destaque central:** [número ou frase de impacto]
**Fonte dos dados:** [fontes]
**CTA visual:** [texto de chamada para ação]
Forneça dados concretos sempre que disponível no contexto.`,

  meta_seo: `Crie metadados SEO completos.
**Title tag:** [título SEO, máx 65 chars]
**Meta description:** [descrição, máx 155 chars]
**Keywords principais:** [5-8 palavras-chave, separadas por vírgula]
**Keywords de cauda longa:** [5 frases de busca relevantes]
**Heading H1 sugerido:** [título H1]
**Open Graph title:** [título para redes sociais]
**Open Graph description:** [descrição para redes sociais, máx 200 chars]
**Schema.org JSON-LD:**
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "description": "...",
  "publisher": { "@type": "Organization", "name": "Inlevor" }
}
\`\`\`
Use palavras-chave relevantes para o mercado imobiliário de alto padrão no Brasil.`,

  property_description: `Crie uma descrição rica e sofisticada para um empreendimento imobiliário de alto padrão.
Estrutura:
- Headline: frase de impacto que evoque lifestyle e exclusividade
- Parágrafo de abertura: apresente o empreendimento de forma evocativa
- Diferenciais: principais atributos em prosa elegante (não como lista seca)
- Localização: contextualize o bairro/região com classe
- Lifestyle: descreva a experiência de morar naquele espaço
- Fechamento: convide sutilmente para conhecer mais
Extensão: 300-500 palavras. Linguagem sofisticada e evocativa.`,

  press_release: `Crie um release jornalístico completo.
Estrutura obrigatória:
- **RELEASE | PARA PUBLICAÇÃO IMEDIATA**
- **Título:** [headline jornalístico, factual e direto]
- **Subtítulo:** [segundo título complementar]
- **[Cidade], [data] —** Lead com as 5 perguntas: quem, o quê, quando, onde, por quê/como
- **Corpo:** 3-4 parágrafos com contexto, dados e desenvolvimento
- **Citação:** parágrafo com citação de porta-voz (ex: "Segundo [Nome], diretor da Inlevor...")
- **Sobre a Inlevor:** boilerplate institucional (2-3 linhas)
- **Contato de Imprensa:** assessoria@inlevor.com.br
Extensão: 400-600 palavras. Linguagem jornalística, objetivo, sem superlativos.`,

  video_script: `Crie um roteiro completo para vídeo/Reels.
Para cada cena use este formato:
---
**CENA [N] | [DURAÇÃO] | [TIPO DE PLANO]**
*Descrição visual:* [o que aparece na tela]
*Narração/Texto na tela:* [texto falado ou sobreposto]
*Música/SFX sugerido:* [referência musical]
---
Crie 5-8 cenas para um vídeo de 60-90 segundos.
Ao final inclua:
**Hook (primeiros 3s):** [texto de gancho]
**CTA final:** [chamada para ação]
**Hashtags sugeridas:** [lista]`,

  faq: `Crie um FAQ completo e inteligente com 8 a 12 perguntas e respostas.
Regras:
- Perguntas: use linguagem natural de quem busca no Google
- Respostas: objetivas mas completas (3-5 linhas cada)
- Inclua dados de mercado quando disponível no contexto
- Varie entre perguntas técnicas, financeiras e de lifestyle
Formate como:

**P: [pergunta]**
R: [resposta]

Ao final, adicione:
**Ainda tem dúvidas?** [CTA para contato]`,
};

export function buildSystemPrompt(
  format: ContentFormat,
  tone: string,
  audience: string,
  language: string,
  includeSources: boolean,
  variations: number
): string {
  const toneInstruction =
    TONE_MAP[tone] ?? `Tom de voz: ${tone}.`;
  const audienceInstruction =
    AUDIENCE_MAP[audience] ?? `Público-alvo: ${audience}.`;
  const langInstruction =
    language === "en"
      ? "Write in English (en-US)."
      : "Escreva em português brasileiro (pt-BR).";
  const sourcesInstruction = includeSources
    ? "Cite as fontes utilizadas ao final com marcações [Fonte: ...]. Use os dados do contexto fornecido."
    : "Use os dados do contexto fornecido, mas não é obrigatório citar fontes explicitamente.";
  const variationsInstruction =
    variations > 1
      ? `O usuário solicitou ${variations} variações. Crie ${variations} versões distintas, separadas por:\n\n---\n### VARIAÇÃO [N]\n---\n`
      : "";

  return [
    BASE_BRAND,
    toneInstruction,
    audienceInstruction,
    langInstruction,
    sourcesInstruction,
    variationsInstruction,
    "",
    FORMAT_INSTRUCTIONS[format],
  ]
    .filter(Boolean)
    .join("\n");
}
