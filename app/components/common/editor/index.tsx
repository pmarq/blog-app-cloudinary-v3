// components/editor/index.tsx

"use client";

import {
  ChangeEventHandler,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, getMarkRange, Range } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import TipTapImage from "@tiptap/extension-image";
import EditLink from "./link/EditLink";
import GalleryModal, { ImageSelectionResult } from "./GalleryModal";
import ToolBar from "./ToolBar";
import SEOForm, { SeoResult } from "./SeoForm";
import ThumbnailSelector from "./ThumbnailSelector";
import ActionButton from "../ActionButton";
import { useStudioActionsMock } from "@/app/hooks/useStudioActionsMock";
import { Action, GuardrailIssue } from "@/app/models/Studio";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { Thumbnail } from "@/app/models/Post";
import { ThumbnailData } from "@/app/models/ThumbnailData";
import { Category, getCategories } from "@/lib/categories";
import { withBasePath } from "@/lib/withBasePath";

export interface FinalPost extends SeoResult {
  title: string;
  content: string;
  thumbnail?: File | string | ThumbnailData | Thumbnail | null;
  categoryId?: string;
  categorySlug?: string;
  categoryTitle?: string;
  briefId?: string;
  origin?: string;
}

type BriefSourceSignals = {
  portfolioRegions?: string[];
  portfolioCities?: string[];
  portfolioSegments?: string[];
  opportunityTitles?: string[];
  opportunityScopes?: string[];
  opportunityRegions?: string[];
  calendarTitle?: string;
  calendarScope?: string;
  calendarTheme?: string;
  calendarAngle?: string;
  strategyPillars?: string[];
};

