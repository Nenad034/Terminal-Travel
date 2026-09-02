'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';

import { cn } from '@/lib/cn';
import Icon from '@/components/Icon';

// shadcn/ui Command (nad `cmdk`) — izvorni kod kopiran u repo, ne paket (Master dokument
// poglavlje 6). Daje pretragu sa tastaturom: strelice gore/dole biraju, Enter potvrđuje,
// filtriranje ide samo, bez ručnog `.filter()` po svakom ekranu.
//
// Napomena o poreklu: ovo je trebalo da uđe još 31.8.2026, ali `npm install` je tada rušio
// Node na ovoj mašini (greška u Windows skladištu sertifikata), pa je birač proizvoda za
// grupne pakete privremeno napisan ručno. Instalacija je 2.9.2026 ponovo proradila i ručna
// lista je zamenjena ovim.
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive ref={ref} className={cn('flex h-full w-full flex-col overflow-hidden rounded-lg bg-panel text-ink', className)} {...props} />
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-2" cmdk-input-wrapper="">
    <Icon name="search" className="text-ink-faint" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-9 w-full bg-transparent py-2 text-xs text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn('max-h-56 overflow-y-auto overflow-x-hidden p-1', className)} {...props} />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => <CommandPrimitive.Empty ref={ref} className="p-3 text-center text-xs text-ink-faint" {...props} />);
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden text-ink [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-faint',
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      // `data-[selected=true]` je stanje koje cmdk sam postavlja na red pod strelicama —
      // isto isticanje kao aktivan filter u ostatku panela (dizajn dok. §6d).
      'relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-xs outline-none',
      'data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-strong',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
