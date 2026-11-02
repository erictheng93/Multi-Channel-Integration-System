# System settings components

Layout: `views/SystemSettings.vue` renders the page head (title and actions per section from
`settings-pages.ts`), `SettingsRail.vue` and the nested route in one content column. It creates the
controller once (`useSystemSettingsController`) and provides it to the pages via `SETTINGS_CONTROLLER_KEY`.

- `settings-pages.ts` - section registry (route, title, subtitle, rail icon) and `SETTINGS_FORM_ID`.
- `SettingsRail.vue` - section rail with status dots from the controller.
- `SettingsGroup.vue` / `SettingsRow.vue` - captioned card and label/hint/control row.
- `CredentialRow.vue` - one stored credential: `已設定 ••••last4` + 更換; secrets are never sent to the browser.
- `GeneralSettingsForm`, `LineIntegrationForm`, `FacebookIntegrationForm`, `AdvancedSettingsForm` - forms.
  Each renders `<form id="settings-form">`; the page-head 儲存變更 button submits it with the `form` attribute.
- `IntegrationStatusCard.vue`, `SettingsLineQuota.vue` - connection summary and LINE quota.
- `pages/*` - thin route components that inject the controller.

Tests: `frontend/tests/unit/system-settings/`, `frontend/tests/integration/SystemSettings.integration.test.ts`.
