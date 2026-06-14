declare module 'html-to-docx' {
  interface DocxOptions {
    font?: string
    fontSize?: number
    table?: { row?: { cantSplit?: boolean } }
    footer?: boolean
    pageNumber?: boolean
    margins?: Record<string, number>
    [key: string]: unknown
  }

  /**
   * Konvertuje HTML řetězec na DOCX (Buffer v Node prostředí).
   * Podpis: (html, headerHTML?, options?, footerHTML?)
   */
  export default function htmlToDocx(
    htmlString: string,
    headerHTMLString?: string,
    documentOptions?: DocxOptions,
    footerHTMLString?: string,
  ): Promise<Buffer | ArrayBuffer | Blob>
}