type BriefContext = {
  id?: string;
  title?: string;
  channel?: string;
  theme?: string | null;
  scope?: string | null;
  objective?: string;
  angle?: string;
  cta?: string;
  sourceType?: string | null;
  editorialQuestion?: string | null;
  whyNow?: string | null;
  contentFormat?: string | null;
  manualTopic?: string | null;
  sourceSignals?: BriefSourceSignals | null;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function slugifyText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function trimToLength(value: string, maxLength: number): string {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
}

function normalizeTagValue(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[|/•]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .trim();
}

function buildSeoFromBriefContext(briefTitle: string, briefContext: BriefContext | null): SeoResult {
  const signals = briefContext?.sourceSignals;
  const regions = uniqueStrings([
    ...(signals?.portfolioRegions || []),
    ...(signals?.portfolioCities || []),
    ...(signals?.opportunityRegions || []),
  ]);
  const subjects = uniqueStrings([
    ...(signals?.portfolioSegments || []),
    ...(signals?.opportunityTitles || []),
    ...(signals?.opportunityScopes || []),
    ...(signals?.strategyPillars || []),
    ...(signals?.calendarTheme ? [signals.calendarTheme] : []),
    ...(signals?.calendarTitle ? [signals.calendarTitle] : []),
  ]);
  const titleSeed = String(briefContext?.title || briefTitle || "").trim() || "Conteúdo editorial";
  const subject = subjects[0] || briefContext?.objective || titleSeed;
  const region = regions[0] || "";
  const channel = String(briefContext?.channel || "").trim().toLowerCase();
  const editorialHook = trimToLength(
    briefContext?.editorialQuestion ||
      briefContext?.whyNow ||
      briefContext?.objective ||
      subject,
    62,
  );
  const topicLine = trimToLength(
    subject && region ? `${subject} em ${region}` : subject,
    76,
  );

  const metaCore =
    channel === "newsletter"
      ? `Newsletter sobre ${topicLine || titleSeed}`
      : channel === "instagram"
        ? `Leitura visual sobre ${topicLine || titleSeed}`
        : `Análise de ${topicLine || titleSeed}`;

  const meta = trimToLength(
    editorialHook && editorialHook !== topicLine
      ? `${metaCore}. Veja como ${editorialHook}`
      : metaCore,
    150,
  );

  const slugSource = uniqueStrings([
    subject,
    region,
    briefContext?.title || titleSeed,
  ])
    .join(" ")
    .trim();

  const tags = uniqueStrings([
    "mercado imobiliário",
    "alto padrão",
    channel,
    normalizeTagValue(subject),
    normalizeTagValue(region),
    ...(signals?.portfolioSegments || []).map(normalizeTagValue),
    ...(signals?.portfolioRegions || []).map(normalizeTagValue),
    ...(signals?.portfolioCities || []).map(normalizeTagValue),
    ...(signals?.opportunityTitles || []).map(normalizeTagValue),
    ...(signals?.strategyPillars || []).map(normalizeTagValue),
  ])
    .filter((tag) => tag.length > 2)
    .slice(0, 8);

  return {
    meta,
    slug: slugifyText(slugSource || titleSeed),
    tags: tags.join(", "),
  };
}

interface Props {
  initialValue?: FinalPost;
  btnTitle?: string;
  busy?: boolean;
  briefId?: string;
  onSubmit(post: FinalPost): Promise<void>;
}

export default function Editor({
  initialValue,
  btnTitle = "Submit",
  busy = false,
  briefId,
  onSubmit,
}: Props): JSX.Element {
  const [selectionRange, setSelectionRange] = useState<Range>();
  const [showGallery, setShowGallery] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<Array<{ src: string }>>([]);
  const [seoInitialValue, setSeoInitialValue] = useState<SeoResult>();
  const [briefContext, setBriefContext] = useState<BriefContext | null>(null);
  const [showStudioStub, setShowStudioStub] = useState(false);
  const [mockActions, setMockActions] = useState<string[]>([]);
  const [mockBusy, setMockBusy] = useState(false);
  const [previousSnapshot, setPreviousSnapshot] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [guardrailBusy, setGuardrailBusy] = useState(false);
  const {
    fetchIdeas,
    fetchGuardrails,
    loading: studioLoading,
    lastRun,
    issues,
  } = useStudioActionsMock();

  const captureSnapshot = () => {
    const currentContent = editor ? editor.getHTML() : post.content;
    return {
      title: post.title,
      content: currentContent,
      meta: post.meta,
      tags: post.tags,
      tagsArray: (post as any).tagsArray,
      slug: post.slug,
    };
  };

  const applyAction = (action: Action) => {
    // salva snapshot antes de aplicar
    setPreviousSnapshot(captureSnapshot());

    switch (action.type) {
      case "insert_title": {
        const nextTitle = action.value ? String(action.value) : "";
        setPost((prev) => ({ ...prev, title: nextTitle }));
        break;
      }
      case "insert_outline": {
        if (!editor) {
          toast({
            title: "Mock Studio",
            description: "Editor não disponível para aplicar outline.",
            variant: "destructive",
          });
          return;
        }
        const items = Array.isArray(action.items)
          ? action.items.map((i) => String(i))
          : action.value
          ? [String(action.value)]
          : [];
        const html = `<ul>${items.map((o) => `<li>${o}</li>`).join("")}</ul>`;
        editor.chain().focus().insertContent(html).run();
        break;
      }
      case "insert_seo": {
        const tags =
          Array.isArray(action.tags) && action.tags.length
            ? action.tags
            : typeof action.tags === "string"
            ? action.tags.split(",").map((t) => t.trim())
            : post.tagsArray || post.tags;
        setPost((prev) => ({
          ...prev,
          meta: action.meta || prev.meta,
          tagsArray: tags as any,
          tags: Array.isArray(tags) ? tags.join(", ") : String(tags || ""),
        }));
        break;
      }
      case "insert_ctas": {
        if (!editor) {
          toast({
            title: "Mock Studio",
            description: "Editor não disponível para aplicar CTAs.",
            variant: "destructive",
          });
          return;
        }
        const items = Array.isArray(action.items)
          ? action.items.map((i) => String(i))
          : action.value
          ? [String(action.value)]
          : [];
        const html = `<ul>${items.map((o) => `<li>${o}</li>`).join("")}</ul>`;
        editor.chain().focus().insertContent(html).run();
        break;
      }
      default: {
        toast({
          title: "Mock Studio",
          description: `Ação ${action.type} não tem aplicação automática neste mock.`,
          variant: "default",
        });
        break;
      }
    }
  };
  const [post, setPost] = useState<FinalPost>({
    title: "",
    content: "",
    meta: "",
    tags: "",
    slug: "",
  });

  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // briefId vindo do Studio, se houver
  useEffect(() => {
    if (briefId) {
      setPost((prev) => ({ ...prev, briefId, origin: prev.origin || "studio" }));
    }
  }, [briefId]);

  useEffect(() => {
    let cancelled = false;

    const loadBriefContext = async () => {
      if (!briefId) return;
      try {
        const token = await currentUser?.getIdToken(true);
        if (!token) return;
        const response = await fetch(
          withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}?orgId=`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || cancelled) return;
        setBriefContext(payload.brief || null);
      } catch {
        if (!cancelled) setBriefContext(null);
      }
    };

    void loadBriefContext();

    return () => {
      cancelled = true;
    };
  }, [briefId, currentUser]);

  useEffect(() => {
    if (!briefContext) return;

    const derivedSeo = buildSeoFromBriefContext(post.title || briefContext.title || "", briefContext);
    setSeoInitialValue((prev) => {
      if (prev?.meta || prev?.slug || prev?.tags) return prev;
      return derivedSeo;
    });

    setPost((prev) => ({
      ...prev,
      meta: prev.meta || derivedSeo.meta,
      slug: prev.slug || derivedSeo.slug,
      tags: prev.tags || derivedSeo.tags,
    }));
  }, [briefContext]);

  // 1) Memoizando TODAS as opções do useEditor:
  const editorConfig = useMemo(() => {
    return {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          autolink: false,
          linkOnPaste: false,
          openOnClick: false,
        }),
        Placeholder.configure({ placeholder: "Type something" }),
        Youtube.configure({
          width: 840,
          height: 472.5,
          HTMLAttributes: { class: "mx-auto rounded" },
        }),
        TipTapImage.configure({ HTMLAttributes: { class: "mx-auto" } }),
      ],
      editorProps: {
        handleClick(view: any, pos: number) {
          const { state } = view;
          const range = getMarkRange(
            state.doc.resolve(pos),
            state.schema.marks.link
          );
          if (range) setSelectionRange(range);
        },
        attributes: {
          class:
            "prose prose-lg focus:outline-none dark:prose-invert max-w-full mx-auto h-full",
        },
      },
      content: "",
      onUpdate: () => {
        // Se você não precisa fazer nada a cada digitação, pode deixar vazio ou remover.
      },
      immediatelyRender: false,
    };
  }, []);

  // 2) Agora passo essa configuração estável para useEditor:
  const editor = useEditor(editorConfig);

  // Função para obter o token de autenticação
  const getAuthToken = async (): Promise<string | null> => {
    if (!currentUser) {
      return null;
    }
    try {
      const token = await currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error("Erro ao obter token de autenticação:", error);
      return null;
    }
  };

  // Função para buscar imagens da galeria
  const fetchImages = async () => {
    const token = await getAuthToken();
    if (!token) {
      toast({
        title: "Erro!",
        description:
          "Você precisa estar autenticado para acessar a galeria de imagens.",
        variant: "destructive",
      });
      router.push("/login"); // Redireciona para a página de login
      return;
    }

    try {
      const res = await fetch(
        withBasePath(
          `/api/cloudinary/list-images?folder=gallery/${currentUser?.uid}`
        ),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("RES===>", res);

      if (!res.ok) {
        throw new Error("Falha na requisição para listar imagens.");
      }
      const { resources } = await res.json();
      console.log("Recursos recebidos da API no Frontend:", resources); // Adicione este log

      if (Array.isArray(resources)) {
        setImages(resources.map((r: any) => ({ src: r.src }))); // Corrigido: use 'r.src' em vez de 'r.secure_url'
      }
    } catch (error) {
      console.error("Erro ao buscar imagens:", error);
      toast({
        title: "Erro!",
        description: "Não foi possível buscar as imagens da galeria.",
        variant: "destructive",
      });
    }
  };

  // Função para abrir a galeria e buscar imagens
  const handleOpenGallery = async () => {
    await fetchImages();
    setShowGallery(true);
  };

  // (1) Chamado ao clicar em alguma imagem da galeria
  const handleImageSelection = (result: ImageSelectionResult) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setImage({ src: result.src, alt: result.altText })
      .run();
  };

  // (2) Chamado quando o modal faz upload e retorna a URL final
  const handleFileSelect = (imageUrl: string) => {
    // Adiciona à galeria
    setImages((prev) => [{ src: imageUrl }, ...prev]);
    // Insere no editor
    editor
      ?.chain()
      .focus()
      .setImage({ src: imageUrl, alt: "Uploaded Image" })
      .run();
  };

  // Submit do post
  const handleSubmit = async () => {
    // 1) Verifica se o usuário está autenticado
    const token = await getAuthToken();
    if (!token) {
      toast({
        title: "Erro!",
        description: "Você precisa estar autenticado para criar um post.",
        variant: "destructive",
      });
      router.push("/login"); // Redireciona para a página de login
      return;
    }

    // 2) Verifica se título e conteúdo estão preenchidos
    if (!post.title.trim()) {
      toast({
        title: "Erro!",
        description: "O título é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!editor || !editor.getHTML().trim()) {
      toast({
        title: "Erro!",
        description: "O conteúdo do post é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // 3) Monta objeto final
    const finalContent = editor.getHTML();

    // Faz upload do thumbnail usando uploads assinados
    let finalThumbnail:
      | string
      | Thumbnail
      | File
      | ThumbnailData
      | null
      | undefined = post.thumbnail;
    if (post.thumbnail instanceof File) {
      try {
        setUploading(true);

        // Define a pasta para thumbnails, utilizando um ID único (ex.: timestamp)
        const folder = `thumbnails/${Date.now()}`;

        // Faz o upload utilizando a função utilitária
        const uploadResponse = await uploadToCloudinary(post.thumbnail, folder);

        // Mapeia UploadResponse para Thumbnail
        finalThumbnail = {
          url: `${uploadResponse.secure_url}?f_auto,q_auto`,
          public_id: uploadResponse.public_id,
        };

        console.log("Thumbnail enviado com sucesso:", finalThumbnail);
      } catch (error: any) {
        console.error("Erro ao enviar thumbnail:", error);
        toast({
          title: "Erro!",
          description: "Não foi possível enviar o thumbnail.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    // Cria o objeto final
    const updatedPost: FinalPost = {
      ...post,
      thumbnail: finalThumbnail,
      content: finalContent,
    };

    // 4) Chama a função onSubmit do pai
    try {
      await onSubmit(updatedPost);
      /*  toast({
        title: "Sucesso!",
        description: "Post criado com sucesso.",
        variant: "default",
      });
      // 5) Redireciona para a página de posts (opcional)
      router.push("/dashboard/posts"); */
    } catch (error: any) {
      console.error("Erro ao criar post:", error);
      toast({
        title: "Erro!",
        description: "Não foi possível criar o post.",
        variant: "destructive",
      });
    }
  };

  // Atualiza o título
  const updateTitle: ChangeEventHandler<HTMLInputElement> = ({ target }) =>
    setPost({ ...post, title: target.value });

  // Atualiza SEO
  const updateSeoValue = (result: SeoResult) => {
    const tagsArray =
      typeof result.tags === "string"
        ? result.tags.split(",").map((tag) => tag.trim())
        : result.tags;

    setPost({ ...post, ...result, tagsArray });
  };

  // Atualiza thumbnail localmente (sem upload imediato)
  const updateThumbnail = (file: File) => {
    setPost((prev) => ({ ...prev, thumbnail: file }));
  };

  // Se houve clique em link (para editar)
  useEffect(() => {
    if (editor && selectionRange) {
      editor.commands.setTextSelection(selectionRange);
    }
  }, [editor, selectionRange]);

  // Inicialização segura (evita loop infinito)
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initialValue || !editor || initializedRef.current) return;

    setPost(initialValue);
    if (initialValue.content) {
      editor.commands.setContent(initialValue.content);
    }

    const { meta, slug, tags } = initialValue;
    setSeoInitialValue({ meta, slug, tags });

    initializedRef.current = true; // Evita reexecução
  }, [initialValue, editor]);

  // Buscar categorias ao montar o componente
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const cats = await getCategories();
      cats.sort((a, b) => a.title.localeCompare(b.title));
      setCategories(cats);
    };
    fetchCategories();
  }, []);

  return (
    <>
      <div className="p-3 dark:bg-primary-dark bg-primary transition">
        <div className="sticky top-0 z-10 dark:bg-primary-dark bg-primary">
          {/* Cabeçalho: Thumbnail + Botão Submit */}
          <div className="flex items-center justify-between mb-3">
            <ThumbnailSelector
              initialValue={(() => {
                if (!post.thumbnail) return undefined;
                if (typeof post.thumbnail === "string") return post.thumbnail;
                if (
                  "url" in post.thumbnail &&
                  typeof post.thumbnail.url === "string"
                ) {
                  return post.thumbnail.url;
                }
                return undefined;
              })()}
              onChange={updateThumbnail}
            />
            <div className="inline-flex items-center gap-2">
              <ActionButton
                busy={busy || uploading}
                title={btnTitle}
                onClick={handleSubmit}
              />
              <button
                type="button"
                className="text-xs px-3 py-2 border rounded border-secondary-dark dark:border-secondary-light text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/40 dark:hover:bg-secondary-dark/40 transition"
                onClick={() => setShowStudioStub((prev) => !prev)}
              >
                Studio (mock)
              </button>
            </div>
          </div>
          {briefContext ? (
            <div className="mb-3 rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2 text-xs text-secondary-dark dark:text-secondary-light">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold uppercase tracking-wide text-highlight-light">
                  Contexto do brief
                </div>
                <div>{briefContext.sourceType || "studio"}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueStrings([
                  ...(briefContext.sourceSignals?.calendarTitle ? [briefContext.sourceSignals.calendarTitle] : []),
                  ...(briefContext.sourceSignals?.calendarScope ? [briefContext.sourceSignals.calendarScope] : []),
                  ...(briefContext.sourceSignals?.calendarTheme ? [briefContext.sourceSignals.calendarTheme] : []),
                  ...(briefContext.sourceSignals?.portfolioRegions || []),
                  ...(briefContext.sourceSignals?.portfolioCities || []),
                  ...(briefContext.sourceSignals?.portfolioSegments || []),
                  ...(briefContext.sourceSignals?.opportunityTitles || []),
                  ...(briefContext.sourceSignals?.opportunityScopes || []),
                  ...(briefContext.sourceSignals?.opportunityRegions || []),
                  ...(briefContext.sourceSignals?.strategyPillars || []),
                ])
                  .slice(0, 8)
                  .map((chip) => (
                    <span
                      key={`${briefId || "editor"}-${chip}`}
                      className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px]"
                    >
                      {chip}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
          {/*Categorias*/}
          <select
            value={post.categoryId || ""}
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedCategory = categories.find(
                (cat) => cat.id === selectedId
              );

              setPost({
                ...post,
                categoryId: selectedId,
                categorySlug: selectedCategory?.slug || "",
                categoryTitle: selectedCategory?.title || "",
              });
            }}
            className="mt-6 mb-6 p-2 border rounded text-sm"
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>

          {/* Título */}
          <input
            type="text"
            className="py-2 outline-none bg-transparent w-full border-0 border-b-[1px] border-secondary-dark dark:border-secondary-light text-3xl font-semibold italic text-primary-dark dark:text-primary mb-3"
            placeholder="Title"
            onChange={updateTitle}
            value={post.title}
          />

          {/* Barra de Ferramentas (ToolBar) */}
          <ToolBar editor={editor} onOpenImageClick={handleOpenGallery} />

          <div className="h-[1px] w-full bg-secondary-dark dark:bg-secondary-light my-3" />
        </div>

        <div
          className={`${
            showStudioStub ? "block" : "hidden"
          } mb-3 rounded border border-secondary-dark/50 dark:border-secondary-light/40 bg-secondary-light/20 dark:bg-secondary-dark/30 p-3 text-sm text-secondary-dark dark:text-secondary-light`}
        >
          <p className="font-semibold mb-1">
            Studio (mock) ativo — apenas para testar fluxo.
          </p>
          <p className="mb-2">
            Endpoints mockados: /api/studio/ai/ideas, /ai/visual, /curate/pdf,
            /guardrails/check, /instagram/job, /publish/blog. Nada é enviado
            para produção.
          </p>
          <p className="text-xs opacity-80">
            Use o botão apenas como lembrete visual; integrações reais virão
            depois.
          </p>

              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setMockBusy(true);
                    setMockActions([]);
                    try {
                      const data = await fetchIdeas();
                      if (!data || !Array.isArray(data.actions)) {
                        throw new Error("Resposta inválida do mock.");
                      }
                      const titles = data.actions
                        .filter((a) => a.type === "insert_title" && a.value)
                        .map((a) => String(a.value));
                      const outlines = data.actions
                        .filter((a) => a.type === "insert_outline" && a.items)
                        .flatMap((a) => a.items as string[])
                        .map((i) => String(i));
                      setMockActions([
                        ...titles.map((t: string) => `Título: ${t}`),
                        ...outlines.map((o: string) => `Outline: ${o}`),
                      ]);
                      // não aplica automaticamente; use os botões de aplicar abaixo
                    } catch (error) {
                      console.error("Mock Studio error:", error);
                      toast({
                        title: "Mock Studio",
                        description: "Falha ao chamar o mock /api/studio/ai/ideas.",
                        variant: "destructive",
                      });
                    } finally {
                      setMockBusy(false);
                    }
                  }}
                  className="text-xs px-3 py-2 border rounded border-secondary-dark dark:border-secondary-light text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/40 dark:hover:bg-secondary-dark/40 transition disabled:opacity-60"
                  disabled={mockBusy || studioLoading}
                >
                  {mockBusy || studioLoading
                    ? "Carregando..."
                    : "Gerar ideias (mock)"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (previousSnapshot && editor) {
                  setPost((prev) => ({
                    ...prev,
                    title: previousSnapshot.title,
                    meta: (previousSnapshot as any).meta || prev.meta,
                    tags: (previousSnapshot as any).tags || prev.tags,
                    slug: (previousSnapshot as any).slug || prev.slug,
                    ...(previousSnapshot as any).tagsArray
                      ? { tagsArray: (previousSnapshot as any).tagsArray }
                      : {},
                  }));
                  editor.commands.setContent(previousSnapshot.content);
                }
                setMockActions([]);
                setPreviousSnapshot(null);
              }}
              className="text-xs px-3 py-2 border rounded border-secondary-dark/60 dark:border-secondary-light/60 text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
            >
              Desfazer mock
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!editor) return;
                setGuardrailBusy(true);
                try {
                  await fetchGuardrails(editor.getHTML());
                } finally {
                  setGuardrailBusy(false);
                }
              }}
              className="text-xs px-3 py-2 border rounded border-secondary-dark dark:border-secondary-light text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/40 dark:hover:bg-secondary-dark/40 transition disabled:opacity-60"
              disabled={guardrailBusy || studioLoading || !editor}
            >
              {guardrailBusy ? "Checando..." : "Checar guardrails (mock)"}
            </button>

            {mockActions.length ? (
              <div className="rounded bg-primary/40 dark:bg-primary-dark/40 p-2 text-xs space-y-1">
                {mockActions.map((m, idx) => (
                  <div key={idx}>• {m}</div>
                ))}
                {lastRun ? (
                  <div className="pt-1 text-[10px] opacity-70">
                    runId: {lastRun.runId} | schema: {lastRun.schemaVersion}
                  </div>
                ) : null}
              </div>
            ) : null}

            {issues.length ? (
              <div className="rounded bg-secondary-light/30 dark:bg-secondary-dark/30 p-2 text-xs space-y-1">
                <div className="font-semibold">Guardrails (mock)</div>
                {issues.map((issue: GuardrailIssue) => (
                  <div key={`${issue.field}-${issue.message}`} className="flex justify-between gap-2">
                    <span>
                      {issue.field}: {issue.message}
                    </span>
                    <span className="capitalize text-secondary-dark/80 dark:text-secondary-light/80">
                      {issue.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {lastRun?.actions?.length ? (
              <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 p-2 text-xs space-y-1">
                <div className="font-semibold">Ações disponíveis</div>
                {lastRun.actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 border-t border-secondary-dark/10 dark:border-secondary-light/10 pt-1"
                  >
                    <div className="flex-1">
                      <div className="capitalize">{action.type}</div>
                      {action.value ? (
                        <div className="text-[11px] opacity-80">{action.value}</div>
                      ) : null}
                      {action.meta ? (
                        <div className="text-[11px] opacity-80">meta: {action.meta}</div>
                      ) : null}
                      {action.tags ? (
                        <div className="text-[11px] opacity-80">
                          tags: {Array.isArray(action.tags) ? action.tags.join(", ") : action.tags}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 text-[11px] hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => applyAction(action)}
                    >
                      Aplicar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Se existe editor, renderiza Link Editor */}
        {editor ? <EditLink editor={editor} /> : null}

        {/* Conteúdo do Editor */}
        <EditorContent editor={editor} className="min-h-[300px]" />

        <div className="h-[1px] w-full bg-secondary-dark dark:bg-secondary-light my-3" />

        {/* Formulário de SEO */}
        <SEOForm
          onChange={updateSeoValue}
          title={post.title}
          initialValue={seoInitialValue}
        />
      </div>

      {/* Modal de Galeria de Imagens */}
      <GalleryModal
        visible={showGallery}
        onClose={() => setShowGallery(false)}
        onSelect={handleImageSelection}
        onFileSelect={handleFileSelect}
        images={images}
        uploading={uploading}
      />
    </>
  );
}

