import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { isTheme, useTheme } from '@/shared/theme-provider';

/**
 * The mode toggle of the shadcn documentation, built on `select` instead of `dropdown-menu`.
 * The ticket allows four components — button, input, select and badge — and every vendored
 * component must pass the lint set of this repository forever, so no fifth one is added for a
 * control that `select` already gives. The three choices and the behaviour are unchanged.
 */
export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select
      value={theme}
      onValueChange={(next: string) => {
        if (isTheme(next)) setTheme(next);
      }}
    >
      <SelectTrigger aria-label="Theme" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}
