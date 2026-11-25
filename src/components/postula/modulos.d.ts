/* Importación del worker de PDF.js como URL (Vite lo empaqueta con hash en el build). */
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
