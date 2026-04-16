"use client";

import Link from "next/link";

interface Connector {
  name: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  status: "active" | "coming-soon";
}

interface Section {
  title: string;
  connectors: Connector[];
}

const sections: Section[] = [
  {
    title: "Code Repositories",
    connectors: [
      {
        name: "GitLab",
        description: "Connect your GitLab group, sync and index repositories.",
        icon: <GitLabIcon />,
        href: "/admin/connectors/gitlab",
        status: "active",
      },
      {
        name: "GitHub",
        description: "Connect GitHub organizations and repositories.",
        icon: <GitHubIcon />,
        href: "/admin/connectors/github",
        status: "active",
      },
      {
        name: "Bitbucket",
        description: "Connect Bitbucket workspaces and repositories.",
        icon: <BitbucketIcon />,
        status: "coming-soon",
      },
    ],
  },
  {
    title: "Project Management",
    connectors: [
      {
        name: "Jira",
        description: "Sync Jira issues and link code changes to tickets.",
        icon: <JiraIcon />,
        href: "/admin/connectors/jira",
        status: "active",
      },
      {
        name: "Confluence",
        description: "Index Confluence pages for AI-powered search.",
        icon: <ConfluenceIcon />,
        href: "/admin/connectors/confluence",
        status: "active",
      },
    ],
  },
  {
    title: "Documentation",
    connectors: [
      {
        name: "SharePoint (BETA)",
        description: "Index SharePoint documents like Word files and other resources.",
        icon: <SharePointIcon />,
        href: "/admin/connectors/sharepoint",
        status: "active",
      },
    ],
  },
  {
    title: "Custom",
    connectors: [
      {
        name: "MCP Servers",
        description: "Connect custom MCP servers to extend AI with external tools and data.",
        icon: <McpIcon />,
        href: "/admin/connectors/mcp",
        status: "active",
      },
    ],
  },
  {
    title: "Socials",
    connectors: [
      {
        name: "Telegram",
        description: "Connect a Telegram bot to receive messages and send notifications.",
        icon: <TelegramIcon />,
        href: "/admin/connectors/telegram",
        status: "active",
      },
      {
        name: "Discord",
        description: "Connect Discord bots and receive channel messages.",
        icon: <DiscordIcon />,
        status: "coming-soon",
      },
    ],
  },
  {
    title: "Communications",
    connectors: [
      {
        name: "Resend",
        description: "Send email notifications and automation reports via Resend.",
        icon: <ResendIcon />,
        href: "/admin/connectors/resend",
        status: "active",
      },
      {
        name: "Slack",
        description: "Send notifications and interact via Slack channels.",
        icon: <SlackIcon />,
        status: "coming-soon",
      },
    ],
  },
];

export default function ConnectorsPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connectors</h1>
        <p className="text-muted-foreground mt-1">
          Manage integrations with your development tools and services.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {section.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.connectors.map((connector) => {
              const card = (
                <div
                  key={connector.name}
                  className={`relative rounded-xl border bg-card p-4 transition-all ${
                    connector.status === "active"
                      ? "border-border hover:border-[#007acc]/40 hover:shadow-lg hover:shadow-[#007acc]/5 cursor-pointer card-hover"
                      : "border-border/40 opacity-50"
                  }`}
                >
                  {connector.status === "coming-soon" && (
                    <span className="absolute top-3 right-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
                      {connector.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground">{connector.name}</h3>
                      <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                        {connector.description}
                      </p>
                    </div>
                  </div>
                  {connector.status === "active" && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#68c2ff] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
                      Configure
                      <svg className="h-3 w-3 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  )}
                </div>
              );

              if (connector.status === "active" && connector.href) {
                return (
                  <Link key={connector.name} href={connector.href} className="block">
                    {card}
                  </Link>
                );
              }
              return <div key={connector.name}>{card}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GitLabIcon() {
  return (
    <svg className="h-5 w-5 text-[#FC6D26]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.386 9.45.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.92.92 0 00.331-1.024" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function BitbucketIcon() {
  return (
    <svg className="h-5 w-5 text-[#2684FF]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

function JiraIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M23.013 0H11.455a5.215 5.215 0 005.215 5.215h2.129v2.057A5.215 5.215 0 0024.013 12.5V1.005A1.005 1.005 0 0023.013 0z" fill="#2684FF" />
      <path d="M17.294 5.757H5.736a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.758a1.001 1.001 0 00-1.001-1.001z" fill="#2684FF" opacity="0.72" />
      <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.518a1.005 1.005 0 00-1.005-1.005z" fill="#2684FF" opacity="0.45" />
    </svg>
  );
}

function ConfluenceIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M1.26 17.4c-.237.36-.504.78-.504.78a.54.54 0 00.192.744l4.2 2.556a.54.54 0 00.744-.168s.384-.636.828-1.344c1.776-2.832 3.576-2.472 6.852-.96l4.14 1.92a.546.546 0 00.72-.276l1.932-4.44a.54.54 0 00-.276-.708s-1.884-.876-3.828-1.776C10.14 10.836 4.68 12 1.26 17.4z" fill="#2684FF" />
      <path d="M22.74 6.6c.237-.36.504-.78.504-.78a.54.54 0 00-.192-.744l-4.2-2.556a.54.54 0 00-.744.168s-.384.636-.828 1.344c-1.776 2.832-3.576 2.472-6.852.96L6.288 3.07a.546.546 0 00-.72.276L3.636 7.787a.54.54 0 00.276.708s1.884.876 3.828 1.776C13.86 13.163 19.32 12 22.74 6.6z" fill="#2684FF" opacity="0.65" />
    </svg>
  );
}

function SharePointIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="7" fill="#036C70" />
      <circle cx="16" cy="14" r="5.5" fill="#1A9BA1" />
      <circle cx="10" cy="16" r="4" fill="#37C6D0" />
    </svg>
  );
}

function ResendIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z" />
    </svg>
  );
}

function McpIcon() {
  return (
    <svg className="h-5 w-5 text-foreground" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.657-.663 47.703 47.703 0 00-.31-4.82 48.1 48.1 0 01-4.27.33.64.64 0 01-.657-.643v0z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg className="h-5 w-5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg className="h-5 w-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.527 2.527 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z" fill="#ECB22E" />
    </svg>
  );
}
