# Nekofin Design System

Nekofin 的设计系统把“视觉常量”和“业务组件”拆开：页面只消费语义化主题，底层 token 才保存具体数值。这样后续支持更多后端、多账号、多平台时，不需要在页面里继续复制颜色、圆角和间距。

## 参考原则

- Apple Human Interface Guidelines：优先使用系统语义色、动态明暗主题和平台原生控件。
- Atlassian Design System Foundations：颜色、间距、排版、圆角等基础值集中成 token，作为单一事实来源。
- Material token architecture：组件不直接依赖原始色值，而是依赖角色化的 theme roles。

## 文件入口

- `lib/design-system/tokens.ts`：品牌色、spacing、radius、typography、sizes、opacity、zIndex。
- `lib/design-system/theme.ts`：把 token 和系统动态色组合成应用语义主题。
- `lib/design-system/useAppTheme.ts`：React 组件使用的统一 hook。
- `components/ui/Surface.tsx`：基础 surface 容器，适合卡片、分组块和静态内容区域。
- `hooks/useThemeColor.ts`：旧接口兼容层；新代码优先用 `useAppTheme`。

## 颜色角色

页面代码只应使用这些语义角色：

- `background`：普通页面背景。
- `backgroundGrouped`：设置页、分组列表等 grouped 背景。
- `surface`：普通分组面板。
- `surfaceElevated`：需要轻微前景层级的面板。
- `surfaceMuted`：图片占位、骨架屏、弱对比区域。
- `text`、`textSecondary`、`textTertiary`：主文字、辅助文字、弱提示。
- `separator`：边框和分割线。
- `tint`：当前账号/应用强调色。
- `success`、`danger`、`warning`：状态色。
- `scrim`、`mediaChrome`：遮罩和播放器覆盖层。

除品牌色、媒体遮罩、第三方资产要求外，页面和组件里不要新增裸 `#RRGGBB`。

## 使用方式

```tsx
import { Surface } from '@/components/ui/Surface';
import { useAppTheme } from '@/lib/design-system';

export function AccountSummary() {
  const theme = useAppTheme();

  return (
    <Surface variant="elevated" padded>
      <Text style={[theme.typography.bodyEmphasized, { color: theme.colors.text }]}>当前账号</Text>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        Jellyfin
      </Text>
    </Surface>
  );
}
```

## 迁移规则

- 新组件优先使用 `useAppTheme`，不要直接 import `constants/Colors`。
- 列表 padding 用 `theme.spacing.page`，卡片间距用 `theme.spacing.md` 或 `theme.spacing.lg`。
- 圆角优先用 `theme.radius.md`，胶囊按钮用 `theme.radius.pill`。
- 文本优先用 `theme.typography.body`、`bodyEmphasized`、`footnote`、`title3`。
- iOS 原生表单和 sheet 继续使用 `@expo/ui`，RN 页面 theme 必须通过同一个 `ThemePreferenceContext` 和 accent source 派生。
