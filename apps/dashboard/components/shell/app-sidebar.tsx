"use client"

import type { Project } from "@traceforge/event-schema"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@traceforge/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@traceforge/ui/components/sidebar"
import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSelectedLayoutSegment } from "next/navigation"

import { LogoMark } from "@/components/logo"
import type { SessionUser } from "@/lib/api"

import { NAV_ITEMS, SETTINGS_ITEM } from "./nav"
import { useFilterHref } from "./use-filter-href"
import { UserMenu } from "./user-menu"

export function AppSidebar({
  projects,
  project,
  user,
}: {
  projects: readonly Project[]
  project: Project
  user: SessionUser
}) {
  const segment = useSelectedLayoutSegment() ?? "overview"
  const filterHref = useFilterHref()
  const router = useRouter()
  const base = `/p/${project.id}`

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent"
                    aria-label={`Project: ${project.name}. Switch project`}
                  />
                }
              >
                <LogoMark className="size-8" />
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate font-medium">{project.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {project.id}
                  </span>
                </span>
                <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-60" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Projects</DropdownMenuLabel>
                  {projects.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => router.push(filterHref(`/p/${item.id}/${segment}`))}
                    >
                      <span className="truncate">{item.name}</span>
                      {item.id === project.id && <CheckIcon className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push("/projects/new")}>
                    <PlusIcon />
                    New project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/projects")}>
                    <LayoutGridIcon />
                    All projects
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* `contents` keeps the groups as flex children of SidebarContent (mt-auto still works). */}
        <nav aria-label="Project" className="contents">
          <SidebarGroup>
            <SidebarGroupLabel>Monitor</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(({ segment: item, label, icon: Icon }) => (
                  <SidebarMenuItem key={item}>
                    <SidebarMenuButton
                      isActive={segment === item}
                      tooltip={label}
                      render={<Link href={filterHref(`${base}/${item}`)} />}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={segment === SETTINGS_ITEM.segment}
                    tooltip={SETTINGS_ITEM.label}
                    render={<Link href={`${base}/settings`} />}
                  >
                    <SETTINGS_ITEM.icon />
                    <span>{SETTINGS_ITEM.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
