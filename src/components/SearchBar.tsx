"use client";

import { useState } from "react";

export function SearchBar({ onSelect }: { onSelect: (channel: any) => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.channel) onSelect(data.channel);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, background: "rgba(0,0,0,0.7)", padding: 10, borderRadius: 8 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search YouTube channel (e.g., @MrBeast)"
        style={{ padding: 8, width: 250, marginRight: 8 }}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "..." : "Search"}
      </button>
    </div>
  );
}
