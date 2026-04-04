"use client";

export function BuildingPanel({ channel, onClose }: { channel: any; onClose: () => void }) {
  return (
    <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10, background: "rgba(0,0,0,0.8)", color: "white", padding: 20, borderRadius: 12, width: 300 }}>
      <button onClick={onClose} style={{ float: "right", background: "none", border: "none", color: "white", fontSize: 20 }}>✕</button>
      <h2>{channel.title}</h2>
      <p><strong>Handle:</strong> {channel.handle}</p>
      <p><strong>Subscribers:</strong> {channel.subscriberCount?.toLocaleString()}</p>
      <p><strong>Videos:</strong> {channel.videoCount?.toLocaleString()}</p>
      <p><strong>Niche:</strong> {channel.niche}</p>
      {channel.lastUploadDate && <p><strong>Last upload:</strong> {new Date(channel.lastUploadDate).toLocaleDateString()}</p>}
    </div>
  );
}
