namespace ScreenGrid.Client.App.Services;

/// <summary>
/// Abstraction used by the view models to request navigation between the
/// top-level views without taking a hard dependency on the shell window.
/// </summary>
public interface IAppNavigator
{
    /// <summary>Shows the home screen (Share / Get access).</summary>
    void NavigateToHome();

    /// <summary>Shows the settings screen.</summary>
    void NavigateToSettings();

    /// <summary>
    /// Begins a remote session for the supplied remote ID.
    /// In Phase 1 this only shows the session placeholder view.
    /// </summary>
    /// <param name="remoteId">The remote device ID the user wants to control.</param>
    void StartSession(string remoteId);
}
