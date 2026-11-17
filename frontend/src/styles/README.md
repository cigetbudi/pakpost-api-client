# PakPost stylesheet architecture

`base.css` contains foundational style rules, and `clean-workbench.css` adds the clean UI foundation.

`layers/` holds domain-specific stylesheets. **Import order in `src/main.jsx` is intentional**: many older rules are additive overrides and depend on the cascade. Avoid sorting imports alphabetically.

Names describe responsibilities instead of old release numbers. Existing selectors were renamed consistently in source and styles without changing declarations or theme values.

For new features, prefer a component-co-located stylesheet with scoped `pp-` classes rather than adding another release-wide stylesheet.

Persisted preferences such as `pakpost_v14_right_width` are deliberately left unchanged to preserve user settings.
