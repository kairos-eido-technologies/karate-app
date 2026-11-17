interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  if (totalItems === 0) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between pt-4 border-t flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs font-mono font-medium" style={{ color: 'var(--muted-foreground)' }}>
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          ← Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (currentPage <= 3) {
            page = i + 1;
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = currentPage - 2 + i;
          }

          const isActive = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className="h-8 w-8 rounded-lg text-xs font-bold border cursor-pointer transition active:scale-95"
              style={{
                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--foreground)',
              }}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold border cursor-pointer transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
