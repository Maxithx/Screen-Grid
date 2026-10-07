# ScreenGrid — Phase 1 UI

This document describes the user interface delivered in **Phase 1** and how to
extend it. Everything here is presentation only: no network, crypto, capture or
input code exists yet.

## Window shell (`Views/MainWindow.xaml`)

The shell is a WPF-UI `FluentWindow` with the custom title bar enabled
(`ExtendsContentIntoTitleBar="True"`), a Mica backdrop and rounded corners.
It has three rows:

```
+---------------------------------------------------------------+
|  [icon] ScreenGrid                  [theme] [settings]        |  ui:TitleBar
+---------------------------------------------------------------+
|                                                               |
|                     ContentControl                            |  CurrentView
|                 (Home / Session / Settings)                   |
|                                                               |
+---------------------------------------------------------------+
|  Ready                              ScreenGrid  .  v0.1.0      |  status bar
+---------------------------------------------------------------+
```

* The **title bar** shows the localized app name, an app icon and two buttons —
  a dark/light **theme toggle** and a shortcut to **Settings**.
* The middle `ContentControl` is bound to `MainWindowViewModel.CurrentView`.
* The **status bar** shows the current status text (left) and the app name +
  version (right).

## Home screen (`Views/HomeView.xaml`)

A two-column layout, matching the familiar AnyDesk / Supremo front page.

### Left — "Share Your Computer" (`ShareComputerViewModel`)

| Element           | Binding                                 | Notes                                          |
| ----------------- | --------------------------------------- | ---------------------------------------------- |
| Your ID           | `Share.DisplayId`                       | 9 digits, grouped `123 456 789`                |
| Copy ID           | `Share.CopyIdCommand`                   | copies to the clipboard                        |
| Password          | `Share.DisplayPassword`                 | masked (dots) unless revealed                  |
| Show / hide       | `Share.TogglePasswordVisibilityCommand` | tooltip from `TogglePasswordVisibilityTooltip` |
| Regenerate        | `Share.RegeneratePasswordCommand`       | new random 9-char password                     |
| Status dot + text | `Share.StatusText`                      | green when accepting, grey when not            |
| Incoming toggle   | `Share.IsAcceptingConnections`          | `ui:ToggleSwitch`                              |

### Right — "Get Access to Computer" (`AccessComputerViewModel`)

| Element            | Binding                    | Notes                                                  |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| Remote ID          | `Access.RemoteId`          | `ui:TextBox`, updates the source on each keystroke     |
| Password           | `Access.Password`          | `ui:PasswordBox` with a built-in reveal button         |
| Connect            | `Access.ConnectCommand`    | disabled until the remote ID is non-empty              |
| Recent connections | `Access.RecentConnections` | `ItemsControl`; each row runs `ConnectToRecentCommand` |

`Connect` (and clicking a recent entry) calls
`IAppNavigator.StartSession(remoteId)`, which switches the shell to the session
view.

## Session screen (`Views/SessionView.xaml`)

Placeholder remote-session screen:

* Heading `SessionViewModel.Title` -> "Session with `<id>`" and a status line.
* A **Disconnect** button (`DisconnectCommand`) returning to the home screen.
* A `VideoSurface` control showing the "Waiting for remote video..." hint.

## Settings screen (`Views/SettingsView.xaml`)

Placeholder settings with General / Security / About sections and three
presentational toggles. Nothing is persisted yet.

## `Controls/VideoSurface.xaml`

A **standalone, reusable** `UserControl` (dark frame + placeholder icon/text)
intended to present a decoded video frame. It deliberately has no dependency on
the remote-control pipeline so the future community/streaming app can reuse it.

It exposes one dependency property:

```xml
<controls:VideoSurface PlaceholderText="{x:Static res:Strings.WaitingForVideo}" />
```

## Theming

* `App.xaml` merges `ui:ThemesDictionary Theme="Dark"` and `ui:ControlsDictionary`.
* Theme-aware brushes (`CardBackgroundFillColorDefaultBrush`,
  `TextFillColorPrimaryBrush`, `CardStrokeColorDefaultBrush`, ...) are referenced
  with `DynamicResource`, so they follow the active theme automatically.
* `Resources/Brand.xaml` holds the brand accent colours (`BrandAccentBrush`,
  `OnlineStatusBrush`, ...) and the shared layout styles
  (`PanelCardStyle`, `SectionTitleStyle`, `FieldLabelStyle`, `IdDisplayStyle`).
* `MainWindowViewModel.ToggleThemeCommand` calls
  `ApplicationThemeManager.Apply(...)` to switch dark/light at runtime.

## Localization

English lives in `Resources/Strings.resx` (the **neutral** culture).
`Resources/Strings.Designer.cs` is a hand-written, strongly-typed accessor so
that everything works with plain `dotnet build` (no Visual Studio designer
required).

Strings are used in two ways:

* From **XAML**: `Text="{x:Static res:Strings.ShareTitle}"`.
* From **C#**: `Strings.StatusReady`.

### Adding a string

1. Add a `<data name="Key"><value>...</value></data>` entry to `Strings.resx`.
2. Add a matching `public static string Key => Get(nameof(Key));` to
   `Strings.Designer.cs`.

### Adding a language

Drop a satellite resource next to the neutral one (e.g.
`Resources/Strings.da.resx` for Danish). The `ResourceManager` picks it up
automatically. To force a culture at runtime, set
`ScreenGrid.Client.App.Resources.Strings.Culture`.

## Architecture (MVVM)

```
MainWindowViewModel  --implements-->  IAppNavigator
   |  CurrentView (object)
   +-- HomeViewModel ---> ShareComputerViewModel
   |                 \--> AccessComputerViewModel ---> StartSession(...)
   +-- SessionViewModel
   \-- SettingsViewModel
```

* View models use `CommunityToolkit.Mvvm` (`ObservableObject`,
  `[ObservableProperty]`, `[RelayCommand]`).
* `App.xaml` maps view-model types to views with implicit `DataTemplate`s, so the
  shell simply shows a view-model and WPF resolves the matching view.
* View models never reference `Window`/`UserControl`; navigation goes through
  `IAppNavigator`, which the shell implements.

### Adding a new view

1. Create `MyViewModel` in `ViewModels/` (derive from `ObservableObject`).
2. Create `MyView.xaml` (+ `.xaml.cs`) in `Views/`.
3. Register a `DataTemplate` in `App.xaml` mapping `MyViewModel` -> `MyView`.
4. Navigate by assigning the view model to `MainWindowViewModel.CurrentView`.

## Current limitations (intentional for Phase 1)

* No networking, encryption, capture or input handling.
* The device ID and password are generated locally and are **not persisted**.
* Recent connections are sample data.
* Settings toggles are not saved.
* The theme choice is not persisted across restarts.
