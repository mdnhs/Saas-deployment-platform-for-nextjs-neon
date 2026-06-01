"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconSettings,
  IconRocket,
  IconChevronLeft,
  IconCircleFilled,
  IconCommand,
  IconCreditCard
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { 
  NavigationMenu, 
  NavigationMenuItem, 
  NavigationMenuLink, 
  NavigationMenuList, 
  navigationMenuTriggerStyle 
} from "@/components/ui/navigation-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  workspaceSlug: string;
  workspaceName: string;
  role: string;
  userEmail: string;
}

export function Navbar({ workspaceSlug, workspaceName, role, userEmail }: NavbarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Projects",
      href: `/${workspaceSlug}/projects`,
      icon: IconRocket,
    },
    {
      title: "Members",
      href: `/${workspaceSlug}/members`,
      icon: IconUsers,
    },
    {
      title: "Settings",
      href: `/${workspaceSlug}/settings`,
      icon: IconSettings,
    },
    {
      title: "Billing",
      href: `/${workspaceSlug}/billing`,
      icon: IconCreditCard,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link 
            href="/workspaces" 
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconChevronLeft className="size-3.5" />
            Workspaces
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconCommand className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold truncate max-w-[120px]">{workspaceName}</span>
              <div className="flex items-center gap-1.5">
                <IconCircleFilled className="size-1.5 text-emerald-500" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{role}</span>
              </div>
            </div>
          </div>

          <Separator />

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <NavigationMenuItem key={item.href}>
                    <NavigationMenuLink asChild active={isActive}>
                      <Link 
                        href={item.href}
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "h-9 px-3 gap-2 bg-transparent transition-all",
                          isActive ? "text-primary bg-primary/5 font-semibold" : "text-muted-foreground"
                        )}
                      >
                        <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                        {item.title}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden flex-col items-end leading-tight lg:flex">
            <span className="text-[11px] font-medium text-foreground">{userEmail}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="size-8 rounded-lg border shadow-sm transition-transform hover:scale-105 active:scale-95">
                <AvatarFallback className="rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
                  {userEmail.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Account</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/workspaces" className="cursor-pointer">
                  <IconLayoutDashboard className="mr-2 size-4" />
                  All Workspaces
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-border/60 mx-2" />;
}
