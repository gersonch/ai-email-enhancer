export function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#333" }}>
          AI Email Enhancer
        </h1>
        <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
          Configuración
        </p>
      </div>
    </div>
  )
}
