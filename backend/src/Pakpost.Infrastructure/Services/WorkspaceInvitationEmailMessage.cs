using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using System.Text.RegularExpressions;

namespace Pakpost.Infrastructure.Services;

/// <summary>
/// Builds a plain-text + HTML invitation with a CID-embedded PakPost logo.
/// No remote images, untrusted HTML, or server configuration are used by the renderer.
/// </summary>
public static class WorkspaceInvitationEmailMessage
{
    private const string TemplateResource =
        "Pakpost.Infrastructure.Services.EmailTemplates.WorkspaceInvitation.html";
    private const string LogoResource =
        "Pakpost.Infrastructure.Services.EmailTemplates.pakpost-logo.png";

    private static readonly Lazy<string> HtmlTemplate = new(() =>
    {
        using var stream = OpenResource(TemplateResource);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    });

    private static readonly Regex Placeholder = new(
        @"\{\{(?:WORKSPACE_NAME|RECIPIENT_EMAIL|INVITATION_URL)\}\}",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static MailMessage Create(string sender, string recipient, string workspaceName, string invitationUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sender);
        ArgumentException.ThrowIfNullOrWhiteSpace(recipient);
        ArgumentException.ThrowIfNullOrWhiteSpace(workspaceName);
        ArgumentException.ThrowIfNullOrWhiteSpace(invitationUrl);

        // InvitationTokens.Link already enforces this policy; keep the MIME builder safe independently.
        if (!Uri.TryCreate(invitationUrl, UriKind.Absolute, out var link) ||
            (link.Scheme != Uri.UriSchemeHttps && !(link.Scheme == Uri.UriSchemeHttp && link.IsLoopback)) ||
            !string.IsNullOrEmpty(link.UserInfo))
            throw new ArgumentException("Invitation URL must use HTTPS (or loopback HTTP)", nameof(invitationUrl));

        var plain = $"You have been invited to the PakPost workspace '{workspaceName}'.\n\n" +
                    $"Accept this one-time invitation (expires in 7 days):\n{invitationUrl}\n\n" +
                    "If you weren't expecting this invitation, you can ignore this email.\n";

        var message = new MailMessage(new MailAddress(sender), new MailAddress(recipient))
        {
            Subject = "You're invited to a PakPost workspace",
            SubjectEncoding = Encoding.UTF8,
            Body = plain,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };

        try
        {
            var html = Placeholder.Replace(HtmlTemplate.Value, match => match.Value switch
            {
                "{{WORKSPACE_NAME}}" => WebUtility.HtmlEncode(workspaceName),
                "{{RECIPIENT_EMAIL}}" => WebUtility.HtmlEncode(recipient),
                "{{INVITATION_URL}}" => WebUtility.HtmlEncode(invitationUrl),
                _ => throw new InvalidOperationException("Unknown invitation template placeholder")
            });

            var view = AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html);
            message.AlternateViews.Add(view);

            // System.Net.Mail owns the resource stream after it is attached to the view.
            var logo = new LinkedResource(OpenResource(LogoResource), MediaTypeNames.Image.Png)
            {
                ContentId = "pakpost-logo",
                TransferEncoding = TransferEncoding.Base64
            };
            view.LinkedResources.Add(logo);
            return message;
        }
        catch
        {
            message.Dispose();
            throw;
        }
    }

    private static Stream OpenResource(string name) =>
        typeof(WorkspaceInvitationEmailMessage).Assembly.GetManifestResourceStream(name)
        ?? throw new InvalidOperationException($"Missing embedded invitation email resource: {name}");
}
