export interface PdfExportOptions {
  title: string;
  subtitle: string;
  filename: string;
  academyName?: string;
  address?: string;
  phone?: string;
  columns: { header: string; align?: 'left' | 'center' | 'right' }[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
}

export function exportHtmlToPdf(opts: PdfExportOptions) {
  const academy = opts.academyName || 'Dojo Master Academy';
  const address = opts.address || '';
  const phone = opts.phone || '';
  const now = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const columnsHtml = opts.columns
    .map(
      (c) =>
        `<th style="text-align:${c.align || 'left'}; padding: 8px 10px; border: 1px solid #e7e5e4; background: #f5f5f4; font-size: 11px; text-transform: uppercase;">${c.header}</th>`
    )
    .join('');

  const rowsHtml = opts.rows
    .map((r, i) => {
      const bg = i % 2 === 1 ? 'background-color: #fafaf9;' : 'background-color: #ffffff;';
      const cells = r
        .map((cell, colIdx) => {
          const align = opts.columns[colIdx]?.align || 'left';
          return `<td style="text-align:${align}; padding: 7px 10px; border: 1px solid #e7e5e4;">${cell}</td>`;
        })
        .join('');
      return `<tr style="${bg}">${cells}</tr>`;
    })
    .join('');

  const summaryHtml = opts.summary?.length
    ? `<div style="margin-top: 18px; display: flex; gap: 14px; justify-content: flex-end;">
        ${opts.summary
          .map(
            (s) => `
          <div style="background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 8px; padding: 6px 14px; text-align: right;">
            <div style="font-size: 9px; color: #78716c; font-weight: bold; text-transform: uppercase;">${s.label}</div>
            <div style="font-size: 15px; font-weight: 900; color: #8B1A1A; font-family: monospace;">${s.value}</div>
          </div>
        `
          )
          .join('')}
      </div>`
    : '';

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${opts.filename}</title>
  <style>
    @media print {
      @page { margin: 12mm; size: A4 portrait; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1c1917;
      background: #ffffff;
      font-size: 12px;
    }
    .header {
      border-bottom: 2px solid #8B1A1A;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .academy-title {
      font-size: 22px;
      font-weight: 900;
      color: #8B1A1A;
      margin: 0;
      line-height: 1.2;
    }
    .academy-sub {
      font-size: 11px;
      color: #78716c;
      margin-top: 2px;
    }
    .report-name {
      font-size: 15px;
      font-weight: 800;
      color: #292524;
      margin-top: 6px;
    }
    .report-sub {
      font-size: 11px;
      color: #a8a29e;
      font-family: monospace;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #78716c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e7e5e4;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #a8a29e;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="academy-title">${academy}</h1>
      ${address || phone ? `<div class="academy-sub">${address} ${phone ? `| Contact: ${phone}` : ''}</div>` : ''}
      <div class="report-name">${opts.title}</div>
      <div class="report-sub">${opts.subtitle}</div>
    </div>
    <div class="meta-box">
      <div><strong>Generated:</strong> ${now}</div>
      <div><strong>Status:</strong> Official Record</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${columnsHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  ${summaryHtml}

  <div class="footer">
    <span>${academy} Management System</span>
    <span>Document: ${opts.filename}.pdf</span>
  </div>
</body>
</html>`;

  // 1. Android Native WebView: Print / Save to PDF
  if ((window as any).AndroidBridge?.printDocument) {
    (window as any).AndroidBridge.printDocument(fullHtml, opts.filename);
    return;
  }

  // 2. Desktop / Browser: Create invisible iframe and trigger print
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(fullHtml);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 250);
}
