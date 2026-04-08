import type { ReactNode } from "react"

interface ConfigSectionProps {
  title: string
  children: ReactNode
}

export function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        border: "1px solid #e9ecef"
      }}
    >
      <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#333", marginTop: 0 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
