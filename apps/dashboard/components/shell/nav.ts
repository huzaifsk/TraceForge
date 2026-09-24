import {
  ActivityIcon,
  BugIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  SettingsIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react"

export const NAV_ITEMS = [
  { segment: "overview", label: "Overview", icon: LayoutDashboardIcon },
  { segment: "issues", label: "Issues", icon: BugIcon },
  { segment: "sessions", label: "Sessions", icon: UsersIcon },
  { segment: "releases", label: "Releases", icon: TagIcon },
  { segment: "performance", label: "Web Vitals", icon: GaugeIcon },
  { segment: "api", label: "API performance", icon: NetworkIcon },
  // Live events is hidden until the API host stays warm (Render free tier sleeps and
  // drops the in-memory event bus, see docs/DEPLOY.md). Re-add once that's resolved.
] as const

export const SETTINGS_ITEM = { segment: "settings", label: "Settings", icon: SettingsIcon } as const

export const ALL_ITEMS = [...NAV_ITEMS, SETTINGS_ITEM]

export const PULSE_ICON = ActivityIcon

/** Page title for the current project route segment. */
export function titleFor(segment: string | undefined): string {
  return ALL_ITEMS.find((item) => item.segment === segment)?.label ?? "Overview"
}
