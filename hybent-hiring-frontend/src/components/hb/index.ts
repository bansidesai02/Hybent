/**
 * The Hybent design system.
 *
 * Everything a product page should need. If a screen reaches past this barrel
 * for a raw element with inline styles, that is the signal a primitive is
 * missing — add it here rather than in the page.
 *
 * Tokens live in `src/styles/tokens.css`; nothing in this folder names a colour.
 *
 * Migration note: `src/components/ui/` is the previous generation and is still
 * imported by unmigrated pages. Nothing new should import from it — it is
 * deleted in phase 10.
 */

export { Avatar } from './Avatar'
export { Button, type ButtonProps } from './Button'
export { Card, CardHeader, CardDivider, type CardProps } from './Card'
export { IconTile } from './IconTile'
export { StatCard, StatGrid, type StatCardProps, type Trend } from './StatCard'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { Meter } from './Meter'
export { ScoreRing } from './ScoreRing'
export { Skeleton, SkeletonText, SkeletonStats, SkeletonTable } from './Skeleton'
export { Badge, type BadgeTone, type BadgeProps } from './Badge'
export { StatusPill, statusDef } from './StatusPill'
export {
  Field,
  Label,
  Input,
  Textarea,
  Select,
  Checkbox,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
  type CheckboxProps,
} from './Field'
export { Reveal } from './Reveal'
export { Switch } from './Switch'
export { Dropzone } from './Dropzone'
export { TagInput } from './TagInput'
export { PageHeader, type PageHeaderProps, type Crumb } from './PageHeader'
export { Pagination } from './Pagination'
export {
  Toolbar,
  ToolbarSearch,
  ToolbarSpacer,
  ToolbarSelection,
  FilterChips,
} from './Toolbar'
export { Tabs, TabPanel, type TabItem } from './Tabs'
export { ContextMenu, type ContextMenuItem } from './ContextMenu'
export { Dialog, ConfirmDialog, type DialogProps } from './Dialog'
export { Drawer, type DrawerProps } from './Drawer'
export {
  DataTable,
  CellStack,
  type Column,
  type DataTableProps,
  type SortDirection,
} from './DataTable'
export {
  useChartTheme,
  axisProps,
  chartLabel,
  ChartLegend,
  ChartTooltip,
  ChartFrame,
  type ChartTheme,
} from './chartTheme'
export { useOverlay } from './useOverlay'
