/* Cliente mínimo de la API REST de GitHub para el modo revisión.
   Se ejecuta en Cloudflare Pages Functions (fetch nativo, sin dependencias). */

export interface Entorno {
  /** Token fine-grained con permiso Issues: lectura y escritura, solo sobre este repositorio. */
  GITHUB_TOKEN?: string;
  /** "propietario/repositorio", p. ej. "janoboxCL/huracan-web". */
  GITHUB_REPO?: string;
  /** Clave que va en el enlace de revisión que se le envía al cliente. */
  REVISION_CLAVE?: string;
  /** Solo para pruebas locales con el simulador (scripts/revision-simulador.mjs). */
  GITHUB_API_URL?: string;
}

export class ErrorGitHub extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
  }
}

export interface Etiqueta {
  name: string;
  color?: string;
}

export interface Issue {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened' | null;
  labels: Array<Etiqueta | string>;
  comments: number;
  created_at: string;
  pull_request?: unknown;
}

export interface ComentarioIssue {
  body: string | null;
  created_at: string;
  user: { login: string } | null;
}

export class GitHub {
  private readonly base: string;
  private readonly repo: string;
  private readonly token: string;

  constructor(entorno: Required<Pick<Entorno, 'GITHUB_TOKEN' | 'GITHUB_REPO'>> & Entorno) {
    this.base = (entorno.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/$/, '');
    this.repo = entorno.GITHUB_REPO;
    this.token = entorno.GITHUB_TOKEN;
  }

  async pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const init: RequestInit = {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'huracan-web-modo-revision',
        ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    };
    if (cuerpo !== undefined) init.body = JSON.stringify(cuerpo);
    const respuesta = await fetch(`${this.base}/repos/${this.repo}${ruta}`, init);
    if (!respuesta.ok) {
      let detalle: unknown = null;
      try {
        detalle = await respuesta.json();
      } catch {
        /* sin cuerpo JSON */
      }
      throw new ErrorGitHub(respuesta.status, `GitHub respondió ${respuesta.status} en ${metodo} ${ruta}`, detalle);
    }
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
  }

  /** Issues (sin pull requests) que tienen todas las etiquetas dadas. Hasta 500. */
  async listarIssues(etiquetas: string[]): Promise<Issue[]> {
    const todas: Issue[] = [];
    for (let pagina = 1; pagina <= 5; pagina++) {
      const parametros = new URLSearchParams({
        labels: etiquetas.join(','),
        state: 'all',
        per_page: '100',
        page: String(pagina),
        sort: 'created',
        direction: 'asc',
      });
      const lote = await this.pedir<Issue[]>('GET', `/issues?${parametros}`);
      todas.push(...lote.filter((i) => !i.pull_request));
      if (lote.length < 100) break;
    }
    return todas;
  }

  obtenerIssue(numero: number): Promise<Issue> {
    return this.pedir<Issue>('GET', `/issues/${numero}`);
  }

  crearIssue(datos: { title: string; body: string; labels: string[] }): Promise<Issue> {
    return this.pedir<Issue>('POST', '/issues', datos);
  }

  editarIssue(numero: number, datos: { body?: string; title?: string }): Promise<Issue> {
    return this.pedir<Issue>('PATCH', `/issues/${numero}`, datos);
  }

  agregarEtiquetas(numero: number, etiquetas: string[]): Promise<unknown> {
    return this.pedir('POST', `/issues/${numero}/labels`, { labels: etiquetas });
  }

  comentar(numero: number, texto: string): Promise<unknown> {
    return this.pedir('POST', `/issues/${numero}/comments`, { body: texto });
  }

  listarComentarios(numero: number): Promise<ComentarioIssue[]> {
    return this.pedir<ComentarioIssue[]>('GET', `/issues/${numero}/comments?per_page=100`);
  }

  async listarEtiquetas(): Promise<Etiqueta[]> {
    const todas: Etiqueta[] = [];
    for (let pagina = 1; pagina <= 3; pagina++) {
      const lote = await this.pedir<Etiqueta[]>('GET', `/labels?per_page=100&page=${pagina}`);
      todas.push(...lote);
      if (lote.length < 100) break;
    }
    return todas;
  }

  crearEtiqueta(etiqueta: { name: string; color: string; description?: string }): Promise<unknown> {
    return this.pedir('POST', '/labels', etiqueta);
  }
}

export function nombresEtiquetas(issue: Issue): string[] {
  return issue.labels.map((e) => (typeof e === 'string' ? e : e.name));
}
