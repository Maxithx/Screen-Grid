#nullable enable

using System.Globalization;
using System.Resources;

namespace ScreenGrid.Client.App.Resources;

/// <summary>
/// Strongly-typed access to the application's localized strings.
/// <para>
/// English is the neutral (fallback) language defined in <c>Strings.resx</c>.
/// To add a translation, drop a satellite resource file next to it, e.g.
/// <c>Strings.da.resx</c> for Danish, and set <see cref="Culture"/>.
/// </para>
/// </summary>
public static class Strings
{
    private static ResourceManager? _resourceManager;

    /// <summary>Gets the underlying resource manager used for lookups.</summary>
    public static ResourceManager ResourceManager =>
        _resourceManager ??= new ResourceManager(
            "ScreenGrid.Client.App.Resources.Strings",
            typeof(Strings).Assembly);

    /// <summary>
    /// When set, this culture overrides the current UI culture for all lookups.
    /// Leave <see langword="null"/> to follow <see cref="CultureInfo.CurrentUICulture"/>.
    /// </summary>
    public static CultureInfo? Culture { get; set; }

    private static string Get(string key) => ResourceManager.GetString(key, Culture) ?? key;

    public static string AppName => Get(nameof(AppName));

    public static string AppTagline => Get(nameof(AppTagline));

    public static string Home => Get(nameof(Home));

    public static string Settings => Get(nameof(Settings));

    public static string ToggleTheme => Get(nameof(ToggleTheme));

    public static string Back => Get(nameof(Back));

    public static string ShareTitle => Get(nameof(ShareTitle));

    public static string ShareSubtitle => Get(nameof(ShareSubtitle));

    public static string YourId => Get(nameof(YourId));

    public static string Copy => Get(nameof(Copy));

    public static string Copied => Get(nameof(Copied));

    public static string PasswordLabel => Get(nameof(PasswordLabel));

    public static string Regenerate => Get(nameof(Regenerate));

    public static string ShowPassword => Get(nameof(ShowPassword));

    public static string HidePassword => Get(nameof(HidePassword));

    public static string ReadyForConnections => Get(nameof(ReadyForConnections));

    public static string NotAcceptingConnections => Get(nameof(NotAcceptingConnections));

    public static string AcceptIncoming => Get(nameof(AcceptIncoming));

    public static string AccessTitle => Get(nameof(AccessTitle));

    public static string AccessSubtitle => Get(nameof(AccessSubtitle));

    public static string RemoteIdLabel => Get(nameof(RemoteIdLabel));

    public static string RemoteIdPlaceholder => Get(nameof(RemoteIdPlaceholder));

    public static string PasswordPlaceholder => Get(nameof(PasswordPlaceholder));

    public static string Connect => Get(nameof(Connect));

    public static string RecentConnections => Get(nameof(RecentConnections));

    public static string NoRecentConnections => Get(nameof(NoRecentConnections));

    public static string SessionConnecting => Get(nameof(SessionConnecting));

    public static string WaitingForVideo => Get(nameof(WaitingForVideo));

    public static string Disconnect => Get(nameof(Disconnect));

    public static string SessionWith => Get(nameof(SessionWith));

    public static string StatusReady => Get(nameof(StatusReady));

    public static string VersionFormat => Get(nameof(VersionFormat));

    public static string SettingsGeneral => Get(nameof(SettingsGeneral));

    public static string SettingsSecurity => Get(nameof(SettingsSecurity));

    public static string SettingsStartWithWindows => Get(nameof(SettingsStartWithWindows));

    public static string SettingsRequirePassword => Get(nameof(SettingsRequirePassword));

    public static string SettingsAutoAccept => Get(nameof(SettingsAutoAccept));

    public static string SettingsAbout => Get(nameof(SettingsAbout));

    public static string SettingsAboutText => Get(nameof(SettingsAboutText));
}
