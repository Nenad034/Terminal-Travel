import RegisterTab from '@/components/RegisterTab';
import AiChatBox from '@/components/AiChatBox';


// Dizajn dok. §6c.0 (dopuna 25.8.2026, na zahtev vlasnika: "ko zeli da se fokusira samo na rad
// u ai agentu... kao ovde sada u VS Code") — "Fokus" režim, otvoren klikom na ikonicu u
// dokovanom AI chat-u (RightPanel.tsx). Ista `AiChatBox` komponenta kao dokovan prikaz — samo
// `fokus` prop menja ponašanje (bez auto-čitanja `#tt-main-content`, jer je ona SAMA taj
// sadržaj, M15 spec §6.5.1), zauzima ceo centralni prostor umesto ~40% visine desnog panela.
export default function AiAsistentFokusPage() {
  return (
    <div className="flex h-full flex-col p-6">
      <RegisterTab label="AI asistent" />
      <div className="min-h-0 flex-1">
        <AiChatBox fokus />
      </div>
    </div>
  );
}
