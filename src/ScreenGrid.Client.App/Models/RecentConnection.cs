namespace ScreenGrid.Client.App.Models;

/// <summary>
/// A previously used remote connection shown in the "Recent connections" list.
/// </summary>
/// <param name="Name">Friendly device name.</param>
/// <param name="Id">The remote device ID.</param>
/// <param name="LastUsed">Human readable "last used" indicator.</param>
public sealed record RecentConnection(string Name, string Id, string LastUsed);
