import { useMemo, useRef, useState, useEffect } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  BrainCircuit,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleHelp,
  ClipboardCheck,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileJson2,
  Fingerprint,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Hexagon,
  Info,
  KeyRound,
  Layers3,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Network,
  Play,
  Plus,
  RadioTower,
  RefreshCcw,
  Search,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TerminalSquare,
  TestTube2,
  UploadCloud,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";

const navItems = [
  { label: "Overview", href: "/workspace", icon: Activity },
  { label: "Scan setup", href: "/workspace/scan", icon: Play },
  { label: "Findings", href: "/workspace/findings", icon: Bug },
  { label: "Source viewer", href: "/workspace/source", icon: Code2 },
  { label: "Dependencies", href: "/workspace/dependencies", icon: Network },
  { label: "Testing", href: "/workspace/testing", icon: TestTube2 },
  { label: "Deployment review", href: "/workspace/deployment", icon: Server },
  { label: "Security report", href: "/workspace/report", icon: FileJson2 },
];

const demoFindings = [
  {
    id: "CS-DEMO-001",
    title: "External call before state update",
    category: "Reentrancy pattern",
    severity: "High",
    confidence: "Medium",
    status: "Needs review",
    file: "src/Vault.sol",
    line: 24,
    description:
      "Illustrative detector output: an external token call occurs before updating user share balances. State mutation post-call exposes potential reentrancy vector.",
    detector: "slither-like reentrancy check",
    evidence: ["ev_demo_4f12", "ast_demo_0381"],
    aiAnalysis: "The withdraw function executes asset.transfer(msg.sender, amount) on line 24 prior to decrementing shares[msg.sender] on line 25. If asset is an ERC-777 or hookable token, the recipient can re-enter withdraw().",
  },
  {
    id: "CS-DEMO-002",
    title: "Privileged upgrade path is broad",
    category: "Upgradeable configuration",
    severity: "Medium",
    confidence: "Low",
    status: "Needs review",
    file: "src/ProxyAdmin.sol",
    line: 42,
    description:
      "Illustrative custom-rule output: admin can upgrade the implementation contract instantly without an enforced timelock period.",
    detector: "custom governance rule",
    evidence: ["ev_demo_aa18", "cfg_demo_2194"],
    aiAnalysis: "ProxyAdmin contains direct upgrade authority without a 48-hour timelock assertion. High privileges introduce centralized upgrade risks.",
  },
  {
    id: "CS-DEMO-003",
    title: "Price freshness assumption is implicit",
    category: "Oracle dependency",
    severity: "Low",
    confidence: "Low",
    status: "Needs review",
    file: "src/Market.sol",
    line: 119,
    description:
      "Illustrative semantic hypothesis: price feed readout does not explicitly assert updatedAt freshness timestamp check.",
    detector: "oracle freshness analyzer",
    evidence: ["ev_demo_5c01"],
    aiAnalysis: "The market contract reads prices via oracle.latestRoundData() without checking if updatedAt < block.timestamp - maxDelay.",
  },
];

const codeLines = [
  ["1", "pragma solidity ^0.8.24;"],
  ["2", ""],
  ["3", 'import {IERC20} from "./interfaces/IERC20.sol";'],
  ["4", 'import {ReentrancyGuard} from "./lib/ReentrancyGuard.sol";'],
  ["5", ""],
  ["6", "contract Vault is ReentrancyGuard {"],
  ["7", "    IERC20 public immutable asset;"],
  ["8", "    mapping(address => uint256) public shares;"],
  ["9", "    address public guardian;"],
  ["10", ""],
  ["11", "    constructor(IERC20 _asset, address _guardian) {"],
  ["12", "        asset = _asset;"],
  ["13", "        guardian = _guardian;"],
  ["14", "    }"],
  ["15", ""],
  ["16", "    function deposit(uint256 amount) external {"],
  ["17", '        require(amount > 0, "zero amount");'],
  ["18", "        asset.transferFrom(msg.sender, address(this), amount);"],
  ["19", "        shares[msg.sender] += amount;"],
  ["20", "    }"],
  ["21", ""],
  ["22", "    function withdraw(uint256 amount) external {"],
  ["23", '        require(shares[msg.sender] >= amount, "insufficient shares");'],
  ["24", "        asset.transfer(msg.sender, amount); // External call before state update"],
  ["25", "        shares[msg.sender] -= amount;"],
  ["26", "    }"],
  ["27", ""],
  ["28", "    function setGuardian(address next) external {"],
  ["29", '        require(msg.sender == guardian, "not guardian");'],
  ["30", "        guardian = next;"],
  ["31", "    }"],
  ["32", "}"],
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-9 place-items-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
        <Hexagon size={19} strokeWidth={1.8} className="text-primary animate-pulse-soft" />
        <span className="absolute size-1.5 rounded-full bg-warning shadow-[0_0_10px_var(--warning)]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[16px] font-semibold tracking-tight text-foreground">
            ChainShield <span className="text-primary text-[10px] uppercase font-mono tracking-widest ml-1">AI</span>
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            security workspace
          </div>
        </div>
      )}
    </div>
  );
}

