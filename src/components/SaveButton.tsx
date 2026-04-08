interface SaveButtonProps {
  saved: boolean
  onClick: () => void
}

export function SaveButton({ saved, onClick }: SaveButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px",
        border: "none",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: saved ? "#28a745" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        transition: "all 0.2s",
        boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)"
      }}
    >
      {saved ? "✓ Guardado" : "💾 Guardar Configuración"}
    </button>
  )
}
