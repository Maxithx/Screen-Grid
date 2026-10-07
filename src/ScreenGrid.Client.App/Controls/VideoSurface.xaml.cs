using System.Windows;
using System.Windows.Controls;

namespace ScreenGrid.Client.App.Controls;

/// <summary>
/// Reusable surface for presenting a remote/streamed video frame.
/// In Phase 1 it only shows a placeholder; the decoder/rendering pipeline
/// is attached in a later phase (and reused by the community app).
/// </summary>
public partial class VideoSurface : UserControl
{
    /// <summary>Identifies the <see cref="PlaceholderText"/> dependency property.</summary>
    public static readonly DependencyProperty PlaceholderTextProperty =
        DependencyProperty.Register(
            nameof(PlaceholderText),
            typeof(string),
            typeof(VideoSurface),
            new PropertyMetadata(string.Empty));

    public VideoSurface() => InitializeComponent();

    /// <summary>Text shown in the middle of the surface while no stream is present.</summary>
    public string PlaceholderText
    {
        get => (string)GetValue(PlaceholderTextProperty);
        set => SetValue(PlaceholderTextProperty, value);
    }
}