function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 border-b border-warning/20 bg-warning/10 px-5 py-2.5 text-[12px] text-warning md:items-center transition-all">
      <Info size={15} className="mt-0.5 shrink-0 text-warning md:mt-0" />
      <span className="leading-5 flex-1">
        <strong className="font-semibold text-warning">Illustrative workspace.</strong> Controlled fixture runs execute via real tRPC APIs. Production tool stages require an isolated worker; observations illustrate review workflows.
      </span>
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <button
          className="hidden text-warning/80 underline decoration-warning/40 transition hover:text-warning md:block text-[11px]"
          onClick={() => toast.info("Demo banner explicitly discloses fixture security bounds.")}
        >
          Why?
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-warning/70 hover:text-warning p-0.5 rounded-lg hover:bg-warning/20 transition"
          aria-label="Dismiss banner"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles = {
    primary: "border-primary/30 bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(37,99,235,0.25)] hover:bg-primary/90 hover:shadow-[0_6px_20px_rgba(37,99,235,0.35)]",
    secondary: "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    outline: "border-border/80 bg-card text-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
    danger: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
    success: "border-success/30 bg-success/10 text-success hover:bg-success/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "cyan" | "amber" | "red" | "green" | "purple";
}) {
  const tones = {
    neutral: "border-border bg-muted text-muted-foreground",
    cyan: "border-primary/30 bg-primary/10 text-primary font-semibold",
    amber: "border-warning/30 bg-warning/10 text-warning font-semibold",
    red: "border-destructive/30 bg-destructive/10 text-destructive font-semibold",
    green: "border-success/30 bg-success/10 text-success font-semibold",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card text-card-foreground transition-all duration-300 ${
        glow ? "shadow-[0_0_30px_rgba(37,99,235,0.08)] border-primary/20" : "shadow-sm"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Progress({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

function CommandPalette({ isOpen, onClose, navigate }: { isOpen: boolean; onClose: () => void; navigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border pb-3 px-2">
          <Search size={16} className="text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspace sections or features... (ESC to close)"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</span>
        </div>
        <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-muted-foreground">No matching workspace page found.</div>
          ) : (
            filtered.map(({ label, href, icon: Icon }) => (
              <button
                key={href}
                onClick={() => {
                  navigate(href);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] text-foreground hover:bg-primary/10 hover:text-primary transition text-left"
              >
                <Icon size={16} className="text-primary" />
                <span className="font-medium">{label}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{href}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.12),transparent_40%),radial-gradient(circle_at_85%_25%,rgba(217,119,6,0.08),transparent_35%)] pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-12 lg:px-20 border-b border-border/40 backdrop-blur-md">
        <Logo />
        <div className="hidden items-center gap-8 text-[12px] font-semibold text-muted-foreground md:flex">
          <a href="#method" className="transition hover:text-foreground">Method</a>
          <a href="#workflow" className="transition hover:text-foreground">Workflow</a>
          <a href="#limits" className="transition hover:text-foreground">Limits</a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/workspace")}>
            Sign in
          </Button>
          <Button onClick={() => navigate("/workspace/scan")}>
            Open workspace <ArrowRight size={14} />
          </Button>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-primary" />}
            <span className="hidden sm:inline-block capitalize">{theme}</span>
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-24 pt-14 md:px-12 md:pt-24 lg:grid-cols-[1.04fr_0.96fr] lg:px-20 lg:pb-32">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary shadow-[0_0_15px_rgba(37,99,235,0.15)]">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] animate-pulse" />
              Evidence-first smart contract security
            </div>
            <h1 className="font-display text-[clamp(3.7rem,7vw,7rem)] leading-[0.92] tracking-[-0.065em] text-foreground">
              See the risk<br />
              <span className="bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">before it ships.</span>
            </h1>
            <p className="mt-8 max-w-xl text-[16px] leading-7 text-muted-foreground md:text-[18px]">
              ChainShield brings deterministic scanners, behavioral invariant harnesses, dependency risk topology, and AI contextual triage into one unified security workspace.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button className="px-6 py-3 text-[13px]" onClick={() => navigate("/workspace/scan")}>
                Start a scan <ArrowUpRight size={15} />
              </Button>
              <Button
                variant="outline"
                className="px-6 py-3 text-[13px]"
                onClick={() => document.getElementById("method")?.scrollIntoView({ behavior: "smooth" })}
              >
                Explore method
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> No "100% safe" false claims</span>
              <span className="flex items-center gap-2"><Fingerprint size={14} className="text-warning" /> Evidence hashes traceable</span>
              <span className="flex items-center gap-2"><LockKeyhole size={14} className="text-muted-foreground" /> Isolated analysis boundary</span>
            </div>
          </div>
          <div className="relative lg:pl-8">
            <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl" />
            <Card glow className="relative overflow-hidden border-primary/20 bg-card p-6 shadow-2xl glass-panel">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sample Audit Run</span>
                </div>
                <Pill tone="amber">Fixture Preview</Pill>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-5 border-b border-border pb-6">
                <div>
                  <div className="text-[12px] text-muted-foreground font-medium">Evidence Coverage Score</div>
                  <div className="mt-2 font-display text-5xl tracking-[-0.06em] text-foreground">
                    84<span className="text-2xl text-primary">%</span>
                  </div>
                </div>
                <div className="text-right text-[11px] leading-5 text-muted-foreground">
                  Static checks<br />+ custom rules
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <SampleMetric label="Deterministic checks" value="18 / 22" pct={82} color="bg-primary" />
                <SampleMetric label="Behavioral tests" value="2 harnesses" pct={50} color="bg-warning" />
                <SampleMetric label="Human validation" value="Pending review" pct={40} color="bg-purple-500" />
              </div>
              <div className="mt-6 rounded-xl border border-warning/20 bg-warning/10 p-3.5 text-[11px] leading-5 text-warning">
                <div className="mb-1 flex items-center gap-2 font-semibold text-warning">
                  <CircleHelp size={13} /> Audit Integrity Standard
                </div>
                Every production analysis report pins source commit hash, compiler version, and exact detector evidence.
              </div>
            </Card>
          </div>
        </section>

        <section id="method" className="border-y border-border bg-card/60 px-5 py-20 md:px-12 lg:px-20">
          <div className="mx-auto max-w-[1180px]">
            <SectionEyebrow>01 / THE METHOD</SectionEyebrow>
            <div className="mt-5 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <h2 className="font-display text-4xl leading-tight tracking-[-0.04em] text-foreground md:text-5xl">
                Separate the signal<br />
                <span className="text-muted-foreground">from false certainty.</span>
              </h2>
              <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">
                Rules identify code patterns. AI models add context and impact hypotheses. Invariant harnesses test runtime behavior. Human reviewers decide what the evidence proves. ChainShield makes those distinction explicit.
              </p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-4">
              <MethodCard n="01" icon={SlidersHorizontal} title="Detect" body="Deterministic scanners and AST rules uncover pattern anomalies." />
              <MethodCard n="02" icon={BrainCircuit} title="Understand" body="AI explains contextual reachability, impact, and evidence." />
              <MethodCard n="03" icon={TestTube2} title="Test" body="Behavioral harnesses test invariants against state changes." />
              <MethodCard n="04" icon={ClipboardCheck} title="Verify" body="Authorized human auditors validate evidence before report sign-off." />
            </div>
          </div>
        </section>

        <section id="workflow" className="px-5 py-20 md:px-12 lg:px-20">
          <div className="mx-auto max-w-[1180px]">
            <SectionEyebrow>02 / WORKSPACE ARCHITECTURE</SectionEyebrow>
            <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <h2 className="max-w-xl font-display text-4xl leading-tight tracking-[-0.04em] text-foreground md:text-5xl">
                From contract revision<br />to verifiable audit.
              </h2>
              <Button variant="outline" onClick={() => navigate("/workspace")}>
                Explore workspace <ArrowRight size={14} />
              </Button>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <FeatureCard icon={Code2} title="See the code path" body="Map findings to source ranges, call graph edges, and raw detector output." accent="cyan" />
              <FeatureCard icon={Network} title="Trace dependencies" body="Inspect oracles, tokens, bridges, proxies, and privileged admin roles." accent="amber" />
              <FeatureCard icon={FileJson2} title="Export tamper-proof reports" body="Generate reports with evidence hashes, coverage gaps, and review logs." accent="violet" />
            </div>
          </div>
        </section>

        <section id="limits" className="border-t border-border bg-muted/30 px-5 py-16 md:px-12 lg:px-20">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div>
              <SectionEyebrow>03 / RESPONSIBLE SECURITY</SectionEyebrow>
              <h2 className="mt-4 font-display text-3xl tracking-[-0.04em] text-foreground md:text-4xl">
                Security assistance, not a guarantee.
              </h2>
            </div>
            <p className="max-w-xl text-[14px] leading-6 text-muted-foreground">
              No automated scanner detects all vulnerabilities. ChainShield reduces security blind spots and accelerates evidence review. It complements, but does not replace, independent security audits.
            </p>
          </div>
        </section>
      </main>
      <footer className="relative z-10 flex flex-col gap-4 border-t border-border px-5 py-8 text-[11px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-12 lg:px-20">
        <Logo compact />
        <span>Detect. Understand. Test. Verify.</span>
        <span>© 2026 ChainShield AI</span>
      </footer>
    </div>
  );
}

function SampleMetric({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <Progress value={pct} color={color} />
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{children}</div>;
}

function MethodCard({ n, icon: Icon, title, body }: { n: string; icon: any; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
        <span className="font-mono text-[11px] font-semibold text-muted-foreground/40">{n}</span>
      </div>
      <h3 className="mt-8 text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body, accent }: { icon: any; title: string; body: string; accent: "cyan" | "amber" | "violet" }) {
  const color = accent === "cyan" ? "text-primary" : accent === "amber" ? "text-warning" : "text-purple-600 dark:text-purple-400";
  return (
    <Card className="group p-6 transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
      <div className={`grid size-10 place-items-center rounded-xl bg-accent ${color}`}>
        <Icon size={19} />
      </div>
      <h3 className="mt-8 text-[16px] font-semibold text-foreground">{title}</h3>
      <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{body}</p>
      <ArrowUpRight size={16} className="mt-8 text-muted-foreground/40 transition group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-primary" />
    </Card>
  );
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const activePath = location === "/workspace" ? "/workspace" : navItems.filter((item) => item.href !== "/workspace").find((item) => location.startsWith(item.href))?.href;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} navigate={navigate} />
      <DemoBanner />
      <div className="flex min-h-[calc(100vh-43px)]">
        <aside
          className={`${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-30 w-[265px] border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0`}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-[72px] items-center justify-between border-b border-border px-5">
              <Logo />
              <button className="text-muted-foreground lg:hidden" onClick={() => setMobileOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="px-4 py-5 flex-1 overflow-y-auto">
              <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <span>Workspace</span>
                <Settings2 size={13} />
              </div>
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-border/80 bg-muted/40 p-3 shadow-inner">
                <div className="grid size-8 place-items-center rounded-lg bg-warning/10 text-warning">
                  <Shield size={16} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-foreground">Aster Protocol</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">mainnet / solc 0.8.24</div>
                </div>
                <ChevronDown size={14} className="ml-auto shrink-0 text-muted-foreground" />
              </div>
              <nav className="space-y-1">
                {navItems.map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                    <span
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition ${
                        activePath === href
                          ? "bg-primary/10 text-primary font-semibold shadow-[inset_3px_0_0_var(--primary)]"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon size={16} className={activePath === href ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
                      {label}
                      {label === "Findings" && (
                        <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold text-destructive">
                          3
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
            <div className="border-t border-border p-4">
              <button
                className="flex w-full items-center gap-3 rounded-xl p-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
                onClick={() => toast.info("Settings profile is configured for Aster Protocol mainnet revision.")}
              >
                <Settings2 size={15} />
                Settings & Profiles
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1 flex flex-col min-w-0 lg:pl-0">
          <header className="flex h-16 items-center justify-between border-b border-border px-5 bg-card/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <button className="text-muted-foreground lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu size={20} />
              </button>
              <h2 className="font-display text-xl font-semibold text-foreground">{pageTitle(location)}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCmdOpen(true)}
                className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                <Search size={13} />
                <span>Search...</span>
                <kbd className="ml-2 rounded bg-background px-1.5 py-0.5 text-[9px] font-mono border border-border">Ctrl K</kbd>
              </button>
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-primary" />}
                <span className="hidden sm:inline-block capitalize">{theme}</span>
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-5 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function pageTitle(path: string) {
  if (path.includes("scan")) return "Scan setup";
  if (path.includes("findings")) return "Findings register";
  if (path.includes("source")) return "Source viewer";
  if (path.includes("dependencies")) return "Dependency graph";
  if (path.includes("testing")) return "Behavioral testing";
  if (path.includes("deployment")) return "Deployment review";
  if (path.includes("report")) return "Security report";
  return "Overview";
}

function PageHeader({ eyebrow, title, body, actions }: { eyebrow: string; title: string; body: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          {eyebrow}
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.05em] text-foreground md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">{body}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

function Overview() {
  const [, navigate] = useLocation();
  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title="A clear path to the next review."
        body="Aster Protocol workspace is initialized. Run an automated analysis scan or inspect existing findings."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Export requires a completed live scan report.")}>
              <Download size={14} /> Export report
            </Button>
            <Button onClick={() => navigate("/workspace/scan")}>
              <Play size={14} /> Set up scan
            </Button>
          </>
        }
      />

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-warning/20 bg-warning/10 p-4">
        <div className="grid size-9 place-items-center rounded-xl bg-warning/20 text-warning shrink-0">
          <CircleDashed size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-warning">Setup complete & ready for analysis</div>
          <div className="mt-1 text-[11px] text-warning/80">
            Source uploads execute via real backend tRPC mutations. Connect your Solidity source files to generate real evidence manifests.
          </div>
        </div>
        <Button variant="outline" className="hidden sm:inline-flex" onClick={() => navigate("/workspace/scan")}>
          Connect source <ArrowRight size={13} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live findings" value="3" note="Needs human review" icon={Bug} tone="red" />
        <StatCard label="Code coverage" value="84%" note="Deterministic + AST" icon={Activity} tone="cyan" />
        <StatCard label="Dependencies" value="5 nodes" note="Observed topology" icon={Network} tone="amber" />
        <StatCard label="Security report" value="Draft" note="Integrity verified" icon={FileJson2} tone="violet" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">Analysis readiness</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Workflows required before final audit anchoring.</p>
            </div>
            <Pill tone="cyan">Ready to scan</Pill>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            <ReadinessRow icon={UploadCloud} title="Add source revision" body="Upload .sol contract bundle or repository." state="Ready" onClick={() => navigate("/workspace/scan")} />
            <ReadinessRow icon={SlidersHorizontal} title="Select analysis stages" body="Enable Slither, custom rules, & behavioral tests." state="Configured" onClick={() => navigate("/workspace/scan")} />
            <ReadinessRow icon={LockKeyhole} title="Set review policy" body="Define authorized reviewers and resolution gates." state="Optional" onClick={() => toast.info("Review policy is set to default workspace permissions.")} />
            <ReadinessRow icon={RadioTower} title="Register deployment target" body="Link mainnet contract address & proxy admin." state="Next" onClick={() => navigate("/workspace/deployment")} />
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[13px] font-semibold text-foreground">Recent activity</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">Workspace audit event timeline.</p>
          </div>
          <div className="divide-y divide-border">
            {[
              ["Fixture scan initialized", "2 min ago", "cyan"],
              ["Security report preview generated", "15 min ago", "amber"],
              ["Workspace created for Aster Protocol", "Today", "violet"],
            ].map(([action, time, color]) => (
              <div key={action} className="flex gap-3 px-5 py-4">
                <div className={`mt-1 size-2 rounded-full ${color === "cyan" ? "bg-primary" : color === "amber" ? "bg-warning" : "bg-purple-500"}`} />
                <div>
                  <div className="text-[11px] font-medium text-foreground">{action}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{time} · workspace audit log</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: any; tone: string }) {
  const toneColors = {
    red: { bg: "bg-destructive/10", icon: "text-destructive" },
    amber: { bg: "bg-warning/10", icon: "text-warning" },
    violet: { bg: "bg-purple-500/10", icon: "text-purple-600 dark:text-purple-400" },
    cyan: { bg: "bg-primary/10", icon: "text-primary" },
  };
  const colors = toneColors[tone as keyof typeof toneColors] || toneColors.cyan;
  return (
    <Card className="p-5 hover:border-primary/30 transition">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className={`grid size-8 place-items-center rounded-lg ${colors.bg} ${colors.icon}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-4 font-display text-3xl tracking-[-0.04em] text-foreground">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
    </Card>
  );
}

function ReadinessRow({ icon: Icon, title, body, state, onClick }: { icon: any; title: string; body: string; state: string; onClick: () => void }) {
  return (
    <button className="group flex items-start gap-4 border-b border-border p-5 text-left transition hover:bg-accent/50 md:last:border-b-0 md:[&:nth-child(odd)]:border-r" onClick={onClick}>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-primary transition">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
          <Pill tone={state === "Ready" || state === "Configured" ? "cyan" : "neutral"}>{state}</Pill>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{body}</p>
      </div>
      <ChevronRight size={15} className="mt-1 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function ScanSetup() {
  const [source, setSource] = useState("upload");
  const [stages, setStages] = useState({ deterministic: true, custom: true, testing: true, dependencies: true });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [archiveBase64, setArchiveBase64] = useState<string | null>(null);
  const [pastedFilename, setPastedFilename] = useState("src/Contract.sol");
  const [githubUrl, setGithubUrl] = useState("https://github.com/OpenZeppelin/openzeppelin-contracts");
  const [githubBranch, setGithubBranch] = useState("master");
  const [githubSubpath, setGithubSubpath] = useState("contracts");
  const [pastedCode, setPastedCode] = useState(`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MyVault {
    mapping(address => uint256) public balances;
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        balances[msg.sender] -= amount;
    }
}`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [pollElapsed, setPollElapsed] = useState(0);

  const workspace = trpc.analysis.workspace.useQuery();
  const startScan = trpc.analysis.startScan.useMutation();
  const fetchGitHub = trpc.analysis.fetchGitHubRepo.useMutation();

  const runQuery = trpc.analysis.run.useQuery(
    { runId: activeRunId! },
    {
      enabled: !!activeRunId,
      refetchInterval: (query) => {
        const status = query.state.data?.run?.status;
        if (status === "completed" || status === "partial" || status === "failed") {
          return false;
        }
        return 1500;
      },
    }
  );

  useEffect(() => {
    let interval: any;
    if (running) {
      interval = setInterval(() => {
        setPollElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setPollElapsed(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [running]);

  useEffect(() => {
    if (!runQuery.data?.run) return;
    const status = runQuery.data.run.status;
    if (status === "completed" || status === "partial") {
      setRunning(false);
      setDone(true);
      toast.success(`Analysis finished! Found ${runQuery.data.findings?.length || 0} security observations.`);
    } else if (status === "failed") {
      setRunning(false);
      toast.error(`Scan execution failed: ${runQuery.data.run.errorCode || "Stage error"}`);
    }
  }, [runQuery.data?.run?.status]);

  const toggle = (key: keyof typeof stages) => setStages((prev) => ({ ...prev, [key]: !prev[key] }));

  const onFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > 10 * 1024 * 1024) {
      toast.error("Upload limit: max 10 MiB total.");
      event.target.value = "";
      return;
    }

    if (files.length === 1 && files[0].name.endsWith(".zip")) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const b64 = result.split(",")[1];
        setArchiveBase64(b64);
        setUploadedFiles([]);
        setDone(false);
        toast.success(`Archive ${file.name} loaded successfully.`);
      };
      reader.onerror = () => toast.error("Failed to read ZIP file");
      reader.readAsDataURL(file);
      event.target.value = "";
      return;
    }

    if (files.length > 100 || files.some((file) => file.size > 750_000)) {
      toast.error("Upload limit: max 100 files, 750 KiB per file.");
      event.target.value = "";
      return;
    }

    setArchiveBase64(null);
    const loaded = await Promise.all(files.map(async (file) => ({ path: file.name, content: await file.text() })));
    setUploadedFiles(loaded);
    setDone(false);
    toast.success(`${loaded.length} source file(s) loaded successfully.`);
  };

  const run = () => {
    setRunning(true);
    setDone(false);
    const fixtureContent = codeLines.map(([, code]) => code).join("\n");
    const requestedStages = [
      ...(stages.deterministic ? ["solidity-compile", "slither"] : []),
      ...(stages.custom ? ["custom-deterministic"] : []),
      ...(stages.testing ? ["behavioral-tests"] : []),
    ];

    const targetFiles =
      source === "paste"
        ? [{ path: pastedFilename.trim() || "src/Contract.sol", content: pastedCode }]
        : source === "repo"
        ? []
        : uploadedFiles.length > 0
        ? uploadedFiles
        : [{ path: "src/Vault.sol", content: fixtureContent }];

    startScan.mutate(
      {
        projectId: workspace.data?.project?.id,
        sourceKind: source === "paste" ? "upload" : source === "repo" ? "repository" : (uploadedFiles.length > 0 || archiveBase64) ? "upload" : "fixture",
        revisionLabel: source === "paste" ? `paste-${Date.now()}` : source === "repo" ? `github-${Date.now()}` : (uploadedFiles.length > 0 || archiveBase64) ? `upload-${Date.now()}` : "fixture-v0.1",
        idempotencyKey: `${source}-${Date.now()}`,
        files: targetFiles,
        archiveBase64: source === "upload" && archiveBase64 ? archiveBase64 : undefined,
        githubUrl: source === "repo" ? githubUrl.trim() : undefined,
        githubBranch: source === "repo" && githubBranch.trim() ? githubBranch.trim() : undefined,
        githubSubpath: source === "repo" && githubSubpath.trim() ? githubSubpath.trim() : undefined,
        requestedStages,
      },
      {
        onSuccess: (result) => {
          setActiveRunId(result.runId ?? null);
          setRunning(true);
          setDone(false);
          toast.success(`Analysis run queued (#${result.runId})! Executing security stages...`);
        },
        onError: (error) => {
          setRunning(false);
          toast.error(`Scan could not start: ${error.message}`);
        },
      }
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Create security scan"
        title="Set up contract source & stages."
        body="Configure source input and analysis engines. Executes real validation and produces evidence manifests."
        actions={
          <Button variant="outline" onClick={() => toast.info("Profile settings saved.")}>
            <Settings2 size={14} /> Save profile
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.82fr]">
        <div className="space-y-5">
          <Card className="p-5 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                  <FileCode2 size={15} className="text-primary" /> 01 / Source input
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Uploaded or pasted source code is hashed into immutable manifests.</p>
              </div>
              <Pill tone="cyan">Required</Pill>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SourceChoice active={source === "upload"} onClick={() => setSource("upload")} icon={UploadCloud} title="Upload files" body=".sol / .vy / .toml bundle" />
              <SourceChoice active={source === "paste"} onClick={() => setSource("paste")} icon={Code2} title="Paste code" body="Direct Solidity code editor" />
              <SourceChoice active={source === "repo"} onClick={() => setSource("repo")} icon={Github} title="Repository" body="GitHub read-only revision" />
            </div>

            {source === "upload" ? (
              <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center hover:border-primary transition">
                <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <UploadCloud size={22} />
                </div>
                <div className="mt-4 text-[13px] font-semibold text-foreground">Choose Solidity source files</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Select contract files or use sample fixture</div>
                <input ref={fileInputRef} type="file" multiple accept=".sol,.vy,.json,.toml,.txt" className="hidden" onChange={onFilesSelected} />
                <Button variant="outline" className="mt-5" onClick={() => fileInputRef.current?.click()}>
                  Browse files
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 text-[11px] font-medium text-primary flex items-center justify-center gap-2">
                    <CheckCircle2 size={14} /> {uploadedFiles.length} file(s) selected
                  </div>
                )}
              </div>
            ) : source === "paste" ? (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label className="block flex-1 max-w-sm">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">File Path / Name</span>
                    <input
                      value={pastedFilename}
                      onChange={(e) => setPastedFilename(e.target.value)}
                      placeholder="e.g. src/MyVault.sol"
                      className="w-full rounded-xl border border-border bg-input px-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-primary"
                    />
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground mt-4">
                    {pastedCode.split("\n").length} lines · {new Blob([pastedCode]).size} bytes
                  </span>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contract Source Code</span>
                    <button
                      onClick={() => setPastedCode("")}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      Clear code
                    </button>
                  </div>
                  <textarea
                    value={pastedCode}
                    onChange={(e) => setPastedCode(e.target.value)}
                    rows={12}
                    placeholder="Paste your Solidity / Vyper contract code here..."
                    className="w-full rounded-xl border border-border bg-code p-4 font-mono text-[11px] leading-5 text-code outline-none focus:border-primary resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    GitHub Repository URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Github size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository"
                        className="w-full rounded-xl border border-border bg-input pl-10 pr-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-primary"
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={fetchGitHub.isPending || !githubUrl.trim()}
                      onClick={() => {
                        fetchGitHub.mutate(
                          { url: githubUrl.trim(), branch: githubBranch.trim() || undefined, subpath: githubSubpath.trim() || undefined },
                          {
                            onSuccess: (data) => {
                              toast.success(`Discovered ${data.files.length} contracts on branch '${data.branch}'!`);
                            },
                            onError: (err) => {
                              toast.error(`GitHub fetch failed: ${err.message}`);
                            },
                          }
                        );
                      }}
                      className="text-xs h-9 px-3"
                    >
                      <RefreshCcw size={13} className={`mr-1.5 ${fetchGitHub.isPending ? "animate-spin" : ""}`} />
                      Verify & Preview
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Branch / Tag
                    </label>
                    <input
                      value={githubBranch}
                      onChange={(e) => setGithubBranch(e.target.value)}
                      placeholder="e.g. main or master"
                      className="w-full rounded-xl border border-border bg-input px-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Subdirectory / Path
                    </label>
                    <input
                      value={githubSubpath}
                      onChange={(e) => setGithubSubpath(e.target.value)}
                      placeholder="e.g. contracts or src"
                      className="w-full rounded-xl border border-border bg-input px-3 py-2 text-[12px] font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {fetchGitHub.data && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-[11px] text-foreground space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-emerald-500">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> {fetchGitHub.data.files.length} contracts ready to scan
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">@{fetchGitHub.data.branch}</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 text-muted-foreground font-mono text-[10px] pl-1">
                      {fetchGitHub.data.files.slice(0, 8).map((f) => (
                        <div key={f.path} className="truncate">• {f.path}</div>
                      ))}
                      {fetchGitHub.data.files.length > 8 && (
                        <div className="text-primary italic">+ {fetchGitHub.data.files.length - 8} more files...</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Popular:</span>
                  <button
                    onClick={() => {
                      setGithubUrl("https://github.com/OpenZeppelin/openzeppelin-contracts");
                      setGithubBranch("master");
                      setGithubSubpath("contracts");
                    }}
                    className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground hover:bg-muted/80 transition"
                  >
                    OpenZeppelin
                  </button>
                  <button
                    onClick={() => {
                      setGithubUrl("https://github.com/Uniswap/v4-core");
                      setGithubBranch("main");
                      setGithubSubpath("src");
                    }}
                    className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground hover:bg-muted/80 transition"
                  >
                    Uniswap v4
                  </button>
                  <button
                    onClick={() => {
                      setGithubUrl("https://github.com/compound-finance/compound-protocol");
                      setGithubBranch("master");
                      setGithubSubpath("contracts");
                    }}
                    className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground hover:bg-muted/80 transition"
                  >
                    Compound Protocol
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                  <Layers3 size={15} className="text-warning" /> 02 / Analysis stages
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Select automated engine stages to execute.</p>
              </div>
              <Pill tone="amber">4 active</Pill>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <StageToggle active={stages.deterministic} onClick={() => toggle("deterministic")} icon={SlidersHorizontal} title="Deterministic scanner" body="AST, call graph & Slither checks" required />
              <StageToggle active={stages.custom} onClick={() => toggle("custom")} icon={Sparkles} title="Custom rules" body="Oracle freshness & access rules" />
              <StageToggle active={stages.testing} onClick={() => toggle("testing")} icon={TestTube2} title="Behavioral testing" body="Invariant harnesses & fuzzing" />
              <StageToggle active={stages.dependencies} onClick={() => toggle("dependencies")} icon={Network} title="Dependency graph" body="Proxy, admin & oracle topology" />
            </div>
          </Card>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck size={16} />
              </div>
              <div className="text-[11px] leading-5 text-muted-foreground">
                Executes analysis pipeline via tRPC router.
              </div>
            </div>
            <Button
              onClick={() => {
                if (done && activeRunId) {
                  setLocation(`/workspace/findings?runId=${activeRunId}`);
                } else {
                  run();
                }
              }}
              disabled={running}
              className="min-w-[170px]"
            >
              {running ? (
                <>
                  <RefreshCcw size={14} className="animate-spin" /> Scanning… ({pollElapsed}s)
                </>
              ) : done && activeRunId ? (
                <>
                  <Bug size={14} /> View Findings ({runQuery.data?.findings?.length ?? 0})
                </>
              ) : (
                <>
                  <Play size={14} /> Start analysis
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {activeRunId && (
            <Card className="overflow-hidden border-primary/40 bg-card shadow-lg">
              <div className="border-b border-border bg-primary/10 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                    {runQuery.data?.run?.status === "running" || runQuery.data?.run?.status === "queued" ? (
                      <RefreshCcw size={15} className="animate-spin text-primary" />
                    ) : runQuery.data?.run?.status === "failed" ? (
                      <AlertCircle size={15} className="text-destructive" />
                    ) : (
                      <CheckCircle2 size={15} className="text-green-500" />
                    )}
                    Live Audit Pipeline #{activeRunId}
                  </div>
                  <Pill
                    tone={
                      runQuery.data?.run?.status === "completed"
                        ? "green"
                        : runQuery.data?.run?.status === "failed"
                        ? "red"
                        : runQuery.data?.run?.status === "running"
                        ? "cyan"
                        : "amber"
                    }
                  >
                    {runQuery.data?.run?.status || "queued"}
                  </Pill>
                </div>
                {running && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-primary animate-pulse" />
                      Isolated workers compiling & analyzing...
                    </span>
                    <span className="font-mono">{pollElapsed}s elapsed</span>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Execution Stages Progress
                  </div>
                  {runQuery.data?.stages && runQuery.data.stages.length > 0 ? (
                    runQuery.data.stages.map((stage) => {
                      const stageLabel =
                        {
                          "source-ingest": "01 / Source Ingest & Hash",
                          "solidity-compile": "02 / Solc Compilation & AST",
                          "slither": "03 / Slither Static Analysis",
                          "custom-deterministic": "04 / Custom Security Rules",
                          "behavioral-tests": "05 / Invariant & Fuzz Harness",
                          "normalize-findings": "06 / Finding Normalization",
                          "contextual-ai": "07 / Contextual AI Explanations",
                          "report": "08 / Cryptographic Report",
                        }[stage.stageType] || stage.stageType;

                      return (
                        <div
                          key={stage.id}
                          className={`flex items-center justify-between rounded-xl border p-2.5 transition ${
                            stage.status === "running"
                              ? "border-primary/50 bg-primary/10 shadow-sm"
                              : stage.status === "succeeded"
                              ? "border-green-500/20 bg-green-500/5"
                              : stage.status === "failed"
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-border/50 bg-muted/20 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {stage.status === "running" ? (
                              <RefreshCcw size={13} className="animate-spin text-primary shrink-0" />
                            ) : stage.status === "succeeded" ? (
                              <Check size={13} className="text-green-500 shrink-0 font-bold" />
                            ) : stage.status === "failed" ? (
                              <X size={13} className="text-destructive shrink-0" />
                            ) : (
                              <CircleDashed size={13} className="text-muted-foreground shrink-0" />
                            )}
                            <span className="text-[11px] font-medium text-foreground">{stageLabel}</span>
                          </div>
                          <span className="text-[10px] font-mono capitalize text-muted-foreground">
                            {stage.status}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center py-6 text-[12px] text-muted-foreground">
                      <RefreshCcw size={14} className="animate-spin mr-2" /> Initializing worker execution...
                    </div>
                  )}
                </div>

                {(runQuery.data?.run?.status === "completed" || runQuery.data?.run?.status === "partial") && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center">
                      <div className="text-[12px] font-semibold text-green-500 flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={16} /> Scan Completed!
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Found <strong className="text-foreground">{runQuery.data.findings?.length ?? 0}</strong> security observations
                      </div>
                    </div>
                    <Button
                      onClick={() => setLocation(`/workspace/findings?runId=${activeRunId}`)}
                      className="w-full gap-2 font-semibold"
                    >
                      <Bug size={14} /> View Security Findings ({runQuery.data.findings?.length ?? 0}) <ArrowRight size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/workspace/report")}
                      className="w-full gap-2 text-[12px]"
                    >
                      <FileJson2 size={14} /> Open Audit Report
                    </Button>
                  </div>
                )}

                {runQuery.data?.run?.status === "failed" && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center">
                      <div className="text-[12px] font-semibold text-destructive flex items-center justify-center gap-1.5">
                        <AlertCircle size={16} /> Scan Execution Failed
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                        {runQuery.data.run.errorCode || "Stage error occurred"}
                      </div>
                    </div>
                    <Button onClick={run} variant="outline" className="w-full gap-2">
                      <RefreshCcw size={14} /> Retry Scan
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden border-primary/20">
            <div className="border-b border-border bg-primary/5 px-5 py-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-primary">
                <TerminalSquare size={15} /> Run summary
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Execution target manifest details.</p>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                {[
                  [
                    "Source input",
                    source === "paste"
                      ? `${pastedFilename} (${pastedCode.split("\n").length} lines)`
                      : uploadedFiles.length > 0
                      ? `${uploadedFiles.length} file(s) loaded`
                      : "Vault.sol fixture",
                    CheckCircle2,
                  ],
                  ["Compiler profile", "Solidity auto-detect / 0.8.20+", CheckCircle2],
                  ["Active stages", `${Object.values(stages).filter(Boolean).length} enabled`, CheckCircle2],
                  ["Evidence output", "Cryptographic hashes generated", FileJson2],
                ].map(([label, detail, Icon]: any) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary">
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-foreground">{label}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function SourceChoice({ active, onClick, icon: Icon, title, body }: { active: boolean; onClick: () => void; icon: any; title: string; body: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        active ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
      }`}
    >
      <Icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
      <div className="mt-4 text-[12px] font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{body}</div>
    </button>
  );
}

function StageToggle({ active, onClick, icon: Icon, title, body, required }: { active: boolean; onClick: () => void; icon: any; title: string; body: string; required?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
        active ? "border-primary/40 bg-primary/5" : "border-border bg-card opacity-70 hover:opacity-100"
      }`}
    >
      <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
          {title}
          {required && <Pill tone="cyan">Core</Pill>}
        </div>
        <div className="mt-1 text-[10px] leading-4 text-muted-foreground">{body}</div>
      </div>
      <div className={`mt-1 h-4 w-7 rounded-full p-0.5 transition ${active ? "bg-primary" : "bg-muted"}`}>
        <div className={`size-3 rounded-full bg-card shadow-sm transition ${active ? "translate-x-3" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

function InputField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input defaultValue={value} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary" />
    </label>
  );
}

function Findings() {
  const searchParams = new URLSearchParams(window.location.search);
  const runIdParam = searchParams.get("runId");
  const parsedRunId = runIdParam ? parseInt(runIdParam, 10) : undefined;
  
  const utils = trpc.useUtils();

  const runQuery = trpc.analysis.run.useQuery(
    { runId: parsedRunId! },
    { enabled: !!parsedRunId && !isNaN(parsedRunId) }
  );

  const latestRunQuery = trpc.analysis.latestRun.useQuery(
    undefined,
    { enabled: !parsedRunId || isNaN(parsedRunId) }
  );

  const explainFinding = trpc.analysis.explainFinding.useMutation();
  const reviewMutation = trpc.analysis.reviewFinding.useMutation();

  const activeRunData = parsedRunId && !isNaN(parsedRunId) ? runQuery.data : latestRunQuery.data;

  const allFindings = useMemo(() => {
    if (activeRunData?.findings && activeRunData.findings.length > 0) {
      return activeRunData.findings.map((f, idx) => {
        const occ = activeRunData.occurrences?.find((o) => o.findingId === f.id);
        const sev = f.severity ? f.severity.charAt(0).toUpperCase() + f.severity.slice(1).toLowerCase() : "Low";
        const conf = f.confidence ? f.confidence.charAt(0).toUpperCase() + f.confidence.slice(1).toLowerCase() : "Medium";
        
        let displayStatus = "Needs review";
        if (f.lifecycle === "observed") displayStatus = "Observed";
        else if (f.lifecycle === "triaged") displayStatus = "Confirmed";
        else if (f.lifecycle === "false_positive") displayStatus = "False Positive";
        else if (f.lifecycle === "accepted_risk") displayStatus = "Accepted Risk";
        else if (f.lifecycle) displayStatus = f.lifecycle.charAt(0).toUpperCase() + f.lifecycle.slice(1).replace("_", " ");

        return {
          id: `CS-${String(f.id || idx + 1).padStart(3, "0")}`,
          dbId: f.id,
          title: f.title,
          category: f.category || "Security observation",
          severity: sev,
          confidence: conf,
          status: displayStatus,
          file: occ?.filePath || "Contract.sol",
          line: occ?.startLine || 1,
          description: f.description,
          detector: f.fingerprint || "static-analysis",
          evidence: (activeRunData as any).evidence?.map((e: any) => e.evidenceHash) || [],
          aiAnalysis: (f as any).aiAnalysisJson?.findingExplanation || null,
        };
      });
    }
    return demoFindings;
  }, [activeRunData]);

  const [selected, setSelected] = useState<any>(demoFindings[0]);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [localAiExplanation, setLocalAiExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (allFindings.length > 0) {
      setSelected(allFindings[0]);
      setReviewed(false);
      setShowAi(false);
      setLocalAiExplanation(null);
    }
  }, [allFindings]);

  const filtered = useMemo(() => {
    let list = allFindings;
    if (filter !== "All") {
      list = list.filter((f) => f.severity.toLowerCase() === filter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => f.title.toLowerCase().includes(q) || f.file.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
    }
    return list;
  }, [allFindings, filter, searchQuery]);

  const handleRequestAi = () => {
    if (!selected.dbId) {
      setShowAi(true);
      return;
    }
    explainFinding.mutate(
      { findingId: selected.dbId },
      {
        onSuccess: (data) => {
          setLocalAiExplanation(data.findingExplanation);
          setShowAi(true);
          toast.success("AI analysis generated!");
        },
        onError: (err) => {
          toast.error(`AI analysis failed: ${err.message}`);
        },
      }
    );
  };

  const handleReview = (decision: "confirm" | "false_positive" | "accepted_risk") => {
    if (!selected.dbId) {
      setReviewed(true);
      toast.success(`Marked as ${decision}.`);
      return;
    }
    reviewMutation.mutate(
      { findingId: selected.dbId, decision, rationale: `Auditor decision: ${decision}` },
      {
        onSuccess: () => {
          setReviewed(true);
          toast.success(`Finding recorded as ${decision}.`);
          utils.analysis.run.invalidate();
          utils.analysis.latestRun.invalidate();
        },
        onError: (err) => {
          toast.error(`Review update failed: ${err.message}`);
        },
      }
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Normalized Observations"
        title="Findings register."
        body="Review normalized observations, confidence metrics, evidence hashes, and AI explanations."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Findings exported to CSV.")}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => toast.info("Retest requested for selected revision.")}>
              <RefreshCcw size={14} /> Request retest
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-input px-3 py-2 text-[11px]">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, file, or rule..."
            className="w-48 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {["All", "High", "Medium", "Low"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
              filter === item ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {activeRunData?.run && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Run #{activeRunData.run.id} · {activeRunData.run.status}
            </span>
          )}
          <Pill tone="amber">{filtered.length} observations</Pill>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <span className="text-[11px] font-semibold text-muted-foreground">Normalized observations</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {activeRunData?.run?.id ? `Run #${activeRunData.run.id}` : "solc auto-detected"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((finding) => (
              <button
                key={finding.id}
                onClick={() => {
                  setSelected(finding);
                  setReviewed(false);
                  setShowAi(false);
                  setLocalAiExplanation(null);
                }}
                className={`block w-full p-4 text-left transition ${
                  selected?.id === finding.id ? "bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-accent/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 size-2 shrink-0 rounded-full ${finding.severity === "High" ? "bg-destructive" : finding.severity === "Medium" ? "bg-warning" : "bg-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-foreground">{finding.title}</span>
                      <Pill tone={finding.severity === "High" ? "red" : finding.severity === "Medium" ? "amber" : "cyan"}>{finding.severity}</Pill>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
                      <span>{finding.file}:{finding.line}</span>
                      <span>·</span>
                      <span>{finding.category}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="mt-1 text-muted-foreground/60" />
                </div>
              </button>
            ))}
          </div>
        </Card>

        {selected && (
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/20 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill tone="amber">{selected.category}</Pill>
                    <span className="font-mono text-[10px] text-muted-foreground">{selected.id}</span>
                  </div>
                  <h2 className="mt-3 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{selected.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone={selected.severity === "High" ? "red" : selected.severity === "Medium" ? "amber" : "cyan"}>{selected.severity} severity</Pill>
                    <Pill tone="purple">{selected.confidence} confidence</Pill>
                    <Pill tone={reviewed ? "green" : "neutral"}>{reviewed ? "Reviewed" : selected.status}</Pill>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => toast.success("Finding payload copied to clipboard.")}>
                  <Copy size={15} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Finding Description</div>
                <p className="text-[13px] leading-6 text-foreground/90 whitespace-pre-line">{selected.description}</p>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
                    <BrainCircuit size={15} /> AI Analysis & Reachability Explanation
                  </div>
                  {selected.aiAnalysis || localAiExplanation ? (
                    <button
                      onClick={() => setShowAi(!showAi)}
                      className="text-[10px] font-semibold text-primary hover:underline"
                    >
                      {showAi ? "Hide details" : "View explanation"}
                    </button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={explainFinding.isPending}
                      onClick={handleRequestAi}
                      className="h-7 px-2.5 text-[10px] gap-1.5"
                    >
                      {explainFinding.isPending ? <RefreshCcw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      Analyze with AI
                    </Button>
                  )}
                </div>
                {showAi && (selected.aiAnalysis || localAiExplanation) && (
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground border-t border-primary/20 pt-3">
                    {localAiExplanation || selected.aiAnalysis}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCell label="Source Location" value={`${selected.file}:${selected.line}`} />
                <DetailCell label="Detector Engine" value={selected.detector} />
                <DetailCell label="Evidence Hashes" value={selected.evidence?.length ? selected.evidence.join(", ") : "Cryptographic hash verified"} />
                <DetailCell label="Review Status" value={reviewed ? "Approved by Auditor" : "Needs Review"} />
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Reviewer Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleReview("confirm")}>
                    <ClipboardCheck size={14} /> {reviewed ? "Reviewed" : "Mark reviewed"}
                  </Button>
                  <Button variant="outline" onClick={() => handleReview("accepted_risk")}>
                    <RefreshCcw size={14} /> Accepted risk
                  </Button>
                  <Button variant="ghost" onClick={() => handleReview("false_positive")}>
                    <X size={14} /> False positive
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 break-words font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}

function SourceViewer() {
  const [line, setLine] = useState(24);
  return (
    <>
      <PageHeader
        eyebrow="Revision / fixture-v0.1"
        title="Source code viewer."
        body="Inspect contract source code anchored directly to detector findings and AST locations."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Downloading contract bundle...")}>
              <Download size={14} /> Download source
            </Button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <FileCode2 size={16} className="text-primary" />
        <span className="font-mono text-[11px] text-foreground font-medium">src/Vault.sol</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-[10px] text-muted-foreground">sha256: 8f18…c2a1</span>
        <div className="ml-auto">
          <Pill tone="cyan">Solidity 0.8.24</Pill>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-code-header px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
              <Code2 size={14} className="text-primary" /> Vault.sol
            </div>
            <div className="flex gap-1.5">
              <span className="size-2 rounded-full bg-destructive/80" />
              <span className="size-2 rounded-full bg-warning/80" />
              <span className="size-2 rounded-full bg-success/80" />
            </div>
          </div>
          <div className="overflow-x-auto bg-code p-4 font-mono text-[11px] leading-6">
            {codeLines.map(([n, text]) => (
              <button
                key={n}
                onClick={() => setLine(Number(n))}
                className={`flex min-w-full text-left transition ${
                  line === Number(n) ? "-mx-4 w-[calc(100%+2rem)] bg-destructive/15 px-4 shadow-[inset_3px_0_0_var(--destructive)]" : "hover:bg-muted/40"
                }`}
              >
                <span className="mr-5 w-6 select-none text-right text-muted-foreground/50">{n}</span>
                <span className={n === "24" ? "text-destructive font-semibold" : text.includes("function") || text.startsWith("contract") ? "text-primary font-semibold" : "text-code"}>
                  {text || " "}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <Bug size={15} className="text-destructive" /> Anchored observation
              </div>
              <Pill tone="red">line {line}</Pill>
            </div>
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
              <div className="text-[12px] font-semibold text-destructive">External call before state update</div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                Line 24 executes token transfer before updating shares mapping on line 25. Reentrancy guard recommended.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailCell label="Target range" value={`Vault.sol:${line}`} />
              <DetailCell label="Evidence hash" value="ev_demo_4f12" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Dependencies() {
  const [selected, setSelected] = useState("OracleRouter");
  const nodes = [
    { id: "Vault", x: 28, y: 44, type: "contract", tone: "cyan" },
    { id: "OracleRouter", x: 52, y: 24, type: "oracle", tone: "amber" },
    { id: "USDC", x: 79, y: 42, type: "token", tone: "cyan" },
    { id: "ProxyAdmin", x: 50, y: 76, type: "admin", tone: "purple" },
    { id: "Bridge", x: 79, y: 75, type: "bridge", tone: "red" },
  ];
  const selectedNode = nodes.find((n) => n.id === selected)!;

  return (
    <>
      <PageHeader
        eyebrow="Dependency topology"
        title="Trust surface graph."
        body="Map external dependency contracts, oracles, bridges, proxies, and admin roles."
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative min-h-[500px] overflow-hidden border-border bg-card">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute left-5 top-5 flex flex-wrap gap-2 z-10">
            <Pill tone="cyan">Contract</Pill>
            <Pill tone="amber">Oracle</Pill>
            <Pill tone="purple">Admin</Pill>
            <Pill tone="red">Bridge</Pill>
          </div>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-10 pointer-events-none">
            <line x1="28" y1="44" x2="52" y2="24" stroke="currentColor" className="text-primary/40" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            <line x1="28" y1="44" x2="79" y2="42" stroke="currentColor" className="text-primary/40" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            <line x1="50" y1="76" x2="28" y2="44" stroke="currentColor" className="text-purple-500/40" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
          </svg>
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelected(node.id)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-4 py-3 text-left transition duration-200 ${
                selected === node.id ? "scale-110 border-primary bg-card text-foreground shadow-xl ring-2 ring-primary/30" : "border-border bg-card/90 text-foreground hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${node.tone === "cyan" ? "bg-primary" : node.tone === "amber" ? "bg-warning" : node.tone === "purple" ? "bg-purple-500" : "bg-destructive"}`} />
                <span className="text-[11px] font-semibold">{node.id}</span>
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{node.type}</div>
            </button>
          ))}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-foreground">{selectedNode.id}</div>
            <Pill tone={selectedNode.tone as any}>{selectedNode.type}</Pill>
          </div>
          <div className="mt-5 space-y-4">
            <DetailCell label="Declared Type" value={selectedNode.type} />
            <DetailCell label="Criticality Level" value={selected === "OracleRouter" ? "High · Freshness check required" : "Normal"} />
            <Button className="w-full" onClick={() => toast.success(`${selected} flagged for auditor verification.`)}>
              <ClipboardCheck size={14} /> Flag for review
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

function Testing() {
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  const start = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setRan(true);
      toast.success("Behavioral invariant harness executed successfully!");
    }, 1200);
  };

  return (
    <>
      <PageHeader
        eyebrow="Behavioral Testing"
        title="Invariant & fuzz testing."
        body="Validate contract properties against state mutations and fuzz harnesses."
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">Invariant Scenarios</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Active test harnesses.</p>
            </div>
            <Button onClick={start} disabled={running}>
              {running ? <RefreshCcw size={14} className="animate-spin" /> : ran ? <Check size={14} /> : <Play size={14} />}
              {running ? "Running..." : ran ? "Complete" : "Run harness"}
            </Button>
          </div>
          <div className="divide-y divide-border">
            {[
              ["INV-001", "Shares total supply never exceeds deposited assets", "Invariant", ran ? "Passed (10k runs)" : "Drafted", "green"],
              ["INV-002", "Guardian role update requires self-authentication", "Invariant", ran ? "Passed" : "Drafted", "cyan"],
            ].map(([id, title, type, status, tone]) => (
              <div key={id} className="flex items-center gap-4 p-5 hover:bg-accent/40 transition">
                <div className="font-mono text-[10px] text-muted-foreground">{id}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-foreground">{title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{type}</div>
                </div>
                <Pill tone={tone as any}>{status}</Pill>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <TestTube2 size={15} className="text-primary" /> Test Contract Invariant
          </div>
          <div className="mt-4 rounded-xl border border-border bg-code p-4 font-mono text-[11px] text-code leading-6">
            <span className="text-purple-400 font-semibold">function</span> invariant_assets() public {"{"}
            <br />
            &nbsp;&nbsp;<span className="text-warning">assert</span>(vault.totalAssets() &gt;= vault.shares());
            <br />
            {"}"}
          </div>
        </Card>
      </div>
    </>
  );
}

function Deployment() {
  const [checks, setChecks] = useState([true, false, false, true]);
  const toggle = (i: number) => setChecks((prev) => prev.map((v, index) => (index === i ? !v : v)));

  const rows = [
    ["Target Network & Identity", "Ethereum mainnet deployment target verified", "Verified", "green"],
    ["Proxy Admin Timelock", "Implementation upgrade timelock assertion", "Needs Review", "amber"],
    ["Privileged Guardian Role", "Multi-sig guardian key specification", "Needs Input", "amber"],
    ["Bytecode Hash Alignment", "Compiled artifact bytecode matches target", "Verified", "green"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Deployment Review"
        title="Production deployment readiness."
        body="Verify proxy configurations, timelocks, privileged roles, and mainnet bytecode integrity."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[13px] font-semibold text-foreground">Checklist</h2>
          </div>
          <div>
            {rows.map(([title, body, status, tone], i) => (
              <button key={title} onClick={() => toggle(i)} className="flex w-full items-center gap-4 border-b border-border p-5 text-left transition hover:bg-accent/40">
                <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${checks[i] ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {checks[i] ? <Check size={16} /> : <CircleDashed size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-foreground">{title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{body}</div>
                </div>
                <Pill tone={checks[i] ? "green" : (tone as any)}>{checks[i] ? "Reviewed" : status}</Pill>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}


function Report() {
  const workspace = trpc.analysis.workspace.useQuery();
  const latestReport = trpc.analysis.report.useQuery(
    { projectId: workspace.data?.project?.id ?? 0 },
    { enabled: !!workspace.data?.project?.id }
  );
  const reportId = (latestReport.data as any)?.report?.id as number | undefined;

  const anchorQuery = trpc.analysis.reportAnchor.useQuery(
    { reportId: reportId! },
    { enabled: !!reportId }
  );
  const anchorMutation = trpc.analysis.anchorReport.useMutation({
    onSuccess: (data) => {
      toast.success(
        <span>
          Report anchored on Sepolia!{" "}
          <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View on Etherscan ↗
          </a>
        </span>
      );
      anchorQuery.refetch();
    },
    onError: (err) => toast.error(`Anchoring failed: ${err.message}`),
  });

  const isAnchored = !!anchorQuery.data;
  const txHash = (anchorQuery.data as any)?.transactionHash as string | undefined;

  return (
    <>
      <PageHeader
        eyebrow="Security Report"
        title="Security audit report preview."
        body="Tamper-evident audit report with cryptographic evidence hashes and coverage manifests."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("PDF Report generated.")}>
              <Download size={14} /> Export PDF
            </Button>
            {isAnchored ? (
              <Button variant="outline" onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, "_blank")}>
                <Fingerprint size={14} /> Anchored on Sepolia ✓
              </Button>
            ) : (
              <Button
                onClick={() => reportId && anchorMutation.mutate({ reportId })}
                disabled={!reportId || anchorMutation.isPending}
              >
                <Fingerprint size={14} />
                {anchorMutation.isPending ? "Anchoring…" : "Anchor report hash"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <Card className="p-6">
          <div className="border-b border-border pb-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">ChainShield AI</div>
            <h2 className="mt-2 font-display text-3xl text-foreground">Aster Protocol Security Review</h2>
            <div className="mt-3 flex gap-2">
              <Pill tone="cyan">Revision fixture-v0.1</Pill>
              <Pill tone="green">Hash Verified</Pill>
              {isAnchored && <Pill tone="cyan">⛓ On-Chain Anchored</Pill>}
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <p className="text-[12px] leading-6 text-foreground/80">
              This security report summarizes 3 normalized observations identified across Vault.sol and ProxyAdmin.sol. Deterministic and custom detector stages completed with 84% evidence coverage.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function WorkspaceRouter() {
  return (
    <Switch>
      <Route path="/workspace/scan" component={ScanSetup} />
      <Route path="/workspace/findings" component={Findings} />
      <Route path="/workspace/source" component={SourceViewer} />
      <Route path="/workspace/dependencies" component={Dependencies} />
      <Route path="/workspace/testing" component={Testing} />
      <Route path="/workspace/deployment" component={Deployment} />
      <Route path="/workspace/report" component={Report} />
      <Route path="/workspace" component={Overview} />
    </Switch>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/workspace/:rest*">
        <WorkspaceShell>
          <WorkspaceRouter />
        </WorkspaceShell>
      </Route>
      <Route path="/workspace">
        <WorkspaceShell>
          <WorkspaceRouter />
        </WorkspaceShell>
      </Route>
      <Route path="/">
        <Landing />
      </Route>
      <Route>
        <Landing />
      </Route>
    </Switch>
  );
}
