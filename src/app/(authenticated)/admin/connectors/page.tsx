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
    title: "Communications",
    connectors: [
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
